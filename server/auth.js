// 구글 로그인 + 계정별 프로필 (저장은 store.js: Supabase 또는 data/users.json)
// 클라이언트 ID: 환경변수 GOOGLE_CLIENT_ID 또는 data/config.json 의 { "googleClientId": "..." }
// 테스트용: 환경변수 DEV_LOGIN=1 이면 구글 없이 '개발자 로그인' 버튼이 생겨요 (공개 서버에선 쓰지 마세요)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const STORE = require('./store.js');

const CONF_FILE = path.join(__dirname, '..', 'data', 'config.json');
const MAX_PROFILE = 96 * 1024;

function readJson(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || d; } catch (e) { return d; } }
const conf = readJson(CONF_FILE, {});
// 붙여넣을 때 섞여 들어간 공백·줄바꿈·따옴표는 지움 (그대로 두면 구글이 invalid_client 로 거부)
const CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || conf.googleClientId || '').trim().replace(/^["']+|["']+$/g, '').trim();
if (CLIENT_ID && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(CLIENT_ID)) console.log('경고: GOOGLE_CLIENT_ID 형식이 이상해요 (숫자-영문.apps.googleusercontent.com 이어야 해요): ' + CLIENT_ID.slice(0, 12) + '…');
const DEV_LOGIN = process.env.DEV_LOGIN === '1';

/* ---------- 구글 ID 토큰 검증 (RS256, 의존성 없음) ---------- */
let jwks = { keys: [], until: 0 };
async function googleKeys() {
  if (Date.now() < jwks.until && jwks.keys.length) return jwks.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('구글 키를 못 받았어요');
  const ma = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  jwks = { keys: (await res.json()).keys || [], until: Date.now() + (ma ? Number(ma[1]) * 1000 : 3600000) };
  return jwks.keys;
}
const b64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
async function verifyGoogle(token) {
  if (!CLIENT_ID) throw new Error('서버에 구글 클라이언트 ID가 설정되지 않았어요');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('잘못된 토큰');
  const head = JSON.parse(b64url(parts[0]).toString('utf8')), body = JSON.parse(b64url(parts[1]).toString('utf8'));
  if (head.alg !== 'RS256') throw new Error('지원하지 않는 서명');
  const jwk = (await googleKeys()).find(k => k.kid === head.kid);
  if (!jwk) throw new Error('알 수 없는 키');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64url(parts[2]));
  if (!ok) throw new Error('서명이 맞지 않아요');
  if (body.aud !== CLIENT_ID) throw new Error('다른 앱의 토큰이에요');
  if (body.iss !== 'accounts.google.com' && body.iss !== 'https://accounts.google.com') throw new Error('발급자가 이상해요');
  if (!body.exp || body.exp * 1000 < Date.now()) throw new Error('토큰이 만료됐어요');
  return { sub: 'g' + body.sub, email: body.email || '', name: body.given_name || body.name || '' };
}

async function touchUser(info) {
  let u = await STORE.get(info.sub);
  if (!u) u = { email: info.email, name: info.name, created: Date.now(), profile: null };
  if (info.email) u.email = info.email;
  if (info.name) u.name = info.name;
  u.last = Date.now(); STORE.set(info.sub, u);
  return u;
}

// 로그인: { cred } (구글 ID 토큰) 또는 { token } (저장된 세션) 또는 { dev } (개발용)
async function login(m) {
  if (m.token) {
    const sub = STORE.readToken(String(m.token)), u = sub && await STORE.get(sub);
    if (!u) throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요');
    u.last = Date.now(); STORE.save();
    return { sub, email: u.email, name: u.name, token: String(m.token), profile: u.profile };
  }
  let info;
  if (m.dev) {
    if (!DEV_LOGIN) throw new Error('개발자 로그인이 꺼져 있어요');
    const nick = String(m.dev).replace(/[^a-z0-9가-힣]/gi, '').slice(0, 10) || 'dev';
    info = { sub: 'dev_' + nick, email: nick + '@dev.local', name: nick };
  } else info = await verifyGoogle(m.cred);
  const u = await touchUser(info);
  return { sub: info.sub, email: u.email, name: u.name, token: STORE.makeToken(info.sub), profile: u.profile };
}
function logout() { /* 서명 토큰이라 서버에 지울 것이 없음 — 브라우저가 토큰을 버림 */ }

// 프로필 저장 (클라이언트가 보낸 걸 크기·형식만 확인하고 저장)
function saveProfile(sub, p) {
  const u = STORE.users[sub]; if (!u || !p || typeof p !== 'object' || Array.isArray(p)) return false;
  const s = JSON.stringify(p); if (s.length > MAX_PROFILE) return false;
  u.profile = JSON.parse(s); u.last = Date.now(); STORE.save();
  return true;
}

const publicConfig = () => ({ clientId: CLIENT_ID, dev: DEV_LOGIN });

module.exports = { login, logout, saveProfile, publicConfig };
