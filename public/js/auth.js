// 구글 로그인 화면 + 세션 유지 + 계정별 프로필 동기화
import { profile, loadProfile, saveProfile, setProfileSync, flushProfile } from './cosmetics.js';

const $ = (id) => document.getElementById(id);
const TOK = 'pf_session';
let sendFn = null, readyFn = null, conf = null, user = null, gisLoaded = false;

export const isAuthed = () => !!user;
export const authUser = () => user;

function status(t, err) { const el = $('loginStatus'); el.textContent = t || ''; el.classList.toggle('err', !!err); }
function showLogin(on) { $('login').classList.toggle('hidden', !on); }

function loadGis() {
  if (gisLoaded) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => { gisLoaded = true; ok(); }; s.onerror = () => fail(new Error('구글 로그인 스크립트를 못 불러왔어요'));
    document.head.appendChild(s);
  });
}

async function renderButtons() {
  $('devLogin').classList.toggle('hidden', !(conf && conf.dev));
  if (!conf || !conf.clientId) {
    $('gBtn').innerHTML = '';
    if (!(conf && conf.dev)) status('서버에 구글 클라이언트 ID가 설정되지 않았어요 (README 참고)', true);
    return;
  }
  try {
    await loadGis();
    window.google.accounts.id.initialize({ client_id: conf.clientId, callback: (r) => { status('로그인 확인 중…'); sendFn({ t: 'auth', cred: r.credential }); } });
    window.google.accounts.id.renderButton($('gBtn'), { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko' });
  } catch (e) { status(e.message, true); }
}

// main.js 에서 한 번 호출
export async function initAuth({ send, onReady }) {
  sendFn = send; readyFn = onReady;
  $('devLoginBtn').onclick = () => { const n = $('devName').value.trim(); if (n) { status('로그인 중…'); sendFn({ t: 'auth', dev: n }); } };
  $('logoutBtn').onclick = logout;
  try { conf = await (await fetch('/auth-config')).json(); } catch (e) { conf = { clientId: '', dev: false }; }
  await renderButtons();
}

// 서버 연결될 때마다: 저장된 세션이 있으면 자동 로그인
export function onSocketOpen() {
  user = null;
  let tok = null; try { tok = localStorage.getItem(TOK); } catch (e) { /* */ }
  if (tok) { status('자동 로그인 중…'); sendFn({ t: 'auth', token: tok }); }
  else { showLogin(true); status(''); }
}

// 로그인 관련 메시지면 처리하고 true
export function handleAuthMsg(m) {
  if (m.t === 'authed') { onAuthed(m); return true; }
  if (m.t === 'autherr') {
    if (m.token) { try { localStorage.removeItem(TOK); } catch (e) { /* */ } }
    showLogin(true); status(m.text, true); return true;
  }
  if (m.t === 'needauth') { user = null; showLogin(true); return true; }
  return false;
}

function onAuthed(m) {
  user = { sub: m.sub, email: m.email, name: m.name };
  try { localStorage.setItem(TOK, m.token); } catch (e) { /* */ }
  // 연결이 끊겨서 서버에 못 보낸 변경(예: 산 스킨)이 이 브라우저에 더 최신으로 남아 있으면 그걸 유지하고 서버에 올림
  const localNewer = m.profile && profile.owner === m.sub && (profile.savedAt || 0) > (m.profile.savedAt || 0);
  if (localNewer) { /* 이 브라우저 기록 유지 → 아래 saveProfile 로 서버에 저장 */ }
  else if (m.profile) loadProfile(m.profile);
  else if (!profile.owner || profile.owner === m.sub) { profile.owner = m.sub; } // 이 브라우저의 기존 기록을 첫 로그인 계정으로 옮김
  else loadProfile({ owner: m.sub });
  profile.owner = m.sub;
  setProfileSync((p) => sendFn({ t: 'profile', p }));
  saveProfile();
  $('acctMail').textContent = m.email || m.name || '';
  showLogin(false); status('');
  if (readyFn) readyFn(user);
}

export function logout() {
  sendFn({ t: 'logout' });
  setProfileSync(null);
  try { localStorage.removeItem(TOK); } catch (e) { /* */ }
  if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect();
  user = null; showLogin(true); status('로그아웃했어요');
}

// 새로고침·창 닫기 직전에 남은 저장 보내기
for (const ev of ['pagehide', 'beforeunload']) window.addEventListener(ev, () => flushProfile());
