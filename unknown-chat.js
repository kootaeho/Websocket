/* ══════════════════════════════════════════
   CHAT FLOW ENGINE
══════════════════════════════════════════ */

// ── State ──
const CF = {
  mode: '1v1',
  time: 15,
  school: '',
  step: 0,
  matchAvatar: '',
  matchSchool: '',
  matchDept: '',
  chatMsgCount: 0,
  chatStartSec: 0,
  chatElapsedSec: 0,
  chatTimerInterval: null,
  chatTimerTotal: 0,
  cfStar: 0,
  cfExtend: null,
  issueIdx: 0,
};

const SCHOOLS = [
  // 서울
  '서울대학교','연세대학교','고려대학교','성균관대학교','한양대학교','이화여자대학교','서강대학교','중앙대학교','경희대학교','한국외국어대학교',
  '홍익대학교','건국대학교','동국대학교','숙명여자대학교','국민대학교','광운대학교','명지대학교','상명대학교','세종대학교','숭실대학교',
  '한성대학교','한양여자대학교','덕성여자대학교','동덕여자대학교','서울여자대학교','성신여자대학교','KC대학교','감리교신학대학교',
  '강서대학교','기독대학교','대신대학교','루터대학교','서울기독대학교','서울신학대학교','서울한영대학교','성공회대학교',
  '장로회신학대학교','총신대학교','추계예술대학교','한국성서대학교','한국예술종합학교','한국체육대학교','한국방송통신대학교',
  // 경기·인천
  '인하대학교','아주대학교','경기대학교','단국대학교','가천대학교','차의과학대학교','한국항공대학교','한국산업기술대학교',
  '성결대학교','수원대학교','협성대학교','평택대학교','을지대학교','신한대학교','용인대학교','대진대학교','강남대학교',
  '안양대학교','루터대학교','칼빈대학교','한세대학교','한신대학교','수원가톨릭대학교','성균관대학교 수원캠퍼스',
  // 강원
  '강원대학교','연세대학교 미래캠퍼스','한림대학교','춘천교육대학교','강원교육대학교','상지대학교','가톨릭관동대학교',
  '경동대학교','금강대학교','강릉원주대학교',
  // 충청
  '충남대학교','충북대학교','한국교원대학교','청주대학교','서원대학교','충주대학교','건국대학교 글로컬캠퍼스','극동대학교',
  '세명대학교','중원대학교','유원대학교','꽃동네대학교','한국기술교육대학교','나사렛대학교','남서울대학교','단국대학교 천안캠퍼스',
  '백석대학교','선문대학교','순천향대학교','호서대학교','공주교육대학교','공주대학교','청운대학교','한국전통문화대학교',
  // 대전·세종
  '카이스트','충남대학교','한남대학교','배재대학교','대전대학교','목원대학교','우송대학교','한밭대학교','을지대학교 대전캠퍼스',
  // 전라
  '전북대학교','원광대학교','전주대학교','예수대학교','한일장신대학교','우석대학교','군산대학교','호원대학교',
  '전남대학교','조선대학교','동신대학교','광주대학교','호남대학교','남부대학교','광주여자대학교','광신대학교',
  '목포대학교','순천대학교','여수대학교','초당대학교','한려대학교',
  // 광주
  '광주교육대학교',
  // 대구·경북
  '경북대학교','포스텍','영남대학교','계명대학교','대구대학교','경일대학교','경성대학교','대구가톨릭대학교',
  '대구한의대학교','대구교육대학교','금오공과대학교','동양대학교','안동대학교','위덕대학교','경주대학교',
  '경운대학교','경북도립대학교','군위대학교','상주대학교','한동대학교',
  // 부산·울산·경남
  '부산대학교','부경대학교','동아대학교','부산외국어대학교','동의대학교','신라대학교','고신대학교','경성대학교',
  '부산교육대학교','울산대학교','UNIST','경남대학교','창원대학교','인제대학교','한국국제대학교','경남교육대학교',
  '진주교육대학교','경상국립대학교','영산대학교','가야대학교',
  // 제주
  '제주대학교','제주국제대학교',
  // 기타 특수·전문
  '한국과학기술원','광주과학기술원','대구경북과학기술원','울산과학기술원','포항공과대학교',
  '육군사관학교','해군사관학교','공군사관학교','경찰대학교','사관학교','한국방위산업학교',
];

const PARTNERS = [
  { avatar: '연', school: '연세대학교', dept: '경영학과' },
  { avatar: '성', school: '성균관대학교', dept: '컴퓨터공학과' },
  { avatar: '이', school: '이화여자대학교', dept: '심리학과' },
  { avatar: '한', school: '한양대학교', dept: '기계공학과' },
  { avatar: '서', school: '서강대학교', dept: '미디어학과' },
  { avatar: '중', school: '중앙대학교', dept: '국문학과' },
];

const ISSUES = [
  { q: '최근 취업 시장이 어렵다는 느낌을 받고 있나요?', opts: ['😓 많이 느껴요','🤔 그럭저럭요','😤 별로요'], result: '응답자의 72%가 "많이 느껴요"를 선택했어요. 함께 대화 나눠봐요!' },
  { q: '요즘 학교생활에서 가장 스트레스 받는 건 뭔가요?', opts: ['📝 학점/과제','💰 생활비','👥 인간관계','🤷 모르겠어요'], result: '학점/과제와 생활비가 공동 1위! 다들 힘들군요 😅' },
  { q: '교환학생 혹은 해외 경험, 계획하고 있나요?', opts: ['✈️ 곧 갈 예정','🤔 고민 중','❌ 생각 없어요'], result: '절반 이상이 해외 경험을 계획 중이에요! 같이 얘기해봐요 ✈️' },
  { q: '대학 졸업 후 진로, 어느 정도 정했나요?', opts: ['✅ 확실해요','🔄 대략 정함','❓ 아직 몰라요'], result: '아직 확실히 모르는 분들이 제일 많아요. 다 같이 고민 중!😄' },
];

const BOT_REPLIES = [
  '오 진짜요? 저도 비슷한 생각이에요 ㅎㅎ',
  '와 그렇군요! 저는 좀 달랐는데 신기하네요',
  '맞아요 요즘 그런 얘기 많이 들려요 😅',
  '혹시 관련해서 더 얘기해줄 수 있어요?',
  '저도 그게 고민이에요... 어떻게 하셨어요?',
  '진짜요?? 처음 들어보는 얘기다 ㅋㅋㅋ',
  '공감 100% 해요!! 특히 요즘 더 심한 것 같아요',
  '흥미롭네요 😮 좀 더 얘기해봐요!',
];

function getRandPartner() {
  return PARTNERS[Math.floor(Math.random() * PARTNERS.length)];
}

// ── Open / close ──
function openChatFlow() {
  document.getElementById('chatFlow').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  goCfStep(0);
}
function closeChatFlow() {
  document.getElementById('chatFlow').style.display = 'none';
  document.body.style.overflow = '';
  clearInterval(CF.chatTimerInterval);
}

// ── Step navigation ──
function goCfStep(n) {
  for (let i = 0; i <= 5; i++) {
    const s = document.getElementById(`cf-s${i}`);
    if (s) s.style.display = 'none';
  }
  const target = document.getElementById(`cf-s${n}`);
  if (!target) return;
  target.style.display = 'flex';
  target.classList.remove('cf-screen-enter');
  void target.offsetWidth; // reflow
  target.classList.add('cf-screen-enter');
  CF.step = n;

  if (n === 1) startSearch();
  if (n === 2) showMatch();
  if (n === 3) startChat();
  if (n === 4) showExtend();
  if (n === 5) showEnd();
}

// ── STEP 0: Config ──
function setCfMode(m) {
  CF.mode = m;
  document.getElementById('cfMode1v1').classList.toggle('active', m === '1v1');
  document.getElementById('cfModeNvN').classList.toggle('active', m === 'nvn');
  // Update time options for nvn
  const row = document.getElementById('cfTimeRow');
  if (m === 'nvn') {
    row.innerHTML = `
      <div class="cf-time-btn" onclick="setCfTime(this,10)">10분</div>
      <div class="cf-time-btn active" onclick="setCfTime(this,20)">20분 <span class="cf-default">기본</span></div>
      <div class="cf-time-btn" onclick="setCfTime(this,30)">30분</div>`;
    CF.time = 20;
  } else {
    row.innerHTML = `
      <div class="cf-time-btn" onclick="setCfTime(this,5)">5분</div>
      <div class="cf-time-btn active" onclick="setCfTime(this,15)">15분 <span class="cf-default">기본</span></div>
      <div class="cf-time-btn" onclick="setCfTime(this,25)">25분</div>`;
    CF.time = 15;
  }
}
function setCfTime(el, t) {
  document.querySelectorAll('.cf-time-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  CF.time = t;
}
function filterSchools(v) {
  const drop = document.getElementById('cfSchoolDropdown');
  const q = v.trim();
  if (!q) { drop.classList.remove('open'); return; }
  const matches = SCHOOLS.filter(s => s.includes(q)).slice(0, 8);
  if (!matches.length) {
    drop.innerHTML = '<div class="cf-school-item" style="color:var(--gray3);cursor:default;">검색 결과가 없어요</div>';
    drop.classList.add('open');
    return;
  }
  drop.innerHTML = matches.map(s => {
    const highlighted = s.replace(q, `<strong style="color:var(--red)">${q}</strong>`);
    return `<div class="cf-school-item" onclick="selectSchool('${s}')">${highlighted}</div>`;
  }).join('');
  drop.classList.add('open');
}
function selectSchool(name) {
  CF.school = name;
  document.getElementById('cfSchoolInput').value = name;
  document.getElementById('cfSchoolDropdown').classList.remove('open');
  const badge = document.getElementById('cfSchoolBadge');
  badge.textContent = `🏫 ${name}`;
  badge.style.display = 'block';
  document.getElementById('cfStartBtn').disabled = false;
}

// ── STEP 1: Search ──
let searchCountInterval, searchTimer;
function startSearch() {
  CF.issueIdx = 0;
  loadIssue(CF.issueIdx);
  let count = 0;
  const countEl = document.getElementById('cfSearchCount');
  searchCountInterval = setInterval(() => {
    count += Math.floor(Math.random() * 80) + 30;
    if (count > 1243) count = 1243;
    countEl.textContent = count.toLocaleString();
  }, 120);
  // Auto match after 4s
  searchTimer = setTimeout(() => {
    clearInterval(searchCountInterval);
    goCfStep(2);
  }, 4500);
}
function cancelSearch() {
  clearInterval(searchCountInterval);
  clearTimeout(searchTimer);
  goCfStep(0);
}

// Issues
function loadIssue(idx) {
  const issue = ISSUES[idx % ISSUES.length];
  document.getElementById('cfIssueQ').textContent = issue.q;
  const optsEl = document.getElementById('cfIssueOpts');
  optsEl.style.display = 'flex';
  optsEl.innerHTML = issue.opts.map(o => `<button class="cf-issue-opt" onclick="pickIssue(this)">${o}</button>`).join('');
  document.getElementById('cfIssueResult').style.display = 'none';
  document.getElementById('cfIssueNextBtn').style.display = 'none';
  document.getElementById('cfIssueCard').querySelector('.cf-issue-tag').textContent = idx === 0 ? '🔥 오늘의 이슈' : `💬 질문 ${idx + 1}`;
}
function pickIssue(el) {
  document.querySelectorAll('.cf-issue-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  const issue = ISSUES[CF.issueIdx % ISSUES.length];
  const res = document.getElementById('cfIssueResult');
  res.textContent = issue.result;
  res.style.display = 'block';
  document.getElementById('cfIssueNextBtn').style.display = 'inline-block';
}
function nextIssue() {
  CF.issueIdx++;
  loadIssue(CF.issueIdx);
}

// ── STEP 2: Match ──
function showMatch() {
  const p = getRandPartner();
  CF.matchAvatar = p.avatar;
  CF.matchSchool = p.school;
  CF.matchDept = p.dept;
  document.getElementById('cfMatchAvatar').textContent = p.avatar;
  document.getElementById('cfMatchSchool').textContent = `🏫 ${p.school}`;
  document.getElementById('cfMatchDept').textContent = p.dept;
  document.getElementById('cfMatchTime').textContent = `⏱ ${CF.time}분 채팅`;
  const topics = ISSUES[CF.issueIdx % ISSUES.length];
  document.getElementById('cfMatchTopic').textContent = `"${topics.q.substring(0, 28)}..." 로 대화를 시작해보세요!`;
}

// ── STEP 3: Chat ──
function startChat() {
  clearInterval(CF.chatTimerInterval);
  CF.chatMsgCount = 0;
  CF.chatTimerTotal = CF.time * 60;
  CF.chatStartSec = CF.chatTimerTotal;
  CF.chatElapsedSec = 0;

  document.getElementById('cfChatAvatarSm').textContent = CF.matchAvatar;
  document.getElementById('cfChatPartner').textContent = CF.matchSchool;
  document.getElementById('cfChatSchoolSm').textContent = `🏫 ${CF.matchSchool} · ${CF.matchDept}`;

  const body = document.getElementById('cfChatBody');
  body.innerHTML = `<div class="cf-chat-date">오늘</div><div class="cf-msg-system">채팅이 시작됐어요 👋 먼저 인사해보세요!</div>`;

  // Timer
  let remaining = CF.chatTimerTotal;
  updateChatTimer(remaining, CF.chatTimerTotal);
  CF.chatTimerInterval = setInterval(() => {
    remaining--;
    CF.chatElapsedSec++;
    updateChatTimer(remaining, CF.chatTimerTotal);
    if (remaining <= 0) {
      clearInterval(CF.chatTimerInterval);
      setTimeout(() => goCfStep(4), 600);
    }
    // Warning flash at 60s
    if (remaining === 60) {
      document.getElementById('cfChatTimer').style.animation = 'none';
      addSystemMsg('⚠️ 1분 남았어요!');
    }
  }, 1000);

  // Greeting from partner after 1.5s
  setTimeout(() => {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addBotMsg(`안녕하세요! 저는 ${CF.matchSchool} ${CF.matchDept} 학생이에요 😊`);
    }, 1800);
  }, 1500);
}

function updateChatTimer(remaining, total) {
  const m = Math.floor(remaining / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');
  document.getElementById('cfChatTimer').textContent = `${m}:${s}`;
  const pct = Math.max(0, (remaining / total) * 100);
  document.getElementById('cfChatTimerBar').style.width = pct + '%';
  // Color shift
  const bar = document.getElementById('cfChatTimerBar');
  if (pct < 20) bar.style.background = '#ef4444';
  else if (pct < 40) bar.style.background = '#f97316';
  else bar.style.background = 'var(--red)';
}

let typingEl = null;
function showTyping() {
  const body = document.getElementById('cfChatBody');
  typingEl = document.createElement('div');
  typingEl.className = 'cf-msg them';
  typingEl.id = 'cfTypingBubble';
  typingEl.innerHTML = `<div class="cf-msg-school">🏫 ${CF.matchSchool}</div><div class="cf-typing"><span></span><span></span><span></span></div>`;
  body.appendChild(typingEl);
  body.scrollTop = body.scrollHeight;
}
function hideTyping() {
  const t = document.getElementById('cfTypingBubble');
  if (t) t.remove();
}
function addBotMsg(text) {
  const body = document.getElementById('cfChatBody');
  const now = new Date();
  const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
  const el = document.createElement('div');
  el.className = 'cf-msg them';
  el.innerHTML = `<div class="cf-msg-school">🏫 ${CF.matchSchool}</div><div class="cf-msg-bubble">${text}</div><div class="cf-msg-time">${time}</div>`;
  body.appendChild(el);
  CF.chatMsgCount++;
  body.scrollTop = body.scrollHeight;
}
function addSystemMsg(text) {
  const body = document.getElementById('cfChatBody');
  const el = document.createElement('div');
  el.className = 'cf-msg-system';
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}
function sendChatMsg() {
  const input = document.getElementById('cfChatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const body = document.getElementById('cfChatBody');
  const now = new Date();
  const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
  const el = document.createElement('div');
  el.className = 'cf-msg me';
  el.innerHTML = `<div class="cf-msg-bubble">${text}</div><div class="cf-msg-time">${time}</div>`;
  body.appendChild(el);
  CF.chatMsgCount++;
  body.scrollTop = body.scrollHeight;

  // Bot auto-reply
  setTimeout(() => {
    showTyping();
    const delay = 1200 + Math.random() * 1200;
    setTimeout(() => {
      hideTyping();
      const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      addBotMsg(reply);
    }, delay);
  }, 600);
}

function toggleEmojiPicker() {
  const p = document.getElementById('cfEmojiPicker');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.cf-emoji-btn') && !e.target.closest('.cf-emoji-picker')) {
    const p = document.getElementById('cfEmojiPicker');
    if (p) p.style.display = 'none';
  }
});
// Emoji click
document.addEventListener('click', (e) => {
  const p = document.getElementById('cfEmojiPicker');
  if (p && e.target.closest('.cf-emoji-picker') && e.target.textContent.trim().length <= 2) {
    const input = document.getElementById('cfChatInput');
    if (input) { input.value += e.target.textContent.trim(); input.focus(); }
  }
});

// ── STEP 4: Extend ──
function showExtend() {
  clearInterval(CF.chatTimerInterval);
  CF.cfStar = 0;
  CF.cfExtend = null;
  document.querySelectorAll('.cf-star').forEach(s => s.textContent = '☆');
  document.getElementById('cfStarLabel').textContent = '별점을 선택해주세요';
  document.getElementById('cfExtendInfo').style.display = 'none';
  document.getElementById('cfExtendConfirmBtn').disabled = true;
  document.querySelector('.cf-swipe-no').classList.remove('chosen');
  document.querySelector('.cf-swipe-yes').classList.remove('chosen');
  document.getElementById('cfExtendStatus').textContent = '?';
}
function setCfStar(n) {
  CF.cfStar = n;
  document.querySelectorAll('.cf-star').forEach((s, i) => s.textContent = i < n ? '★' : '☆');
  const labels = ['', '별로였어요 😐', '그냥 그랬어요', '보통이었어요 🙂', '좋았어요 😊', '최고였어요! 🌟'];
  document.getElementById('cfStarLabel').textContent = labels[n];
  document.getElementById('cfExtendInfo').style.display = n >= 4 ? 'block' : 'none';
  checkExtendReady();
}
function setCfExtend(v) {
  CF.cfExtend = v;
  document.querySelector('.cf-swipe-no').classList.toggle('chosen', v === 'no');
  document.querySelector('.cf-swipe-yes').classList.toggle('chosen', v === 'yes');
  document.getElementById('cfExtendStatus').textContent = v === 'yes' ? '💚' : '🩶';
  checkExtendReady();
}
function checkExtendReady() {
  document.getElementById('cfExtendConfirmBtn').disabled = !(CF.cfStar > 0 && CF.cfExtend !== null);
}
function confirmExtend() {
  const extended = CF.cfExtend === 'yes' && CF.cfStar >= 4;
  if (extended) {
    // Simulate partner also said yes
    const partnerYes = Math.random() > 0.3;
    if (partnerYes) {
      // Add 5 more minutes and go back to chat
      CF.time += 5;
      addSystemMsg(`✨ 상대방도 연장을 원해요! +5분 연장됩니다`);
      goCfStep(3);
      return;
    }
  }
  goCfStep(5);
}

// ── STEP 5: End ──
function showEnd() {
  const mins = Math.floor(CF.chatElapsedSec / 60) || CF.time;
  document.getElementById('cfEndTime').textContent = `${mins}분`;
  document.getElementById('cfEndMsgs').textContent = `${CF.chatMsgCount}개`;
  document.getElementById('cfEndRating').textContent = CF.cfStar ? `${CF.cfStar}점` : '-';

  if (CF.cfExtend === 'yes') {
    document.getElementById('cfEndEmoji').textContent = '🤝';
    document.getElementById('cfEndTitle').textContent = '좋은 대화였어요!';
    document.getElementById('cfEndSub').textContent = '연장을 원하셨군요! 다음엔 서로 Yes가 되길 바라요 💫';
  } else {
    document.getElementById('cfEndEmoji').textContent = '👋';
    document.getElementById('cfEndTitle').textContent = '대화가 끝났어요';
    document.getElementById('cfEndSub').textContent = '오늘도 새로운 인연과 이야기 나눴어요!';
  }
}

// Close on backdrop click
document.getElementById('chatFlow').addEventListener('click', (e) => {
  if (e.target === document.getElementById('chatFlow')) closeChatFlow();
});

// STEP 0 enter key for school
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeChatFlow();
});

// ── NAV scroll effect ──
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 10);
});

// ── Mobile menu ──
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('mobileMenu').classList.remove('open');
}

// ── Scroll reveal ──
const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.12 });
reveals.forEach(el => io.observe(el));

// ── Count-up animation ──
function animateCount(el, target, isFloat) {
  const duration = 1800;
  const start = performance.now();
  const update = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const value = ease * target;
    el.textContent = isFloat ? value.toFixed(1) : Math.floor(value).toLocaleString();
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
const statNums = document.querySelectorAll('.stat-num[data-target]');
const statIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const target = parseFloat(e.target.dataset.target);
      animateCount(e.target, target, target < 100);
      statIO.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
statNums.forEach(el => statIO.observe(el));

// ── Hero timer countdown ──
let heroSec = 527;
const timerEl = document.getElementById('heroTimer');
setInterval(() => {
  if (heroSec <= 0) heroSec = 900;
  heroSec--;
  const m = Math.floor(heroSec / 60).toString().padStart(2, '0');
  const s = (heroSec % 60).toString().padStart(2, '0');
  if (timerEl) timerEl.textContent = `${m}:${s}`;
}, 1000);

// ── Mock timer ──
let mockSec1 = 753;
const mockT1 = document.getElementById('mockTimer1');
setInterval(() => {
  if (!mockT1) return;
  mockSec1--;
  if (mockSec1 < 0) mockSec1 = 900;
  const m = Math.floor(mockSec1 / 60).toString().padStart(2, '0');
  const s = (mockSec1 % 60).toString().padStart(2, '0');
  mockT1.textContent = `${m}:${s}`;
}, 1000);

// ── Online count animation ──
const ocEl = document.getElementById('onlineCount');
setInterval(() => {
  const base = 1243;
  const delta = Math.floor(Math.random() * 20) - 10;
  ocEl.textContent = (base + delta).toLocaleString();
}, 4000);

// ── Mode tabs ──
function switchMode(mode) {
  document.querySelectorAll('.mode-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && mode === 'one') || (i === 1 && mode === 'group'));
  });
  document.getElementById('mode-one').classList.toggle('active', mode === 'one');
  document.getElementById('mode-group').classList.toggle('active', mode === 'group');
}

// ── Time pills ──
function selectTime(el) {
  el.closest('.mode-time-options').querySelectorAll('.time-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

// ── Stars ──
const stars = document.querySelectorAll('.star');
function rateStar(n) {
  stars.forEach((s, i) => { s.textContent = i < n ? '★' : '☆'; });
}
stars.forEach((s, i) => {
  s.addEventListener('mouseover', () => stars.forEach((st, j) => st.textContent = j <= i ? '★' : '☆'));
  s.addEventListener('mouseout', () => stars.forEach(st => { if (st.textContent !== '★') st.textContent = '☆'; }));
});

function hideExt() {
  document.getElementById('extOverlay').style.display = 'none';
}

// ── Swipe card ──
const swipeCardData = [
  '🏫 이화여대 · 국문학과',
  '🏫 한양대 · 기계공학과',
  '🏫 성균관대 · 경제학과',
  '🏫 중앙대 · 심리학과',
  '🏫 홍익대 · 디자인학과',
];
let cardIdx = 0;
const swipeCardEl = document.getElementById('swipeCard');
function swipeCard(dir) {
  if (!swipeCardEl) return;
  const tx = dir === 'yes' ? 200 : -200;
  swipeCardEl.style.transition = 'transform 0.35s ease, opacity 0.35s ease';
  swipeCardEl.style.transform = `translateX(-50%) translateX(${tx}px) rotate(${dir === 'yes' ? 15 : -15}deg)`;
  swipeCardEl.style.opacity = '0';
  setTimeout(() => {
    cardIdx = (cardIdx + 1) % swipeCardData.length;
    swipeCardEl.style.transition = 'none';
    swipeCardEl.style.transform = 'translateX(-50%)';
    swipeCardEl.style.opacity = '1';
    swipeCardEl.innerHTML = swipeCardData[cardIdx] + '<br><span style="color:var(--gray3);font-size:0.82rem;">재미있는 대화였어요!</span>';
  }, 380);
}

// ── Topic category pick ──
function pickCategory(el) {
  document.querySelectorAll('.topic-cat').forEach(c => c.style.borderColor = '');
  el.style.borderColor = 'var(--red)';
  el.style.transform = 'translateY(-4px)';
  setTimeout(() => { el.style.transform = ''; }, 200);
}

// ── Keyboard swipe support ──
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') swipeCard('yes');
  if (e.key === 'ArrowLeft') swipeCard('no');
});
