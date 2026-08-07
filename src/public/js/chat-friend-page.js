const socket = io('/oneonone');

const friendNameEl = document.getElementById('friendName');
const friendMessages = document.getElementById('friendMessages');
const friendChatForm = document.getElementById('friendChatForm');
const friendChatInput = document.getElementById('friendChatInput');
const friendMessage = document.getElementById('friendMessage');
const friendStatus = document.getElementById('friendStatus');
const friendMeta = document.getElementById('friendMeta');
const friendAccount = document.getElementById('friendAccount');
const refreshChatBtn = document.getElementById('refreshChatBtn');

const params = new URLSearchParams(location.search);
const friendName = params.get('friend') || '알 수 없음';
if (friendNameEl) friendNameEl.textContent = friendName;

let friendEmail = null;
let refreshTimer = null;

function enforceBoundSession(serverEmail) {
  const localEmail = window.AuthSession?.getEmail();
  if (!serverEmail || !localEmail) return;

  if (serverEmail !== localEmail) {
    setHelper('계정 충돌이 감지되어 로그인 화면으로 이동합니다.', 'error');
    window.AuthSession?.clearSession();
    setTimeout(() => {
      location.href = '/login';
    }, 500);
  }
}

socket.on('session_bound', (payload) => {
  enforceBoundSession(payload?.email);
});

function setStatus(text) {
  if (friendStatus) friendStatus.textContent = text;
}

function setAccountLabel() {
  if (!friendAccount) return;
  const email = window.AuthSession?.getEmail();
  const nickname = window.AuthSession?.getNickname();

  if (!email) {
    friendAccount.textContent = '현재 계정: 확인 불가';
    return;
  }

  friendAccount.textContent = nickname
    ? `현재 계정: ${email} · 닉네임: ${nickname}`
    : `현재 계정: ${email}`;
}

function setHelper(text, type = 'info') {
  if (!friendMessage) return;
  friendMessage.textContent = text;
  friendMessage.classList.remove('helper-success', 'helper-error');
  if (type === 'success') friendMessage.classList.add('helper-success');
  if (type === 'error') friendMessage.classList.add('helper-error');
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function pushMsg(text, kind = 'sys') {
  if (!friendMessages) return;
  const li = document.createElement('li');
  li.className = `msg ${kind}`;
  li.textContent = text;
  friendMessages.appendChild(li);
  friendMessages.scrollTop = friendMessages.scrollHeight;
}

function renderMessages(messages, myEmail) {
  if (!friendMessages) return;
  const previousTop = friendMessages.scrollTop;
  const previousHeight = friendMessages.scrollHeight;

  friendMessages.innerHTML = '';

  if (!Array.isArray(messages) || messages.length === 0) {
    pushMsg('아직 주고받은 메시지가 없습니다.', 'sys');
    if (friendMeta) friendMeta.textContent = '메시지 0개';
    return;
  }

  messages.forEach((m) => {
    const isMine = m?.sender_email && m.sender_email === myEmail;
    const li = document.createElement('li');
    li.className = `msg ${isMine ? 'me' : 'them'}`;
    li.innerHTML = `
      <div>${m?.message_content || ''}</div>
      <div class="msg-time">${formatTime(m?.sent_at)}</div>
    `;
    friendMessages.appendChild(li);
  });

  if (friendMeta) {
    friendMeta.textContent = `메시지 ${messages.length}개 · 마지막 동기화 ${formatTime(new Date())}`;
  }

  const nearBottom = previousTop + 80 >= previousHeight - friendMessages.clientHeight;
  if (nearBottom) {
    friendMessages.scrollTop = friendMessages.scrollHeight;
  } else {
    friendMessages.scrollTop = previousTop;
  }
}

function silentLogin() {
  return window.AuthSession?.resumeSession() || Promise.resolve(false);
}

function loadFriendChat() {
  const myEmail = window.AuthSession?.getEmail();
  setStatus('동기화 중');
  socket.emit('FriendChat', friendName, (results, fetchedEmail) => {
    friendEmail = fetchedEmail;
    renderMessages(results, myEmail);
    setStatus('연결됨');
  });
}

friendChatForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = friendChatInput?.value?.trim();
  const myEmail = window.AuthSession?.getEmail();

  if (!text || !friendEmail || !myEmail) {
    setHelper('메시지를 보낼 수 없습니다. 다시 시도해주세요.', 'error');
    return;
  }

  setHelper('전송 중...');
  socket.emit('new_note', text, friendEmail, myEmail, () => {
    friendChatInput.value = '';
    setHelper('전송 완료', 'success');
    loadFriendChat();
  });
});

refreshChatBtn?.addEventListener('click', () => {
  loadFriendChat();
});

socket.on('force_logout', () => {
  setStatus('로비 이동');
  setHelper('세션 충돌이 감지되어 로비로 이동합니다.', 'error');
  setTimeout(() => {
    window.navigateTo('/lobby');
  }, 400);
});

(async () => {
  setStatus('연결 중');
  const ok = await silentLogin();
  if (!ok) {
    location.href = '/login';
    return;
  }

  setAccountLabel();
  loadFriendChat();
  refreshTimer = setInterval(loadFriendChat, 5000);
})();

window.addEventListener('beforeunload', () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});
