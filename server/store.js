// 계정 저장소
// - SUPABASE_URL + SUPABASE_SECRET_KEY 가 있으면 Supabase(Postgres) 의 accounts 표에 저장 (배포용, 서버가 재시작돼도 유지)
// - 없으면 data/users.json 파일에 저장 (내 컴퓨터에서 돌릴 때)
// 로그인 세션은 서명된 토큰이라 따로 저장하지 않아요.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const DATA = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA, 'users.json');
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = process.env.SUPABASE_TABLE || 'accounts';
const remote = !!(SB_URL && SB_KEY);
const log = (s) => console.log(new Date().toLocaleTimeString() + '  ' + s);

const users = {};     // uid → 계정 (메모리 캐시)
const savedJson = {}; // uid → 마지막으로 저장한 JSON (바뀐 것만 저장)
if (!remote) {
  try { Object.assign(users, JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}); } catch (e) { /* 새로 시작 */ }
  for (const uid in users) savedJson[uid] = JSON.stringify(users[uid]);
}

/* ---------- 세션 토큰 (HMAC 서명, 180일) ---------- */
let secret = process.env.SESSION_SECRET || '';
if (!secret && remote) secret = crypto.createHash('sha256').update('pixel-fps-session:' + SB_KEY).digest('hex');
if (!secret) {
  const f = path.join(DATA, 'secret.txt');
  try { secret = fs.readFileSync(f, 'utf8').trim(); } catch (e) { /* 없음 */ }
  if (!secret) { secret = crypto.randomBytes(32).toString('hex'); fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(f, secret); }
}
const sign = (s) => crypto.createHmac('sha256', secret).update(s).digest('base64url');
function makeToken(uid) {
  const body = Buffer.from(uid).toString('base64url') + '.' + (Date.now() + 180 * 864e5).toString(36);
  return body + '.' + sign(body);
}
function readToken(tok) {
  if (typeof tok !== 'string') return null;
  const [a, b, s] = tok.split('.');
  if (!a || !b || !s) return null;
  const want = sign(a + '.' + b);
  if (s.length !== want.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want))) return null;
  if (parseInt(b, 36) < Date.now()) return null;
  return Buffer.from(a, 'base64url').toString();
}

/* ---------- Supabase REST ---------- */
const H = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
async function fetchRow(uid) {
  const r = await fetch(`${SB_URL}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(uid)}&select=data`, { headers: H() });
  if (!r.ok) throw new Error('DB 읽기 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const rows = await r.json();
  return rows[0] ? rows[0].data : null;
}
async function upsert(rows) {
  const r = await fetch(`${SB_URL}/rest/v1/${TABLE}`, { method: 'POST', headers: { ...H(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error('DB 저장 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

// 계정 하나 가져오기 (캐시 → DB)
async function get(uid) {
  if (users[uid]) return users[uid];
  if (!remote) return null;
  const d = await fetchRow(uid);
  if (d && !users[uid]) { users[uid] = d; savedJson[uid] = JSON.stringify(d); }
  return users[uid] || null;
}
function set(uid, data) { users[uid] = data; save(); }

/* ---------- 저장 (바뀐 계정만 모아서) ---------- */
let timer = null, saving = null;
async function flush() {
  if (saving) await saving;
  const changed = [];
  for (const uid in users) { const j = JSON.stringify(users[uid]); if (savedJson[uid] !== j) changed.push([uid, j]); }
  if (!changed.length) return;
  saving = (async () => {
    try {
      if (remote) {
        const now = new Date().toISOString();
        await upsert(changed.map(([id, j]) => ({ id, data: JSON.parse(j), updated_at: now })));
      } else {
        fs.mkdirSync(DATA, { recursive: true });
        await fs.promises.writeFile(FILE + '.tmp', JSON.stringify(users));
        await fs.promises.rename(FILE + '.tmp', FILE);
      }
      for (const [uid, j] of changed) savedJson[uid] = j;
    } catch (e) { log('저장 실패: ' + e.message); }
  })();
  await saving;
  saving = null;
}
function save() { if (timer) return; timer = setTimeout(() => { timer = null; flush(); }, 1500); }
setInterval(flush, 15000).unref();

async function check() {
  if (!remote) return 'file';
  const r = await fetch(`${SB_URL}/rest/v1/${TABLE}?select=id&limit=1`, { headers: H() });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return 'supabase';
}

module.exports = { users, get, set, save, flush, check, makeToken, readToken, remote };
