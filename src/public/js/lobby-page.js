const socket = io('/oneonone');

const lobbyStatus = document.getElementById('lobbyStatus');
const lobbyMessage = document.getElementById('lobbyMessage');
const lobbyUserName = document.getElementById('lobbyUserName');
const friendList = document.getElementById('friendList');
const startRandomBtn = document.getElementById('startRandomBtn');
const lobbyNickname = document.getElementById('lobbyNickname');
const logoutBtn = document.getElementById('logoutBtn');

function enforceBoundSession(serverEmail) {
  const localEmail = window.AuthSession?.getEmail();
  if (!serverEmail || !localEmail) return;

  if (serverEmail !== localEmail) {
    window.AuthSession?.clearSession();
    if (lobbyMessage) {
      lobbyMessage.textContent = '계정 충돌이 감지되어 로그인 화면으로 이동합니다.';
    }
    setTimeout(() => {
      location.href = '/login';
    }, 500);
  }
}

socket.on('session_bound', (payload) => {
  enforceBoundSession(payload?.email);
});

function setStatus(text) {
  if (!lobbyStatus) return;
  lobbyStatus.textContent = text;
}

function silentLogin() {
  return window.AuthSession?.resumeSession() || Promise.resolve(false);
}

function renderFriends(list) {
  if (!friendList) return;

  const friends = Array.isArray(list) ? list : [];
  if (friends.length === 0) {
    friendList.innerHTML = '<li class="friend-item"><span>아직 친구가 없어요.</span></li>';
    return;
  }

  friendList.innerHTML = '';
  friends.forEach((friendName) => {
    const li = document.createElement('li');
    li.className = 'friend-item';

    const name = document.createElement('span');
    name.textContent = friendName;

    const go = document.createElement('a');
    go.href = `/chat/friend?friend=${encodeURIComponent(friendName)}`;
    go.textContent = '채팅';

    li.appendChild(name);
    li.appendChild(go);
    friendList.appendChild(li);
  });
}

async function init() {
  setStatus('연결 중...');
  const ok = await silentLogin();

  if (!ok) {
    setStatus('인증 필요');
    if (lobbyMessage) lobbyMessage.textContent = '로그인 정보가 없어 로그인 화면으로 이동합니다.';
    setTimeout(() => {
      location.href = '/login';
    }, 600);
    return;
  }

  setStatus('로비');

  const email = window.AuthSession?.getEmail();
  const savedNickname = window.AuthSession?.getNickname();

  if (lobbyUserName && email) {
    lobbyUserName.textContent = email;
  }

  if (lobbyNickname) {
    lobbyNickname.value = savedNickname || '';
  }

  socket.emit('ShowFriend', (friends) => {
    renderFriends(friends);
  });
}

startRandomBtn?.addEventListener('click', () => {
  const nickname = lobbyNickname?.value?.trim();
  if (!nickname) {
    if (lobbyMessage) lobbyMessage.textContent = '닉네임을 입력해주세요.';
    return;
  }

  window.AuthSession?.setNickname(nickname);
  window.navigateTo('/chat/random');
});

logoutBtn?.addEventListener('click', () => {
  const email = window.AuthSession?.getEmail();

  const goLogin = async () => {
    await window.AuthSession?.logout();
    window.navigateTo('/login');
  };

  if (email) {
    socket.emit('logout', async () => {
      await goLogin();
    });
    return;
  }

  goLogin();
});

init();
