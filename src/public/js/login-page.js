const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginMessage = document.getElementById('loginMessage');

if (window.AuthSession?.getEmail()) {
  loginEmail.value = window.AuthSession.getEmail() || '';
}

loginForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = loginEmail?.value?.trim();
  const password = loginPassword?.value;

  if (!email || !password) {
    loginMessage.textContent = '이메일/비밀번호를 입력하세요.';
    return;
  }

  loginMessage.textContent = '로그인 중...';
  window.AuthSession?.login(email, password)
    .then((response) => {
      if (response?.success) {
        loginMessage.textContent = '로그인 성공! 로비로 이동합니다.';
        location.href = '/lobby';
        return;
      }

      if (response?.error === 'session_conflict') {
        loginMessage.textContent = response.message || '현재 브라우저에 다른 계정이 로그인되어 있습니다. 기존 계정을 로그아웃한 뒤 다시 시도해주세요.';
        return;
      }

      loginMessage.textContent = '로그인 실패: 이메일 또는 비밀번호를 확인해주세요.';
    })
    .catch(() => {
      loginMessage.textContent = '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    });
});
