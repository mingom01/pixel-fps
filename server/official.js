// 맵 출품 → 관리자 심사 → 공식 맵
// - 누구나 '내 맵'을 출품 (한 사람당 심사 중 3개까지, 같은 맵은 다시 내면 바뀜)
// - 관리자(환경변수 ADMIN_EMAILS 에 적힌 구글 이메일)가 미리 플레이해 보고 승인/거절
// - 승인된 맵은 'off_<id>' 로 서버·모든 접속자에게 등록 → 맵 목록과 랜덤 맵에 나옴
// 저장: 계정 저장소(store.js)의 '__official' (공식 맵), '__submits' (출품 목록)
const STORE = require('./store.js');
const SH = require('../public/js/shared.js');

const OFF_ID = '__official', SUB_ID = '__submits';
const MAX_PENDING_PER_USER = 3, MAX_PENDING = 100;
const ADMINS = String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

let off = { list: [] }, subs = { list: [] };
const ready = Promise.all([
  STORE.get(OFF_ID).then(d => { if (d && Array.isArray(d.list)) off = d; }),
  STORE.get(SUB_ID).then(d => { if (d && Array.isArray(d.list)) subs = d; }),
]).then(() => { for (const o of off.list) SH.registerOfficial(o); STORE.set(OFF_ID, off); STORE.set(SUB_ID, subs); })
  .catch(e => console.log('공식 맵 불러오기 실패: ' + e.message));
const saveOff = () => STORE.set(OFF_ID, off);
const saveSubs = () => STORE.set(SUB_ID, subs);

const isAdmin = (c) => !!(c.user && c.user.email && ADMINS.includes(String(c.user.email).toLowerCase()));
const cleanName = (s, n) => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, n);
// 접속자에게 보낼 때는 구글 계정 id(bySub)를 빼고
const pub = (o) => { const r = Object.assign({}, o); delete r.bySub; return r; };
const subMeta = (s) => ({ sid: s.sid, mid: s.mid, name: s.ent.name, by: s.by, at: s.at, status: s.status, W: s.ent.W, H: s.ent.H, D: s.ent.D, offId: s.offId || null, why: s.why || '' });

// 맵 확인: 형식 + 실제로 읽히고 스폰이 2곳 이상
function checkEnt(e) {
  if (!e || typeof e !== 'object' || typeof e.data !== 'string') return null;
  const ent = { name: cleanName(e.name, 16) || '내 맵', theme: String(e.theme || 'village').slice(0, 16), W: e.W | 0, H: e.H | 0, D: e.D | 0, data: e.data, cb: SH.cleanCb(e.cb), mk: SH.cleanMk(e.mk, { W: e.W | 0, H: e.H | 0, D: e.D | 0 }) };
  const m = SH.mapFromData(ent);
  if (!m || m.spawns.length < 2) return null;
  return ent;
}

// deps: { broadcastAll(msg), log }
module.exports = function makeOfficial(deps) {
  // 로그인 직후: 공식 맵 목록 + 관리자 여부
  function onLogin(c) {
    ready.then(() => { c.send({ t: 'official', list: off.list.map(pub), admin: isAdmin(c) }); });
  }

  function handle(c, m) {
    if (!['submit', 'mysubs', 'admsubs', 'admok', 'admno', 'admdel'].includes(m.t)) return false;
    if (!c.user) return true;
    const sub = c.user.sub;
    if (m.t === 'submit') {
      const ent = checkEnt(m.ent), mid = String(m.ent && m.ent.id || '').slice(0, 32);
      if (!ent || !mid) { c.send({ t: 'err', text: '출품할 수 없는 맵이에요 (스폰할 곳이 2곳 이상 필요해요)' }); return true; }
      const mine = subs.list.filter(s => s.bySub === sub && s.status === 'pending');
      const same = mine.find(s => s.mid === mid);
      if (!same && mine.length >= MAX_PENDING_PER_USER) { c.send({ t: 'err', text: `심사 중인 맵은 ${MAX_PENDING_PER_USER}개까지예요` }); return true; }
      if (!same && subs.list.filter(s => s.status === 'pending').length >= MAX_PENDING) { c.send({ t: 'err', text: '출품이 너무 많이 밀려 있어요. 나중에 다시 해 주세요' }); return true; }
      const by = cleanName(m.by || c.user.name, 10) || '플레이어';
      if (same) Object.assign(same, { ent, by, at: Date.now() });
      else subs.list.unshift({ sid: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), mid, bySub: sub, by, at: Date.now(), status: 'pending', ent });
      if (subs.list.length > 300) subs.list = subs.list.filter(s => s.status === 'pending').concat(subs.list.filter(s => s.status !== 'pending').slice(0, 100));
      saveSubs();
      deps.log(`맵 출품: ${ent.name} (${by})`);
      c.send({ t: 'submitted', mid, text: same ? `'${ent.name}' 출품작을 지금 버전으로 바꿨어요` : `'${ent.name}' 맵을 출품했어요! 관리자가 승인하면 공식 맵이 돼요` });
      c.send({ t: 'mysubs', list: subs.list.filter(s => s.bySub === sub).map(subMeta) });
      return true;
    }
    if (m.t === 'mysubs') { c.send({ t: 'mysubs', list: subs.list.filter(s => s.bySub === sub).map(subMeta) }); return true; }
    // 여기부터 관리자만
    if (!isAdmin(c)) { c.send({ t: 'err', text: '관리자만 할 수 있어요' }); return true; }
    if (m.t === 'admsubs') {
      c.send({ t: 'admsubs', pending: subs.list.filter(s => s.status === 'pending').map(s => Object.assign(subMeta(s), { ent: s.ent })), done: subs.list.filter(s => s.status !== 'pending').slice(0, 30).map(subMeta), official: off.list.map(o => ({ id: o.id, name: o.name, by: o.by, at: o.at })) });
      return true;
    }
    if (m.t === 'admok' || m.t === 'admno') {
      const s = subs.list.find(x => x.sid === m.sid && x.status === 'pending');
      if (!s) { c.send({ t: 'err', text: '이미 처리된 출품작이에요' }); return true; }
      if (m.t === 'admno') { s.status = 'rejected'; s.why = cleanName(m.why, 60); }
      else {
        const o = Object.assign({ id: Date.now().toString(36), by: s.by, bySub: s.bySub, at: Date.now() }, s.ent);
        o.name = cleanName(m.name, 16) || o.name;
        off.list.push(o); SH.registerOfficial(o); saveOff();
        s.status = 'approved'; s.offId = o.id;
        deps.broadcastAll({ t: 'official', list: [pub(o)] });
        deps.log(`공식 맵 승인: ${o.name} (${o.by})`);
      }
      saveSubs();
      handle(c, { t: 'admsubs' });
      return true;
    }
    if (m.t === 'admdel') {
      const i = off.list.findIndex(o => o.id === m.id);
      if (i >= 0) { const o = off.list.splice(i, 1)[0]; SH.unregisterOfficial(o.id); saveOff(); deps.broadcastAll({ t: 'offdel', id: o.id }); deps.log(`공식 맵 내림: ${o.name}`); }
      handle(c, { t: 'admsubs' });
      return true;
    }
    return true;
  }

  return { handle, onLogin, isAdmin };
};
