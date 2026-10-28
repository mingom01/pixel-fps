// 맵 에디터로 만든 맵을 구글 계정에 저장 → 다른 기기에서도 편집·플레이
// 계정 기록(store.js)의 maps 에 들어가요. mapDel 은 지운 맵 id (다른 기기 캐시에서 되살아나지 않게)
const STORE = require('./store.js');

const SH = require('../public/js/shared.js');
const MAX_MAPS = 20, MAX_DATA = SH.MAP_MAX.DATA, MAX_TOTAL = 12 * 1024 * 1024, MAX_DEL = 200;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// 클라가 보낸 맵 한 개 확인 (형식·크기만, 내용은 SH.mapFromData 가 읽을 때 다시 걸러짐)
function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const id = String(e.id || '');
  if (!/^[a-z0-9_-]{1,32}$/i.test(id)) return null;
  if (!int(e.W, 16, SH.MAP_MAX.W) || !int(e.D, 16, SH.MAP_MAX.W) || !int(e.H, 12, SH.MAP_MAX.H)) return null;
  if (typeof e.data !== 'string' || !e.data.length || e.data.length > MAX_DATA || !/^[A-Za-z0-9+/=]+$/.test(e.data)) return null;
  return {
    id, name: String(e.name || '내 맵').slice(0, 16), theme: String(e.theme || 'village').slice(0, 16),
    updated: Number(e.updated) || Date.now(), W: e.W, H: e.H, D: e.D, data: e.data,
  };
}

// 맵 관련 메시지면 처리하고 true (로그인한 사람만)
function handle(c, m) {
  if (m.t !== 'mapget' && m.t !== 'mapsave' && m.t !== 'mapdel') return false;
  const u = c.user && STORE.users[c.user.sub];
  if (!u) { c.send({ t: 'err', text: '로그인이 필요해요' }); return true; }
  const maps = u.maps || (u.maps = []), del = u.mapDel || (u.mapDel = []);
  if (m.t === 'mapget') { c.send({ t: 'maps', list: maps, del }); return true; }
  if (m.t === 'mapdel') {
    const id = String(m.id || '');
    u.maps = maps.filter(e => e.id !== id);
    if (!del.includes(id)) { del.push(id); if (del.length > MAX_DEL) del.splice(0, del.length - MAX_DEL); }
    STORE.save(); return true;
  }
  // mapsave
  const e = clean(m.ent);
  if (!e) { c.send({ t: 'mapsaveerr', id: m.ent && m.ent.id, text: '맵 데이터가 이상해서 계정에 저장하지 못했어요' }); return true; }
  const i = maps.findIndex(x => x.id === e.id);
  if (i >= 0 && (maps[i].updated || 0) > e.updated) { c.send({ t: 'mapsaved', id: e.id }); return true; } // 서버 쪽이 더 최신
  if (i < 0 && maps.length >= MAX_MAPS) { c.send({ t: 'mapsaveerr', id: e.id, text: `계정에는 맵을 ${MAX_MAPS}개까지 저장할 수 있어요` }); return true; }
  const total = maps.reduce((s, x) => s + (x.id === e.id ? 0 : x.data.length), 0) + e.data.length;
  if (total > MAX_TOTAL) { c.send({ t: 'mapsaveerr', id: e.id, text: '계정 저장 공간이 꽉 찼어요. 안 쓰는 맵을 지워 주세요' }); return true; }
  if (i >= 0) maps[i] = e; else maps.unshift(e);
  const di = del.indexOf(e.id); if (di >= 0) del.splice(di, 1);
  STORE.save();
  c.send({ t: 'mapsaved', id: e.id });
  return true;
}

module.exports = { handle, MAX_MAPS };
