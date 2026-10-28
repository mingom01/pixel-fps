// 맵 에디터 '표시': 스폰(개인전·레드·블루) · 깃발(레드·블루) · 힐팩(작은·큰) · 보급 상자 자리
// - 블록 고르기 창의 '표시' 칸에서 고르면 블록 칸에 들어감 (번호는 음수라 진짜 블록과 안 겹침)
// - 우클릭: 바라보는 바닥 위에 표시 놓기 · 좌클릭: 근처 표시 지우기 (표시를 들고 있을 때만)
// - 에디터에서만 보이고 게임에선 안 보임. 저장하면 맵 데이터 mk 에 들어감 (shared.js cleanMk)
import * as THREE from '../../lib/three.module.min.js';
import { textSprite } from '../tex.js';

export const MARKERS = [
  { k: 's', id: -1, name: '개인전 스폰', color: 0xffd84a, shape: 'spawn' },
  { k: 'r', id: -2, name: '레드팀 스폰', color: 0xe2483a, shape: 'spawn' },
  { k: 'b', id: -3, name: '블루팀 스폰', color: 0x3d8bf0, shape: 'spawn' },
  { k: 'fr', id: -4, name: '레드 깃발', color: 0xff5a4a, shape: 'flag', one: true },
  { k: 'fb', id: -5, name: '블루 깃발', color: 0x4aa8ff, shape: 'flag', one: true },
  { k: 'h', id: -6, name: '작은 힐팩', color: 0xff8a9a, shape: 'heal' },
  { k: 'H', id: -7, name: '큰 힐팩', color: 0xff2a4a, shape: 'heal', big: true },
  { k: 'c', id: -8, name: '보급 상자', color: 0xc8a050, shape: 'crate' },
];
const BY_ID = Object.fromEntries(MARKERS.map(m => [m.id, m]));
export const isMarker = (b) => b < 0 && !!BY_ID[b];
const hexs = (c) => '#' + c.toString(16).padStart(6, '0');

// deps = { ED, scene, SH, send, isOnline(), toast }
let D = null, group = null;
export function initMarkers(deps) { D = deps; }
export const markerName = (id) => (BY_ID[id] || {}).name || '';

// 블록 칸·고르기 창용 아이콘
const iconCache = {};
export function markerIcon(id) {
  if (iconCache[id]) return iconCache[id];
  const mk = BY_ID[id], c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  x.fillStyle = '#10131c'; x.fillRect(0, 0, 32, 32); x.fillStyle = hexs(mk.color);
  if (mk.shape === 'spawn') { x.fillRect(12, 4, 8, 8); x.fillRect(10, 13, 12, 10); x.fillRect(11, 23, 4, 7); x.fillRect(17, 23, 4, 7); }
  else if (mk.shape === 'flag') { x.fillStyle = '#c8c8c8'; x.fillRect(8, 3, 3, 27); x.fillStyle = hexs(mk.color); x.fillRect(11, 4, 15, 10); }
  else if (mk.shape === 'heal') { const k = mk.big ? 0 : 4; x.fillStyle = '#f0f0f0'; x.fillRect(4 + k, 4 + k, 24 - k * 2, 24 - k * 2); x.fillStyle = hexs(mk.color); x.fillRect(13, 7 + k, 6, 18 - k * 2); x.fillRect(7 + k, 13, 18 - k * 2, 6); }
  else { x.fillRect(5, 8, 22, 18); x.fillStyle = '#6a4a20'; x.fillRect(5, 15, 22, 3); x.fillRect(14, 8, 4, 18); }
  return (iconCache[id] = c.toDataURL());
}

// 블록 고르기 창의 '표시' 칸
export function markersHtml() {
  const mk = D.ED.mk || {}, count = (k) => Array.isArray(mk[k]) ? mk[k].length : (mk[k] ? 1 : 0);
  return `<div class="bp-sec">표시 <span class="dim">· 우클릭으로 놓고 좌클릭으로 지워요. 안 놓으면 자동으로 정해져요 (게임에선 안 보여요)</span></div>
    <div class="bp-mine">${MARKERS.map(m => `<div class="bpi" data-b="${m.id}" title="${m.name}"><img src="${markerIcon(m.id)}"><span>${m.name}</span><em class="dim">${count(m.k)}</em></div>`).join('')}</div>`;
}

// 표시 3D 모양 (반투명 기둥/상자 + 이름표)
function markerMesh(mk) {
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: mk.color, transparent: true, opacity: 0.55, depthWrite: false });
  const add = (w, h, d, y, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || mat); o.position.y = y; g.add(o); };
  if (mk.shape === 'spawn') { add(0.6, 1.6, 0.6, 0.8); add(1, 0.06, 1, 0.03); }
  else if (mk.shape === 'flag') { add(0.08, 2.2, 0.08, 1.1, new THREE.MeshBasicMaterial({ color: 0xdddddd })); add(0.7, 0.45, 0.05, 1.9); g.children[1].position.x = 0.38; }
  else if (mk.shape === 'heal') { const s = mk.big ? 0.8 : 0.55; add(s, s * 0.6, s, s * 0.3); }
  else { add(0.9, 0.9, 0.9, 0.45); }
  const ts = textSprite(mk.name, hexs(mk.color));
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: ts.tex, depthTest: false, transparent: true }));
  tag.scale.set(ts.w / 48, ts.h / 48, 1); tag.position.y = mk.shape === 'flag' ? 2.6 : 2.0; tag.renderOrder = 5; g.add(tag);
  return g;
}
export function clearMarkers() { if (group) { D.scene.remove(group); group = null; } }
export function rebuildMarkers() {
  clearMarkers();
  group = new THREE.Group();
  const mk = D.ED.mk || {};
  for (const m of MARKERS) {
    const list = m.one ? (mk[m.k] ? [mk[m.k]] : []) : (mk[m.k] || []);
    for (const p of list) { const o = markerMesh(m); o.position.set(p[0] + 0.5, p[1], p[2] + 0.5); group.add(o); }
  }
  D.scene.add(group);
}

function changed() {
  D.ED.mk = D.SH.cleanMk(D.ED.mk, D.ED.map);
  rebuildMarkers();
  if (D.isOnline()) D.send({ t: 'edmk', mk: D.ED.mk });
}
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// 우클릭: (x,y,z) 빈 칸에 표시 놓기 (발밑이 단단한 블록이어야 함)
export function placeMarker(id, x, y, z) {
  const m = BY_ID[id], map = D.ED.map, mk = D.ED.mk || (D.ED.mk = {});
  if (!map.solid(x, y - 1, z) || map.solid(x, y, z) || map.solid(x, y + 1, z)) { D.toast('표시는 바닥 위, 위로 2칸이 빈 곳에 놓을 수 있어요'); return false; }
  const p = [x, y, z];
  if (m.one) mk[m.k] = p;
  else {
    const list = mk[m.k] || (mk[m.k] = []);
    if (list.some(q => same(q, p))) return false;
    if (list.length >= D.SH.MK_MAX[m.k]) { D.toast(`${m.name} 표시는 ${D.SH.MK_MAX[m.k]}개까지예요`); return false; }
    list.push(p);
  }
  changed(); return true;
}
// 좌클릭: (x,y,z) 근처(1.5칸)의 표시 하나 지우기
export function removeMarkerNear(x, y, z) {
  const mk = D.ED.mk || {}; let best = null, bd = 2.3;
  for (const m of MARKERS) {
    const list = m.one ? (mk[m.k] ? [mk[m.k]] : []) : (mk[m.k] || []);
    for (const p of list) { const d = Math.hypot(p[0] - x, (p[1] - y) * 1.5, p[2] - z); if (d < bd) { bd = d; best = [m, p]; } }
  }
  if (!best) return false;
  const [m, p] = best;
  if (m.one) mk[m.k] = null; else mk[m.k] = mk[m.k].filter(q => q !== p);
  changed(); return true;
}
// 같이 만들기: 다른 사람이 표시를 바꿈
export function onEdMk(m) { D.ED.mk = m.mk; rebuildMarkers(); }
