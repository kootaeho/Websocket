const socket = io('/oneonone');

const signupForm = document.getElementById('signupForm');
const signupSchool = document.getElementById('signupSchool');
const signupEmail = document.getElementById('signupEmail');
const signupCode = document.getElementById('signupCode');
const signupPassword = document.getElementById('signupPassword');
const signupNickname = document.getElementById('signupNickname');
const sendCodeBtn = document.getElementById('sendCodeBtn');
const verifyCodeBtn = document.getElementById('verifyCodeBtn');
const signupMessage = document.getElementById('signupMessage');
const codeStep = document.getElementById('codeStep');
const accountStep = document.getElementById('accountStep');

let isCodeVerified = false;

function setupPasswordToggle() {
  const toggles = document.querySelectorAll('[data-password-toggle]');
  toggles.forEach((toggleBtn) => {
    const inputId = toggleBtn.getAttribute('data-password-toggle');
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;

    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      toggleBtn.classList.toggle('is-visible', isPassword);
      toggleBtn.textContent = isPassword ? '🙈' : '👁';
      toggleBtn.setAttribute('aria-pressed', String(isPassword));
      toggleBtn.setAttribute('aria-label', isPassword ? '비밀번호 숨기기' : '비밀번호 보기');
      passwordInput.focus();
      passwordInput.setSelectionRange(passwordInput.value.length, passwordInput.value.length);
    });
  });
}

setupPasswordToggle();

function setMessage(text, type = 'info') {
  if (!signupMessage) return;
  signupMessage.textContent = text;
  signupMessage.classList.remove('helper-success', 'helper-error');
  if (type === 'success') signupMessage.classList.add('helper-success');
  if (type === 'error') signupMessage.classList.add('helper-error');
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', hidden);
}

function resetVerificationFlow() {
  isCodeVerified = false;
  setHidden(accountStep, true);
}

setHidden(codeStep, true);
setHidden(accountStep, true);

signupSchool?.addEventListener('input', resetVerificationFlow);
signupEmail?.addEventListener('input', () => {
  resetVerificationFlow();
  setHidden(codeStep, true);
});

sendCodeBtn?.addEventListener('click', () => {
  const email = signupEmail?.value?.trim();
  const school = signupSchool?.value?.trim();

  if (!email || !school) {
    setMessage('학교명과 이메일을 먼저 입력해주세요.', 'error');
    return;
  }

  sendCodeBtn.disabled = true;
  setMessage('인증코드를 발송하고 있어요...');
  socket.emit('certify_email', email, school, (response) => {
    sendCodeBtn.disabled = false;
    if (response?.success) {
      setHidden(codeStep, false);
      signupCode?.focus();
      setMessage('인증코드가 발송되었습니다. 메일함을 확인해주세요.', 'success');
      return;
    }

    if (response?.error?.message === '이미 완료된 요청입니다.') {
      setHidden(codeStep, false);
      signupCode?.focus();
      setMessage('이미 인증이 완료된 이메일입니다. 코드 확인 후 진행하세요.', 'success');
      return;
    }

    setMessage('인증코드 발송에 실패했습니다.', 'error');
  });
});

verifyCodeBtn?.addEventListener('click', () => {
  const email = signupEmail?.value?.trim();
  const code = signupCode?.value?.trim();

  if (!email || !code) {
    setMessage('이메일과 인증코드를 입력해주세요.', 'error');
    return;
  }

  verifyCodeBtn.disabled = true;
  setMessage('인증코드를 확인하고 있어요...');
  socket.emit('verify_code', email, code, (response) => {
    verifyCodeBtn.disabled = false;
    if (response?.success) {
      isCodeVerified = true;
      setHidden(accountStep, false);
      signupPassword?.focus();
      setMessage('이메일 인증이 완료되었습니다.', 'success');
      return;
    }

    isCodeVerified = false;
    setHidden(accountStep, true);
    setMessage('인증코드가 유효하지 않습니다.', 'error');
  });
});

signupForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = signupEmail?.value?.trim();
  const password = signupPassword?.value;
  const nickname = signupNickname?.value?.trim();

  if (!isCodeVerified) {
    setMessage('이메일 인증을 먼저 완료해주세요.', 'error');
    return;
  }

  if (!email || !password || !nickname) {
    setMessage('필수 항목을 모두 입력해주세요.', 'error');
    return;
  }

  setMessage('회원가입 처리 중...');
  socket.emit('adduser', email, password, nickname, async (response) => {
    if (response?.success) {
      try {
        const loginResponse = await window.AuthSession?.login(email, password);
        if (loginResponse?.success) {
          window.AuthSession?.setNickname(nickname);
          setMessage('가입이 완료되었습니다. 로비로 이동합니다.', 'success');
          setTimeout(() => {
            location.href = '/lobby';
          }, 400);
          return;
        }
      } catch {
        // noop
      }

      setMessage('가입은 완료되었지만 자동 로그인에 실패했습니다. 로그인 페이지로 이동합니다.', 'error');
      setTimeout(() => {
        location.href = '/login';
      }, 700);
      return;
    }

    setMessage('회원가입에 실패했습니다. 이미 가입된 이메일인지 확인해주세요.', 'error');
  });
});
