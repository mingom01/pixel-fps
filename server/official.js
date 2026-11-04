// 출품 맵: 플레이어가 '내 맵'을 출품하면 승인 없이 바로 모두가 플레이 (대기실 '출품 맵' 탭 + 빠른 시작·랜덤 모드)
// - 같은 맵을 다시 출품하거나 만든 사람이 원본을 저장하면 새 버전으로 바로 바뀜
// - 만든 사람은 '출품 취소', 관리자(환경변수 ADMIN_EMAILS 의 구글 이메일)는 문제 있는 맵을 내릴 수 있음
// - 맵 id 는 'off_<id>' (예전에 '공식 맵'으로 승인된 맵도 그대로 출품 맵이 됨)
// 저장: 계정 저장소(store.js)의 '__official' (출품 맵 목록). '__submits' 는 예전 심사 기록 (남아 있던 심사 대기 맵은 바로 공개)
const STORE = require('./store.js');
const SH = require('../public/js/shared.js');

const OFF_ID = '__official', SUB_ID = '__submits';
const MAX_TOTAL = 300; // 서버 저장 공간 보호용 전체 한도 (한 사람당 제한은 없음)
const ADMINS = String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

let off = { list: [] };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
const ready = Promise.all([
  STORE.get(OFF_ID).then(d => { if (d && Array.isArray(d.list)) off = d; }),
  STORE.get(SUB_ID).then(d => d && Array.isArray(d.list) ? d : { list: [] }),
]).then(([, subs]) => {
  // 예전 기록 정리: 승인된 맵에 원본 맵 id 연결, 심사 대기 중이던 맵은 바로 공개
  for (const o of off.list) if (!o.mid) { const s = subs.list.find(x => x.offId === o.id); if (s) o.mid = s.mid; }
  for (const s of subs.list) {
    if (s.status !== 'pending' || !s.ent) continue;
    if (!off.list.some(o => o.bySub === s.bySub && o.mid === s.mid)) off.list.push(Object.assign({ id: newId(), by: s.by, bySub: s.bySub, mid: s.mid, at: s.at || Date.now() }, s.ent));
    s.status = 'approved';
  }
  for (const o of off.list) SH.registerOfficial(o);
  STORE.set(OFF_ID, off); STORE.set(SUB_ID, subs);
}).catch(e => console.log('출품 맵 불러오기 실패: ' + e.message));
const saveOff = () => STORE.set(OFF_ID, off);

const isAdmin = (c) => !!(c.user && c.user.email && ADMINS.includes(String(c.user.email).toLowerCase()));
const cleanName = (s, n) => String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, n);
// 접속자에게 보낼 때는 구글 계정 id(bySub)를 빼고
const pub = (o) => { const r = Object.assign({}, o); delete r.bySub; return r; };
const meta = (o) => ({ id: o.id, mid: o.mid, name: o.name, by: o.by, at: o.at, upd: o.upd || o.at, W: o.W, H: o.H, D: o.D });

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
  const mine = (c) => off.list.filter(o => o.bySub === c.user.sub).map(meta);
  // 로그인 직후: 출품 맵 목록 + 관리자 여부
  function onLogin(c) {
    ready.then(() => { c.send({ t: 'official', list: off.list.map(pub), admin: isAdmin(c) }); });
  }
  function publish(o) { SH.registerOfficial(o); saveOff(); deps.broadcastAll({ t: 'official', list: [pub(o)], upd: true }); }
  function remove(o, why) {
    off.list = off.list.filter(x => x !== o); SH.unregisterOfficial(o.id); saveOff();
    deps.broadcastAll({ t: 'offdel', id: o.id }); deps.log(`출품 맵 내림: ${o.name} (${why})`);
  }

  function handle(c, m) {
    if (!['submit', 'unsubmit', 'mysubs', 'admsubs', 'admdel'].includes(m.t)) return false;
    if (!c.user) return true;
    if (m.t === 'submit') {
      const ent = checkEnt(m.ent), mid = String(m.ent && m.ent.id || '').slice(0, 32);
      if (!ent || !mid) { c.send({ t: 'err', text: '출품할 수 없는 맵이에요 (스폰할 곳이 2곳 이상 필요해요)' }); return true; }
      const by = cleanName(m.by || c.user.name, 10) || '플레이어';
      let o = off.list.find(x => x.bySub === c.user.sub && x.mid === mid);
      if (o) Object.assign(o, ent, { by, upd: Date.now() });
      else {
        if (off.list.length >= MAX_TOTAL) { c.send({ t: 'err', text: '출품 맵이 너무 많아서 지금은 더 올릴 수 없어요' }); return true; }
        o = Object.assign({ id: newId(), by, bySub: c.user.sub, mid, at: Date.now() }, ent);
        off.list.push(o);
      }
      publish(o);
      deps.log(`맵 출품: ${o.name} (${by})`);
      c.send({ t: 'submitted', mid, text: `'${o.name}' 맵을 출품했어요! 이제 모두가 '출품 맵'에서 플레이할 수 있어요` });
      c.send({ t: 'mysubs', list: mine(c) });
      return true;
    }
    if (m.t === 'unsubmit') {
      const o = off.list.find(x => x.bySub === c.user.sub && x.mid === String(m.mid || ''));
      if (o) { remove(o, '만든 사람이 취소'); c.send({ t: 'submitted', mid: o.mid, text: `'${o.name}' 출품을 취소했어요` }); }
      c.send({ t: 'mysubs', list: mine(c) });
      return true;
    }
    if (m.t === 'mysubs') { c.send({ t: 'mysubs', list: mine(c) }); return true; }
    // 여기부터 관리자만: 출품 맵 목록 보기 · 내리기
    if (!isAdmin(c)) { c.send({ t: 'err', text: '관리자만 할 수 있어요' }); return true; }
    if (m.t === 'admdel') { const o = off.list.find(x => x.id === m.id); if (o) remove(o, '관리자'); }
    c.send({ t: 'admsubs', list: off.list.slice().sort((a, b) => (b.upd || b.at) - (a.upd || a.at)).map(meta) });
    return true;
  }

  // 만든 사람이 원본 맵을 저장하면 → 출품 맵도 그 버전으로 바꾸고 모든 접속자에게 보냄 (진행 중인 판은 다음 판부터)
  function onMapSaved(c, e) {
    const o = off.list.find(x => x.bySub === c.user.sub && x.mid === e.id);
    if (!o) return;
    const ent = checkEnt(e);
    if (!ent) { c.send({ t: 'err', text: '출품 맵에는 반영 못 했어요 (스폰할 곳이 2곳 이상 필요해요)' }); return; }
    Object.assign(o, { theme: ent.theme, W: ent.W, H: ent.H, D: ent.D, data: ent.data, cb: ent.cb, mk: ent.mk, upd: Date.now() });
    publish(o);
    deps.log(`출품 맵 수정 반영: ${o.name} (${o.by})`);
    c.send({ t: 'submitted', mid: e.id, text: `출품 맵 '${o.name}'에도 바로 반영했어요` });
  }

  return { handle, onLogin, isAdmin, onMapSaved };
};
