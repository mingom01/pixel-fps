// 총기 장식 (경쟁전 티어 보상): 총 옆에 매달리는 작은 복셀 장식
import * as THREE from '../../lib/three.module.min.js';

// tier: 경쟁전 티어 id (그 티어에 처음 도달하면 받음)
export const CHARMS = {
  c_bronze: { name: '브론즈 장식', tier: 'bronze', c: 0xc8834a, d: 0x6a3a1a, top: null },
  c_silver: { name: '실버 장식', tier: 'silver', c: 0xc8d0dc, d: 0x5a6270, top: 'pip' },
  c_gold: { name: '골드 장식', tier: 'gold', c: 0xf4c22b, d: 0x8a5a10, top: 'pip3' },
  c_plat: { name: '플래티넘 장식', tier: 'plat', c: 0x5af0d0, d: 0x1a6a6a, top: 'gem' },
  c_diamond: { name: '다이아 장식', tier: 'diamond', c: 0x8ab8ff, d: 0x2a3a9a, top: 'gem' },
  c_king: { name: '왕 장식', tier: 'king', c: 0xff6a5a, d: 0x7a1010, top: 'crown' },
  c_god: { name: '신 장식', tier: 'god', c: 0xffffff, d: 0xb08aff, top: 'wings' },
};
const mats = {};
const mat = (c, glow) => mats[c + (glow ? 'g' : '')] || (mats[c + (glow ? 'g' : '')] = glow ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }));
function box(g, w, h, d, x, y, z, c, s, glow) { const m = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), mat(c, glow)); m.position.set(x * s, y * s, z * s); g.add(m); return m; }

// 장식 모델: 원점 = 매다는 고리, 아래(-y)로 늘어짐. s = 픽셀 크기
export function makeCharm(id, s) {
  const C = CHARMS[id]; if (!C) return null;
  const g = new THREE.Group();
  box(g, 0.5, 0.5, 0.5, 0, 0, 0, 0x8a8f98, s);
  box(g, 0.3, 2.2, 0.3, 0, -1.3, 0, 0x6a7078, s); // 줄
  const p = new THREE.Group(); p.position.y = -4.4 * s; g.add(p);
  box(p, 3.4, 3.8, 0.7, 0, 0, 0, C.d, s);            // 테두리
  box(p, 2.6, 3.0, 0.9, 0, 0.1, 0, C.c, s);          // 판
  box(p, 1.0, 1.0, 1.0, -0.5, 0.6, 0, 0xffffff, s, true); // 반짝
  if (C.top === 'pip') box(p, 0.8, 0.8, 0.8, 0, 2.3, 0, C.c, s);
  else if (C.top === 'pip3') for (const x of [-1, 0, 1]) box(p, 0.6, 0.8, 0.6, x, 2.3, 0, C.c, s);
  else if (C.top === 'gem') box(p, 1.2, 1.2, 1.2, 0, -0.4, 0, 0xffffff, s, true);
  else if (C.top === 'crown') { box(p, 3.2, 0.7, 0.8, 0, 2.2, 0, 0xffd84a, s); for (const x of [-1.2, 0, 1.2]) box(p, 0.6, 0.9, 0.6, x, 2.9, 0, 0xffd84a, s); }
  else if (C.top === 'wings') { for (const sd of [-1, 1]) { box(p, 2.2, 0.8, 0.4, sd * 2.6, 0.9, 0, 0xffffff, s, true); box(p, 1.6, 0.7, 0.4, sd * 2.4, 0.1, 0, 0xe0d0ff, s); } box(p, 1.2, 1.2, 1.2, 0, -0.4, 0, 0xffd84a, s, true); }
  g.userData.plate = p;
  return g;
}
// 상점 아이콘
const icons = {};
export function charmIcon(id, px) {
  px = px || 4;
  const k = id + px; if (icons[k]) return icons[k];
  const C = CHARMS[id]; if (!C) return '';
  const cv = document.createElement('canvas'); cv.width = 12 * px; cv.height = 14 * px; const x = cv.getContext('2d');
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  const r = (c, a, b, w, h) => { x.fillStyle = typeof c === 'number' ? hex(c) : c; x.fillRect(a * px, b * px, w * px, h * px); };
  r('#0b0c0e', 5, 0, 2, 4); r(0x8a8f98, 5.5, 0.5, 1, 3);
  r('#0b0c0e', 2, 5, 8, 8); r(C.d, 3, 6, 6, 6); r(C.c, 4, 7, 4, 4); r('#ffffff', 4, 7, 1.5, 1.5);
  if (C.top === 'crown') { r(0xffd84a, 3, 4, 6, 1.5); r(0xffd84a, 3, 3, 1, 1); r(0xffd84a, 5.5, 3, 1, 1); r(0xffd84a, 8, 3, 1, 1); }
  if (C.top === 'wings') { r('#ffffff', 0, 6, 2.5, 1.5); r('#ffffff', 9.5, 6, 2.5, 1.5); }
  if (C.top === 'gem') r('#ffffff', 5.5, 9, 1, 1);
  return (icons[k] = cv.toDataURL());
}
