(function () {
  const KEY_EMAIL = 'uc_email';
  const KEY_NICKNAME = 'uc_nickname';

  function nicknameKey(email) {
    return email ? `${KEY_NICKNAME}:${email}` : KEY_NICKNAME;
  }

  function getNicknameForEmail(email, allowLegacyFallback = true) {
    if (!email) return sessionStorage.getItem(KEY_NICKNAME);

    const scopedNickname = sessionStorage.getItem(nicknameKey(email));
    if (scopedNickname) return scopedNickname;

    return allowLegacyFallback ? sessionStorage.getItem(KEY_NICKNAME) : null;
  }

  function setSession({ email, nickname }) {
    const previousEmail = sessionStorage.getItem(KEY_EMAIL);

    if (email) {
      sessionStorage.setItem(KEY_EMAIL, email);
    }

    const resolvedEmail = email || sessionStorage.getItem(KEY_EMAIL);

    if (previousEmail && email && previousEmail !== email) {
      sessionStorage.removeItem(KEY_NICKNAME);
    }

    const resolvedNickname = nickname || getNicknameForEmail(resolvedEmail, false);

    if (resolvedNickname) {
      sessionStorage.setItem(KEY_NICKNAME, resolvedNickname);
      if (resolvedEmail) {
        sessionStorage.setItem(nicknameKey(resolvedEmail), resolvedNickname);
      }
    }
  }

  function setNickname(nickname) {
    if (!nickname) return;
    const email = getEmail();
    sessionStorage.setItem(KEY_NICKNAME, nickname);
    if (email) {
      sessionStorage.setItem(nicknameKey(email), nickname);
    }
  }

  function getEmail() {
    return sessionStorage.getItem(KEY_EMAIL);
  }

  function getNickname() {
    return getNicknameForEmail(getEmail());
  }

  function clearSession() {
    sessionStorage.removeItem(KEY_EMAIL);
    sessionStorage.removeItem(KEY_NICKNAME);
    // legacy key cleanup
    sessionStorage.removeItem('uc_session_token');
    sessionStorage.removeItem('uc_password');
  }

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return {
        success: false,
        error: data?.error,
        message: data?.message,
      };
    }
    const data = await res.json();
    if (data?.success) {
      setSession({ email: data.email || email });
    }
    return data;
  }

  async function resumeSession() {
    const currentEmail = getEmail();

    // 탭에 저장된 기준 계정이 없으면 자동 세션 채택을 하지 않습니다.
    // (다른 탭/창에서 로그인된 쿠키 계정을 의도치 않게 가져오는 문제 방지)
    if (!currentEmail) {
      clearSession();
      return false;
    }

    const res = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) {
      clearSession();
      return false;
    }

    const data = await res.json();
    if (!data?.success) {
      clearSession();
      return false;
    }

    if (currentEmail && data.email && currentEmail !== data.email) {
      // 다른 계정으로의 자동 전환은 허용하지 않습니다.
      // 계정 충돌 상황에서는 재로그인을 요구해 의도치 않은 계정 스위칭을 방지합니다.
      clearSession();
      return false;
    }

    setSession({ email: currentEmail, nickname: getNicknameForEmail(currentEmail, false) });
    return true;
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      clearSession();
    }
  }

  window.AuthSession = {
    setSession,
    setNickname,
    getEmail,
    getNickname,
    clearSession,
    login,
    resumeSession,
    logout,
  };
})();

// 페이지 이동 시 fade-out 후 navigate
window.navigateTo = function (url) {
  const wrap = document.querySelector('.app-page-wrap');
  if (wrap) {
    wrap.classList.add('app-fade-out');
    setTimeout(() => { location.href = url; }, 220);
  } else {
    location.href = url;
  }
};
