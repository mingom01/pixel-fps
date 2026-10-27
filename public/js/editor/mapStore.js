// 내가 만든 맵 저장소: 구글 계정(서버)에 저장해서 다른 기기에서도 편집·플레이
// - 이 기기 캐시: localStorage 'pf_maps:<계정>' (계정마다 따로, 서버 연결 전에도 바로 보이게)
// - 예전 버전이 저장한 'pf_maps' 는 지우거나 고치지 않고, 이 기기에서 처음 로그인한 계정에 한 번 올림
const LEGACY = 'pf_maps', CLAIM = 'pf_maps_claimed';
export const MAX_MAPS = 20;

let sub = null, send = null, onChange = null, list = [], synced = false;
const pending = new Set(); // 서버 저장 확인 전인 맵 id

const read = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.filter(e => e && e.id) : []; } catch (e) { return []; } };
const cacheKey = () => 'pf_maps:' + sub;
function writeCache() { try { localStorage.setItem(cacheKey(), JSON.stringify(list)); return true; } catch (e) { return false; } }
const changed = () => { if (onChange) onChange(); };
function upload(ent) { pending.add(ent.id); send({ t: 'mapsave', ent }); }

// deps = { send(msg), onChange() } — onChange: 목록이 바뀌면 (열린 에디터 시작 창 새로고침용)
export function initMapStore(deps) { send = deps.send; onChange = deps.onChange; }

export const savedMaps = () => list.slice();
export const mapSyncState = () => !synced ? 'loading' : pending.size ? 'saving' : 'ok';

// 로그인 직후: 이 기기 캐시를 먼저 보여주고 서버 목록 요청
export function mapsLogin(id) {
  sub = id; synced = false; pending.clear();
  list = read(cacheKey());
  send({ t: 'mapget' });
  changed();
}

// 서버 목록 도착 → 합치기 (같은 맵은 더 최근에 고친 것), 이 기기에만 있는 맵은 서버에 올림
export function onServerMaps(m) {
  const del = new Set(m.del || []), byId = new Map();
  for (const e of m.list || []) byId.set(e.id, e);
  let legacy = [];
  let claimed = null; try { claimed = localStorage.getItem(CLAIM); } catch (e) { /* */ }
  if (!claimed) { legacy = read(LEGACY); try { localStorage.setItem(CLAIM, sub); } catch (e) { /* */ } }
  for (const e of list.concat(legacy)) {
    if (del.has(e.id)) continue;
    const sv = byId.get(e.id);
    if (!sv || (e.updated || 0) > (sv.updated || 0)) { byId.set(e.id, e); upload(e); }
  }
  list = [...byId.values()].sort((a, b) => (b.updated || 0) - (a.updated || 0));
  synced = true; writeCache(); changed();
}
export function onMapSaved(m) { pending.delete(m.id); changed(); }
export function onMapSaveErr(m) { pending.delete(m.id); changed(); return m.text; }

// 저장: 'full' = 개수 초과, 'cache' = 이 기기 캐시엔 못 썼지만 서버로는 보냄, true = 성공
export function saveMap(ent) {
  const i = list.findIndex(e => e.id === ent.id);
  if (i < 0 && list.length >= MAX_MAPS) return 'full';
  if (i >= 0) list.splice(i, 1);
  list.unshift(ent);
  const ok = writeCache();
  upload(ent); changed();
  return ok ? true : 'cache';
}
export function deleteMap(id) {
  list = list.filter(e => e.id !== id);
  writeCache(); pending.delete(id);
  send({ t: 'mapdel', id }); changed();
}
