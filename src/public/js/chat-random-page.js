const socket = io('/oneonone');

const chatStatus = document.getElementById('chatStatus');
const roomSubtitle = document.getElementById('roomSubtitle');
const chatAccount = document.getElementById('chatAccount');
const chatMeta = document.getElementById('chatMeta');
const startMatchBtn = document.getElementById('startMatchBtn');
const reconnectBtn = document.getElementById('reconnectBtn');
const friendRequestBtn = document.getElementById('friendRequestBtn');
const friendAcceptBtn = document.getElementById('friendAcceptBtn');
const leaveBtn = document.getElementById('leaveBtn');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatMode = document.getElementById('chatMode');
const chatCapacity = document.getElementById('chatCapacity');
const chatDuration = document.getElementById('chatDuration');
const chatTopic = document.getElementById('chatTopic');

let currentRoomName = null;
let isMatching = false;
let roomTimerInterval = null;

function syncChatConfigOptions() {
  if (!chatMode || !chatCapacity || !chatDuration) return;

  const isGroup = chatMode.value === 'group';
  chatCapacity.innerHTML = isGroup
    ? '<option value="3">3명</option><option value="4" selected>4명</option><option value="5">5명</option><option value="6">6명</option>'
    : '<option value="2" selected>2명</option>';
  chatDuration.innerHTML = isGroup
    ? '<option value="10">10분</option><option value="20" selected>20분</option><option value="30">30분</option>'
    : '<option value="5">5분</option><option value="15" selected>15분</option><option value="25">25분</option>';
}

function getChatOptions() {
  return {
    mode: chatMode?.value === 'group' ? 'group' : 'one',
    capacity: Number(chatCapacity?.value || 2),
    duration: Number(chatDuration?.value || 15),
    topic: chatTopic?.value || '',
  };
}

function setRoomDeadline(expiresAt) {
  clearInterval(roomTimerInterval);
  if (!expiresAt) return;

  const update = () => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    setMeta(`채팅 남은 시간 · ${minutes}:${seconds}`);
    if (remaining <= 0) clearInterval(roomTimerInterval);
  };

  update();
  roomTimerInterval = setInterval(update, 1000);
}

function enforceBoundSession(serverEmail) {
  const localEmail = window.AuthSession?.getEmail();
  if (!serverEmail || !localEmail) return;

  if (serverEmail !== localEmail) {
    addMessage('계정 충돌이 감지되어 로그인 화면으로 이동합니다.', 'sys');
    window.AuthSession?.clearSession();
    setTimeout(() => {
      location.href = '/login';
    }, 500);
  }
}

socket.on('session_bound', (payload) => {
  enforceBoundSession(payload?.email);
});

function formatTime(value = new Date()) {
  const date = new Date(value);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function setStatus(text, tone = 'idle') {
  if (!chatStatus) return;
  chatStatus.textContent = text;
  chatStatus.classList.remove('status-ok', 'status-warn', 'status-error');
  if (tone === 'ok') chatStatus.classList.add('status-ok');
  if (tone === 'warn') chatStatus.classList.add('status-warn');
  if (tone === 'error') chatStatus.classList.add('status-error');
}

function setMeta(text) {
  if (!chatMeta) return;
  chatMeta.textContent = text;
}

function setAccountLabel() {
  if (!chatAccount) return;
  const email = window.AuthSession?.getEmail();
  const nickname = window.AuthSession?.getNickname();

  if (!email) {
    chatAccount.textContent = '현재 계정: 확인 불가';
    return;
  }

  chatAccount.textContent = nickname
    ? `현재 계정: ${email} · 닉네임: ${nickname}`
    : `현재 계정: ${email}`;
}

function syncControlState() {
  const inRoom = !!currentRoomName;
  if (startMatchBtn) startMatchBtn.disabled = isMatching || inRoom;
  if (friendRequestBtn) friendRequestBtn.disabled = !inRoom;
  if (friendAcceptBtn) friendAcceptBtn.disabled = !inRoom;
  if (chatInput) chatInput.disabled = !inRoom;
  if (chatSendBtn) chatSendBtn.disabled = !inRoom;

  if (chatInput) {
    chatInput.placeholder = inRoom ? '메시지 입력...' : '매칭 후 메시지를 입력할 수 있어요';
  }
}

function addMessage(text, kind = 'sys', at = new Date()) {
  if (!chatMessages) return;

  const li = document.createElement('li');
  li.className = `msg ${kind}`;

  if (kind === 'sys') {
    li.textContent = text;
  } else {
    const messageText = typeof text === 'object' ? text?.text || '' : text;
    const messageAt = typeof text === 'object' ? text?.sentAt || at : at;
    const content = document.createElement('div');
    const time = document.createElement('div');
    content.textContent = messageText;
    time.className = 'msg-time';
    time.textContent = formatTime(messageAt);
    li.append(content, time);
  }

  const nearBottom = chatMessages.scrollTop + 90 >= chatMessages.scrollHeight - chatMessages.clientHeight;
  chatMessages.appendChild(li);
  if (nearBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function resetRoomState() {
  currentRoomName = null;
  isMatching = false;
  clearInterval(roomTimerInterval);
  roomTimerInterval = null;
  friendAcceptBtn?.classList.add('hidden');
  friendRequestBtn?.classList.remove('hidden');
  syncControlState();
}

function silentLogin() {
  return window.AuthSession?.resumeSession() || Promise.resolve(false);
}

function leaveRoomAndGoLobby() {
  if (currentRoomName) {
    socket.emit('leave_room', currentRoomName);
  }
  resetRoomState();
  socket.disconnect();
  window.navigateTo('/lobby');
}

function startMatch() {
  if (isMatching || currentRoomName) return;

  const options = getChatOptions();
  const nickname = window.AuthSession?.getNickname() || 'Anonymous';
  socket.emit('nickname', nickname);

  isMatching = true;
  syncControlState();
  setStatus('매칭 중', 'warn');
  roomSubtitle.textContent = '대화 상대를 찾는 중입니다...';
  setMeta(`매칭 시작 · ${formatTime()}`);
  addMessage('매칭을 시작했습니다.', 'sys');

  socket.emit('enter_room', null, options.capacity, options, (roomName, roomExist, metadata) => {
    if (!roomName) {
      isMatching = false;
      setStatus('설정 오류', 'error');
      setMeta('채팅 설정을 확인해주세요.');
      syncControlState();
      return;
    }

    currentRoomName = roomName;
    setRoomDeadline(metadata?.expiresAt);
    const modeLabel = metadata?.mode === 'group' ? 'N:N' : '1:1';
    const topicLabel = metadata?.topic ? ` · ${metadata.topic}` : '';

    if (roomExist === '방 없음') {
      isMatching = true;
      setStatus('대기 중', 'warn');
      roomSubtitle.textContent = '아직 상대가 없어요. 잠시 기다려주세요.';
      setMeta(`대기 중 · ${modeLabel} · ${metadata?.duration || options.duration}분${topicLabel}`);
      syncControlState();
      return;
    }

    isMatching = false;
    setStatus('채팅 중', 'ok');
    roomSubtitle.textContent = `연결됨: ${roomName}`;
    setMeta(`채팅 시작 · ${modeLabel} · ${metadata?.duration || options.duration}분${topicLabel}`);
    syncControlState();
  });
}

socket.on('connect', () => {
  setStatus('연결됨', 'ok');
  setMeta(`소켓 연결 완료 · ${formatTime()}`);
});

socket.on('room_started', (metadata) => {
  setRoomDeadline(metadata?.expiresAt);
  setStatus('채팅 중', 'ok');
  setMeta(metadata?.topic ? `주제 · ${metadata.topic}` : '채팅이 시작되었습니다.');
});

socket.on('chat_expired', () => {
  addMessage('채팅 시간이 종료되었습니다.', 'sys');
  resetRoomState();
  setStatus('종료됨', 'warn');
  setMeta('채팅 시간이 종료되었습니다. 로비로 돌아가 새 채팅을 시작하세요.');
});

chatMode?.addEventListener('change', syncChatConfigOptions);
syncChatConfigOptions();

socket.on('disconnect', (reason) => {
  setStatus('연결 끊김', 'error');
  const reasonText = reason ? ` (${reason})` : '';
  setMeta(`연결이 끊겼습니다${reasonText}. 재연결 버튼을 눌러주세요.`);
  isMatching = false;
  syncControlState();
});

socket.on('connect_error', () => {
  setStatus('연결 오류', 'error');
  setMeta('서버 연결에 실패했습니다. 잠시 후 재시도해주세요.');
});

socket.on('join', (newCount) => {
  isMatching = false;
  setStatus('채팅 중', 'ok');
  roomSubtitle.textContent = `상대가 입장했습니다. 현재 ${newCount}명`;
  setMeta(`상대 입장 · ${formatTime()}`);
  syncControlState();
  addMessage('매칭 완료! 대화를 시작해보세요.', 'sys');
});

socket.on('welcome', (_user, newCount) => {
  isMatching = false;
  setStatus('채팅 중', 'ok');
  roomSubtitle.textContent = `현재 ${newCount}명 대화 중`;
  setMeta(`대화 연결 유지 중 · ${formatTime()}`);
  syncControlState();
});

socket.on('bye', () => {
  addMessage('상대방이 퇴장했습니다.', 'sys');
  setStatus('대기 중', 'warn');
  setMeta(`상대 퇴장 · ${formatTime()}`);
});

socket.on('new_message', (message) => {
  addMessage(message, 'them');
});

socket.on('friendRequest', () => {
  addMessage('상대가 친구 요청을 보냈습니다.', 'sys');
  friendAcceptBtn?.classList.remove('hidden');
  friendRequestBtn?.classList.add('hidden');
  syncControlState();
});

socket.on('FriendAdd', () => {
  addMessage('친구가 추가되었습니다!', 'sys');
});

socket.on('room_closed', () => {
  addMessage('방이 종료되었습니다. 로비로 돌아갑니다.', 'sys');
  resetRoomState();
  setTimeout(() => {
    socket.disconnect();
    window.navigateTo('/lobby');
  }, 900);
});

socket.on('force_logout', () => {
  addMessage('세션 충돌이 감지되어 로비로 이동합니다.', 'sys');
  resetRoomState();
  setStatus('로비 이동', 'warn');
  setMeta(`세션 보호 모드 · ${formatTime()}`);
  setTimeout(() => {
    location.href = '/lobby';
  }, 400);
});

startMatchBtn?.addEventListener('click', startMatch);

reconnectBtn?.addEventListener('click', async () => {
  setStatus('재연결 중', 'warn');
  setMeta('세션 확인 중...');
  const ok = await silentLogin();
  if (!ok) {
    setStatus('인증 필요', 'error');
    setMeta('로그인 정보가 없어 로그인 페이지로 이동합니다.');
    setTimeout(() => {
      location.href = '/login';
    }, 700);
    return;
  }
  setStatus('준비 완료', 'ok');
  setMeta(`재연결 완료 · ${formatTime()}`);
});

friendRequestBtn?.addEventListener('click', () => {
  if (!currentRoomName) return;
  socket.emit('friendRequest', currentRoomName, (result) => {
    if (result?.reason === 'already_friends') {
      addMessage('이미 친구입니다.', 'sys');
      return;
    }

    if (result?.success === false) {
      addMessage(result.error || '친구 요청을 보낼 수 없습니다.', 'sys');
      return;
    }

    addMessage('친구 요청을 보냈습니다.', 'sys');
  });
});

friendAcceptBtn?.addEventListener('click', () => {
  if (!currentRoomName) return;
  socket.emit('addFriend', currentRoomName, (result) => {
    if (result?.reason === 'already_friends') {
      addMessage('이미 친구입니다.', 'sys');
      return;
    }

    if (result?.success === false) {
      addMessage(result.error || '친구 추가에 실패했습니다.', 'sys');
    }
  });
});

leaveBtn?.addEventListener('click', leaveRoomAndGoLobby);

// 로고 클릭 시 beforeunload 보다 신뢰성 있는 명시적 처리
document.querySelector('.app-brand-logo-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (currentRoomName) {
    socket.emit('leave_room', currentRoomName);
  }
  resetRoomState();
  socket.disconnect();
  window.navigateTo('/');
});

chatForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput?.value?.trim();

  if (!text || !currentRoomName) return;

  socket.emit('new_message', text, currentRoomName, () => {
    addMessage(text, 'me');
  });
  chatInput.value = '';
});

window.addEventListener('beforeunload', () => {
  if (currentRoomName) {
    socket.emit('leave_room', currentRoomName);
  }
});

(async () => {
  resetRoomState();

  const ok = await silentLogin();
  if (!ok) {
    setStatus('인증 필요', 'error');
    addMessage('로그인 정보가 없어 로그인 페이지로 이동합니다.', 'sys');
    setTimeout(() => {
      location.href = '/login';
    }, 700);
    return;
  }

  setAccountLabel();

  setStatus('준비 완료', 'ok');
  setMeta('매칭 시작 버튼을 눌러 대화를 시작하세요.');
  addMessage('매칭 시작 버튼을 눌러 대화를 시작하세요.', 'sys');
})();
