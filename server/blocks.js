// '내 블록' 목록을 구글 계정에 저장 (블록 만들기 화면에서 만든 것, 최대 40개)
// 계정 기록(store.js)의 blocks 에 들어감. blockDel 은 지운 블록 id (다른 기기 캐시에서 되살아나지 않게)
const STORE = require('./store.js');
const SH = require('../public/js/shared.js');

const MAX_BLOCKS = 40, MAX_DEL = 200;

function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const id = String(e.id || '');
  if (!/^[a-z0-9_-]{1,32}$/i.test(id)) return null;
  // 면 검사는 맵의 블록 검사와 같은 규칙
  const ok = SH.cleanCb({ [SH.CB_MIN]: { n: e.name, f: e.f } })[SH.CB_MIN];
  if (!ok) return null;
  return { id, name: ok.n, f: ok.f, updated: Number(e.updated) || Date.now() };
}

function handle(c, m) {
  if (m.t !== 'blkget' && m.t !== 'blksave' && m.t !== 'blkdel') return false;
  const u = c.user && STORE.users[c.user.sub];
  if (!u) { c.send({ t: 'err', text: '로그인이 필요해요' }); return true; }
  const list = u.blocks || (u.blocks = []), del = u.blockDel || (u.blockDel = []);
  if (m.t === 'blkget') { c.send({ t: 'blks', list, del }); return true; }
  if (m.t === 'blkdel') {
    const id = String(m.id || '');
    u.blocks = list.filter(e => e.id !== id);
    if (!del.includes(id)) { del.push(id); if (del.length > MAX_DEL) del.splice(0, del.length - MAX_DEL); }
    STORE.save(); return true;
  }
  const e = clean(m.blk);
  if (!e) { c.send({ t: 'err', text: '블록 데이터가 이상해서 저장하지 못했어요' }); return true; }
  const i = list.findIndex(x => x.id === e.id);
  if (i >= 0 && (list[i].updated || 0) > e.updated) return true;
  if (i < 0 && list.length >= MAX_BLOCKS) { c.send({ t: 'err', text: `내 블록은 ${MAX_BLOCKS}개까지 저장돼요` }); return true; }
  if (i >= 0) list[i] = e; else list.unshift(e);
  const di = del.indexOf(e.id); if (di >= 0) del.splice(di, 1);
  STORE.save();
  return true;
}

module.exports = { handle, MAX_BLOCKS };
