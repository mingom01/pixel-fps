// '내 블록' 목록: 구글 계정(서버)에 저장, 이 기기엔 캐시 (localStorage 'pf_blocks:<계정>')
// 블록 = { id, name, f: [6면 base64], updated }
export const MAX_BLOCKS = 40;
let sub = null, send = null, onChange = null, list = [];

const cacheKey = () => 'pf_blocks:' + sub;
function writeCache() { try { localStorage.setItem(cacheKey(), JSON.stringify(list)); } catch (e) { /* */ } }
const changed = () => { if (onChange) onChange(); };

export function initBlockStore(deps) { send = deps.send; onChange = deps.onChange; }
export const myBlocks = () => list.slice();
export const blockById = (id) => list.find(b => b.id === id) || null;

export function blocksLogin(id) {
  sub = id;
  try { const v = JSON.parse(localStorage.getItem(cacheKey()) || '[]'); list = Array.isArray(v) ? v.filter(b => b && b.id) : []; } catch (e) { list = []; }
  send({ t: 'blkget' });
  changed();
}
// 서버 목록과 합치기 (같은 블록은 최근에 고친 것), 이 기기에만 있는 건 올림
export function onServerBlocks(m) {
  const del = new Set(m.del || []), byId = new Map();
  for (const b of m.list || []) byId.set(b.id, b);
  for (const b of list) {
    if (del.has(b.id)) continue;
    const sv = byId.get(b.id);
    if (!sv || (b.updated || 0) > (sv.updated || 0)) { byId.set(b.id, b); send({ t: 'blksave', blk: b }); }
  }
  list = [...byId.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  writeCache(); changed();
}
// 저장 (새 블록이면 id 를 만들어서). 개수 초과면 null
export function saveBlock(b) {
  const blk = Object.assign({}, b, { id: b.id || 'b' + Date.now().toString(36), updated: Date.now() });
  const i = list.findIndex(x => x.id === blk.id);
  if (i < 0 && list.length >= MAX_BLOCKS) return null;
  if (i >= 0) list.splice(i, 1);
  list.unshift(blk);
  writeCache(); send({ t: 'blksave', blk }); changed();
  return blk;
}
export function deleteBlock(id) {
  list = list.filter(b => b.id !== id);
  writeCache(); send({ t: 'blkdel', id }); changed();
}
