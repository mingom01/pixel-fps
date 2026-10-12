// 복셀 총기 / 캐릭터 모델, 무기 아이콘
import * as THREE from '../lib/three.module.min.js';
import { skinMats } from './tex.js';

const PAL = {
  d: 0x2b2f36, m: 0x4a505a, l: 0x9aa1ab, b: 0x17191c, w: 0x9a6430, W: 0x5e3b1c, g: 0x56663a, G: 0x3c4a2a,
  r: 0xd23b2a, y: 0xe3b341, o: 0xc8752a, s: 0xc2a878, c: 0x5fe3ff, t: 0x8a7a5a, k: 0x6a7480, R: 0x8a2a1e,
};
// 박스: [x0,y0,z0, x1,y1,z1, 색, 태그]  (단위 = 픽셀, z = 총구 방향)
export const GUNS = {
  pistol: { muz: [0, 5.5, 13], grip: [0, 0, 2], boxes: [
    [-1, 4, 0, 1, 7, 12, 'm'], [-1, 2, 1, 1, 4, 11, 'd'], [-1, -4, 0, 1, 2, 4, 'b'], [-0.6, 0, 4, 0.6, 2, 7, 'd'],
    [-0.5, 5, 12, 0.5, 6, 13, 'b'], [-0.5, 7, 0.5, 0.5, 7.7, 1.5, 'b'], [-0.4, 7, 10.5, 0.4, 7.7, 11.5, 'b'], [-1.05, 4.5, 2, 1.05, 6.5, 4, 'l']] },
  magnum: { muz: [0, 6, 19], grip: [0, 0, 1], boxes: [
    [-1, 5, 7, 1, 7, 18, 'l'], [-1.6, 3, 2, 1.6, 7, 8, 'm'], [-1, 3, 0, 1, 7.5, 3, 'l'], [-1, -5, -2, 1, 3, 3, 'w'],
    [-0.6, 0.5, 3, 0.6, 3, 6, 'd'], [-0.4, 7, 16.5, 0.4, 8, 17.5, 'b'], [-0.5, 7.5, -0.5, 0.5, 8.5, 1, 'd'], [-0.8, 4, 18, 0.8, 5, 18.5, 'm']] },
  smg: { muz: [0, 5.2, 21], grip: [0, 0, 4], boxes: [
    [-1.5, 3, 0, 1.5, 7, 16, 'd'], [-0.6, 4.5, 16, 0.6, 5.9, 21, 'b'], [-1, -5, 9, 1, 3, 12, 'b'], [-1, -4, 3, 1, 3, 6, 'b'],
    [-1, 3.5, -7, 1, 5.5, 0, 'm'], [-1, 1, -8, 1, 6, -6, 'm'], [-0.5, 7, 2, 0.5, 8.5, 4, 'b'], [-0.5, 7, 13, 0.5, 8, 14, 'b'], [-1.6, 5, 5, 1.6, 6, 10, 'k']] },
  shotgun: { muz: [0, 6, 31], grip: [0, 0, 1], boxes: [
    [-1, 5, 7, 1, 7, 30, 'm'], [-1, 3, 8, 1, 5, 27, 'd'], [-1.6, 2.5, 15, 1.6, 5.6, 22, 'w'], [-1.6, 3, 0, 1.6, 8, 8, 'd'],
    [-1.6, 1, -12, 1.6, 7, 0, 'w'], [-1.6, -1, -13, 1.6, 1, -6, 'w'], [-1, -3, -1, 1, 3, 3, 'W'], [-0.4, 7, 28.5, 0.4, 8, 29.5, 'y'], [-1.65, 4, 2, 1.65, 6, 5, 'l']] },
  rifle: { muz: [0, 5.6, 29], grip: [0, 0, 2], boxes: [
    [-1.5, 3, 0, 1.5, 7, 14, 'd'], [-0.6, 5, 14, 0.6, 6.2, 28, 'b'], [-1.6, 3.4, 14, 1.6, 6.4, 22, 'w'], [-0.7, 6.4, 14, 0.7, 7.6, 21, 'd'],
    [-1, -3, 8, 1, 3, 11, 'd'], [-1, -6, 9.5, 1, -3, 12.5, 'd'], [-1, -8, 11, 1, -6, 13.5, 'd'], [-1.6, 1, -12, 1.6, 6, 0, 'w'], [-1.6, -1, -13, 1.6, 1, -7, 'w'],
    [-1, -3, 1, 1, 3, 4, 'W'], [-0.4, 6.2, 26, 0.4, 8, 27, 'b'], [-0.6, 7, 1, 0.6, 8, 4, 'b'], [-0.8, 4.6, 28, 0.8, 6.6, 29, 'm']] },
  carbine: { muz: [0, 5.3, 31], grip: [0, 0, 2], boxes: [
    [-1.5, 3, 0, 1.5, 7.5, 14, 'b'], [-1, 7.5, 0, 1, 8.5, 22, 'd'], [-1.7, 3.2, 14, 1.7, 7.2, 23, 't'], [-0.6, 4.7, 23, 0.6, 5.9, 30, 'b'],
    [-1, -4, 7, 1, 3, 10, 'd'], [-1.5, 3, -11, 1.5, 6.5, 0, 't'], [-1.5, 0, -12, 1.5, 3, -9, 't'], [-1, -3, 1, 1, 3, 4, 'b'],
    [-1, 8.5, 3, 1, 11, 7, 'b'], [-0.6, 9, 6.9, 0.6, 10.5, 7.1, 'r'], [-0.9, 4.3, 30, 0.9, 6.3, 31, 'd'], [-0.4, 8.5, 21, 0.4, 10, 22, 'b']] },
  lmg: { muz: [0, 5.5, 35], grip: [0, 0, 2], boxes: [
    [-2, 3, 0, 2, 8, 18, 'g'], [-0.8, 4.8, 18, 0.8, 6.2, 34, 'b'], [-1.3, 4.2, 18, 1.3, 6.8, 27, 'G'], [-2.6, -3, 6, 2.6, 3, 13, 'g'],
    [-1, -2, 31, -0.5, 4.5, 31.6, 'b'], [0.5, -2, 31, 1, 4.5, 31.6, 'b'], [-1.6, 2, -11, 1.6, 7, 0, 'd'], [-1, -3, 1, 1, 3, 4, 'b'],
    [-0.6, 8, 4, 0.6, 10, 5, 'b'], [-0.6, 8, 12, 0.6, 10, 13, 'b'], [-0.6, 9.5, 4, 0.6, 10.5, 13, 'b'], [-2.05, 6, 9, 2.05, 7, 15, 'y'], [-1, 4.3, 34, 1, 6.7, 35, 'd']] },
  sniper: { muz: [0, 5.7, 46], grip: [0, 0, 2], boxes: [
    [-0.7, 5, 14, 0.7, 6.4, 42, 'b'], [-1.5, 3, 0, 1.5, 7, 16, 'G'], [-1.2, 8, 1, 1.2, 10.6, 15, 'b'], [-1.4, 7.8, 13, 1.4, 10.8, 16, 'd'], [-1.4, 7.8, 0, 1.4, 10.8, 2, 'd'],
    [-0.5, 7, 4, 0.5, 8, 5, 'd'], [-0.5, 7, 11, 0.5, 8, 12, 'd'], [-1.6, 1, -14, 1.6, 7, 0, 'G'], [-1.6, -2, -15, 1.6, 1, -6, 'G'], [-1.4, 7, -10, 1.4, 8, -3, 'G'],
    [1.5, 6, 3, 3.2, 7, 4.5, 'l'], [-1, -2, 7, 1, 3, 10, 'b'], [-1, -3, 1, 1, 3, 4, 'b'], [-1.1, 4.4, 42, 1.1, 7, 46, 'd'], [-1.25, 8.4, 15.9, 1.25, 10.2, 16.1, 'c']] },
  rocket: { muz: [0, 5.5, 31], grip: [0, -1, 6], boxes: [
    [-2.5, 3, -8, 2.5, 8, 26, 'g'], [-3, 2.5, 23, 3, 8.5, 27, 'G'], [-3, 2.5, -10, 3, 8.5, -7, 'G'], [-1, -4, 6, 1, 3, 9, 'b'], [-1, -3, 14, 1, 3, 16, 'b'],
    [-0.6, 8, 8, 0.6, 10.5, 11, 'b'], [-1.6, 4, 27, 1.6, 7, 29, 'R'], [-0.8, 4.7, 29, 0.8, 6.3, 31, 'r'], [-2.55, 6, 2, 2.55, 7, 5, 'y']] },
  minigun: { muz: [0, 5, 35], grip: [0, -1, 3], boxes: [
    [-3, 1, 0, 3, 9, 10, 'd'], [-2.6, 2.4, 29, 2.6, 7.6, 31, 'm'], [-2.6, 2.4, 18, 2.6, 7.6, 19.5, 'm'], [-0.8, 9, 1, 0.8, 11, 8, 'b'],
    [-1, -4, 2, 1, 1, 5, 'b'], [3, 0, 1, 6, 6, 8, 'G'], [-3.05, 4, 2, 3.05, 6, 8, 'y'],
    ...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2, cx = Math.cos(a) * 1.6, cy = 5 + Math.sin(a) * 1.6; return [cx - 0.55, cy - 0.55, 10, cx + 0.55, cy + 0.55, 35, 'l', 'spin']; })] },
  knife: { muz: [0, 5, 20], grip: [0, 0, 1], boxes: [
    [-0.3, 4, 6, 0.3, 6.6, 17, 'l'], [-0.3, 4.6, 17, 0.3, 6.2, 19, 'l'], [-0.31, 4, 6, 0.31, 4.6, 18, 'k'], [-1.2, 3, 5, 1.2, 7.6, 6, 'd'], [-0.8, 4, -2, 0.8, 6.6, 5, 'b'], [-0.6, 4.4, -3, 0.6, 6.2, -2, 'm']] },
  claw: { muz: [0, 2, 13], grip: [0, 1, 2], boxes: [
    [-2, 0, 0, 2, 3, 5, 'G'], [-1.8, 1, 5, -0.8, 2.2, 10, 'G'], [-0.5, 1, 5, 0.5, 2.4, 11, 'G'], [0.8, 1, 5, 1.8, 2.2, 10, 'G'],
    [-1.7, 1.2, 10, -0.9, 2, 12.5, 'l'], [-0.4, 1.4, 11, 0.4, 2.2, 13.5, 'l'], [0.9, 1.2, 10, 1.7, 2, 12.5, 'l'], [-2.2, 0, -3, 2.2, 3, 0, 'g']] },
  turret: { muz: [0, 5.5, 27], grip: [0, 5, 5], boxes: [
    [-2.5, 3, 0, 2.5, 8, 10, 'd'], [-0.7, 4.8, 10, 0.7, 6.2, 25, 'b'], [-1.6, 4.3, 10, 1.6, 6.7, 16, 'm'], [2.5, 3.5, 2, 4.5, 7.5, 8, 'g'],
    [-0.6, 8, 2, 0.6, 10, 4, 'b'], [-1, 4.3, 25, 1, 6.7, 27, 'm'], [-2.55, 6, 3, 2.55, 7, 7, 'y'], [-0.4, 8, 7, 0.4, 9.5, 9, 'r']] },
  air: { muz: [0, 5, 33], grip: [0, 5, 16], boxes: [
    [-1.5, 3, 0, 1.5, 7, 30, 'l'], [-1, 3.5, 30, 1, 6.5, 33, 'm'], [-1, 7, 18, 1, 9, 24, 'c'], [-0.5, 7, 0, 0.5, 13, 5, 'l'],
    [-12, 4.5, 12, 12, 5.5, 20, 'k'], [-5, 6, 1, 5, 7, 4, 'k'], [-1.55, 4.5, 8, 1.55, 5.5, 28, 'r'], [-6, 3, 14, -4, 4.5, 17, 'd'], [4, 3, 14, 6, 4.5, 17, 'd']] },
  spike: { muz: [0, 8, 0], grip: [0, 0, 0], boxes: [
    [-3.5, 0, -3.5, 3.5, 2, 3.5, 'd'], [-2.5, 2, -2.5, 2.5, 8, 2.5, 'm'], [-2.6, 3, -0.6, 2.6, 7, 0.6, 'c'], [-0.6, 3, -2.6, 0.6, 7, 2.6, 'c'],
    [-1.5, 8, -1.5, 1.5, 9.5, 1.5, 'd'], [-0.7, 9.5, -0.7, 0.7, 10.5, 0.7, 'r'], [2.5, 1, -1, 4, 2, 1, 'b'], [-4, 1, -1, -2.5, 2, 1, 'b']] },
  nade: { muz: [0, 0, 0], grip: [0, 0, 0], boxes: [
    [-2, -2, -2, 2, 2, 2, 'g'], [-2.2, -0.5, -2.2, 2.2, 0.5, 2.2, 'G'], [-1, 2, -1, 1, 3.5, 1, 'd'], [1, 2.5, -0.4, 2.6, 3.2, 0.4, 'l'], [-0.4, 3.5, -0.4, 0.4, 4.2, 0.4, 'y']] },
};
export const GUN_SCALE = 0.035;

// 총 스킨 (꾸미기 상점): 금속/몸체 색을 바꿈
export const GUN_SKINS = {
  default: { name: '기본', price: 0, lv: 1 },
  camo: { name: '정글 위장', price: 400, lv: 1, camo: [0x4b5320, 0x6b5a3a, 0x2f3a1e, 0x8a7a5a] },
  pink: { name: '핑크', price: 500, lv: 2, metal: [0xb04a82, 0xd45a9a, 0xffc4e0], body: [0xf28bc0, 0xe0609e] },
  gold: { name: '황금', price: 900, lv: 4, metal: [0x9a6e10, 0xd4a520, 0xffe27a], body: [0xc9971f, 0xe6b830] },
  fire: { name: '불꽃', price: 1000, lv: 5, metal: [0x2a1a14, 0x5a2a14, 0xff8a20], body: [0xd2401a, 0xff8a20] },
  neon: { name: '네온', price: 1200, lv: 6, metal: [0x111418, 0x1c2430, 0x3af0ff], body: [0x161a22, 0x22ff9a] },
  ice: { name: '얼음', price: 1300, lv: 7, metal: [0x6aa8d8, 0x9fd0f0, 0xe8f8ff], body: [0xbfe6ff, 0x8ac6ef] },
  diamond: { name: '다이아몬드', price: 2500, lv: 10, metal: [0x1f8fa8, 0x5fd3e8, 0xb0f4ff], body: [0x3bbcd4, 0x86e6f5] },
  desert: { name: '사막 위장', price: 450, lv: 1, camo: [0xc2a878, 0x9a7a4a, 0xe0c890, 0x6b5a3a] },
  arctic: { name: '설원 위장', price: 450, lv: 1, camo: [0xe8eef4, 0xb8c4d0, 0x8a9aaa, 0xffffff] },
  choco: { name: '초콜릿', price: 600, lv: 2, metal: [0x3a2010, 0x5a3018, 0xf0e0c0], body: [0x6b3a1a, 0x8a5028] },
  toxic: { name: '독성', price: 800, lv: 3, metal: [0x1a2a14, 0x2f4a1a, 0x9be03a], body: [0x6ac02a, 0x3a7a1a] },
  blood: { name: '블러드', price: 900, lv: 4, metal: [0x1a0a0a, 0x3a1010, 0xd02020], body: [0x8a1010, 0xb02020] },
  ocean: { name: '오션', price: 900, lv: 4, metal: [0x0a2a4a, 0x1a4a7a, 0x6af0ff], body: [0x2a7ac0, 0x1a5a9a] },
  bone: { name: '해골', price: 1000, lv: 5, metal: [0x2a2a2a, 0x3a3a3a, 0xe8e0c8], body: [0xe8e0c8, 0xc8c0a8] },
  cyber: { name: '사이버펑크', price: 1200, lv: 6, metal: [0x1a0a2a, 0x2a1a4a, 0xff3af0], body: [0x2af0ff, 0x8a3aff] },
  lava: { name: '용암', gold: 60, lv: 1, legend: true, metal: [0x1a0a08, 0x3a1a10, 0xffb020], body: [0xff5010, 0xc02a08] },
  galaxy: { name: '은하수', gold: 100, lv: 1, legend: true, camo: [0x2a1050, 0x4a2a8a, 0x8a5ae0, 0xffffff, 0x1a0a30, 0x3a1a70] },
  rainbow: { name: '무지개', gold: 150, lv: 1, legend: true, camo: [0xe2483a, 0xe27a24, 0xf4c22b, 0x4cbf4c, 0x3d8bf0, 0x8b45c9, 0xe25c9e] },
  dragon: { name: '드래곤', gold: 200, lv: 1, legend: true, metal: [0x1a1a1a, 0x3a0a0a, 0xffd040], body: [0xc02020, 0xe8a020] },
};
const METAL_KEYS = { b: 0, d: 0, m: 1, l: 2, k: 2 }, BODY_KEYS = { w: 0, t: 0, g: 0, s: 0, o: 0, W: 1, G: 1 };
function skinColor(ck, gs, i) {
  const base = PAL[ck] != null ? PAL[ck] : ck;
  if (!gs || (!gs.camo && !gs.metal)) return base;
  if ('rycR'.includes(ck)) return base;
  if (gs.camo) return gs.camo[(i * 7 + 3) % gs.camo.length];
  if (ck in METAL_KEYS) { const c = gs.metal[METAL_KEYS[ck]]; return ck === 'b' ? new THREE.Color(c).multiplyScalar(0.55).getHex() : c; }
  if (ck in BODY_KEYS) return gs.body[BODY_KEYS[ck]];
  return base;
}

const _c = new THREE.Color();
function boxGeom(list, scale, gs) {
  const pos = [], nor = [], col = [];
  const F = [
    [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], 0.82], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], 0.82],
    [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], 1.0], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 0.55],
    [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], 0.92], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], 0.7],
  ];
  list.forEach((bx, bi) => {
    const [x0, y0, z0, x1, y1, z1, ck] = bx;
    _c.setHex(skinColor(ck, gs, bi));
    for (const [n, vs, sh] of F) {
      const v = vs.map(([a, b, c]) => [(a ? x1 : x0) * scale, (b ? y1 : y0) * scale, -(c ? z1 : z0) * scale]);
      for (const i of [0, 2, 1, 0, 3, 2]) { // z 반전으로 감김 순서 뒤집음
        pos.push(...v[i]); nor.push(n[0], n[1], -n[2]);
        col.push(_c.r * sh, _c.g * sh, _c.b * sh);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const gunMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const geomCache = {};
// 총 메시 그룹. 원점=손잡이, -z = 총구 방향
export function makeGun(id, scale, gskin) {
  scale = scale || GUN_SCALE;
  const gs = GUN_SKINS[gskin] || null;
  const def = GUNS[id] || GUNS.pistol, key = id + scale + (gskin || '');
  if (!geomCache[key]) {
    const g = def.grip;
    const sh = (b) => [b[0] - g[0], b[1] - g[1], b[2] - g[2], b[3] - g[0], b[4] - g[1], b[5] - g[2], b[6], b[7]];
    const main = def.boxes.filter(b => b[7] !== 'spin').map(sh), spin = def.boxes.filter(b => b[7] === 'spin').map(sh);
    geomCache[key] = { main: boxGeom(main, scale, gs), spin: spin.length ? boxGeom(spin, scale, gs) : null };
  }
  const grp = new THREE.Group();
  const gm = geomCache[key];
  grp.add(new THREE.Mesh(gm.main, gunMat));
  if (gm.spin) {
    const pivot = new THREE.Group();
    const cy = (5 - def.grip[1]) * scale;
    pivot.position.set(0, cy, 0);
    const sm = new THREE.Mesh(gm.spin, gunMat); sm.position.set(0, -cy, 0);
    pivot.add(sm); grp.add(pivot); grp.userData.spin = pivot;
  }
  const m = def.muz;
  grp.userData.muzzle = new THREE.Vector3((m[0] - def.grip[0]) * scale, (m[1] - def.grip[1]) * scale, -(m[2] - def.grip[2]) * scale);
  return grp;
}

/* ---------- 아이콘 (옆모습 픽셀) ---------- */
const iconCache = {};
export function gunIcon(id, px, gskin) {
  px = px || 2;
  const gs = GUN_SKINS[gskin] || null;
  const k = id + px + (gskin || '');
  if (iconCache[k]) return iconCache[k];
  const def = GUNS[id]; if (!def) return '';
  let minz = 1e9, maxz = -1e9, miny = 1e9, maxy = -1e9;
  for (const b of def.boxes) { minz = Math.min(minz, b[2]); maxz = Math.max(maxz, b[5]); miny = Math.min(miny, b[1]); maxy = Math.max(maxy, b[4]); }
  const pad = 2, W = Math.ceil(maxz - minz) + pad * 2, H = Math.ceil(maxy - miny) + pad * 2;
  const cv = document.createElement('canvas'); cv.width = W * px; cv.height = H * px;
  const ctx = cv.getContext('2d');
  const grid = new Array(W * H).fill(null);
  const sorted = def.boxes.map((b, i) => b.concat([i])).sort((a, b) => a[3] - b[3]);
  for (const b of sorted) {
    const col = skinColor(b[6], gs, b[b.length - 1]);
    for (let y = Math.floor(b[1] - miny); y < Math.ceil(b[4] - miny); y++) for (let z = Math.floor(b[2] - minz); z < Math.ceil(b[5] - minz); z++) {
      const top = y === Math.ceil(b[4] - miny) - 1;
      grid[(H - 1 - (y + pad)) * W + z + pad] = { c: col, f: top ? 1.18 : 1 };
    }
  }
  // 외곽선
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const g = grid[y * W + x];
    if (g) { _c.setHex(g.c).multiplyScalar(g.f); ctx.fillStyle = '#' + _c.getHexString(); ctx.fillRect(x * px, y * px, px, px); }
    else if ((grid[y * W + x - 1] && x > 0) || (grid[y * W + x + 1] && x < W - 1) || (y > 0 && grid[(y - 1) * W + x]) || (y < H - 1 && grid[(y + 1) * W + x])) { ctx.fillStyle = '#0b0c0e'; ctx.fillRect(x * px, y * px, px, px); }
  }
  iconCache[k] = cv.toDataURL();
  return iconCache[k];
}

/* ---------- 캐릭터 ---------- */
const boxG = {};
function bg(w, h, d, oy) {
  const k = [w, h, d, oy].join();
  if (!boxG[k]) { boxG[k] = new THREE.BoxGeometry(w, h, d); boxG[k].translate(0, oy, 0); }
  return boxG[k];
}
// 피벗 기준: 다리=엉덩이, 팔=어깨, 머리=목
const accMat = {};
function amat(c) { return accMat[c] || (accMat[c] = new THREE.MeshLambertMaterial({ color: c })); }
function addBox(parent, w, h, d, x, y, z, c) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), amat(c)); m.position.set(x, y, z); parent.add(m); return m; }
export function makeChar(ci, sid, teamColor) {
  const s = skinMats(ci, sid);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const legL = new THREE.Mesh(bg(0.25, 0.75, 0.25, -0.375), s.leg), legR = new THREE.Mesh(bg(0.25, 0.75, 0.25, -0.375), s.leg);
  legL.position.set(-0.125, 0.75, 0); legR.position.set(0.125, 0.75, 0);
  const torso = new THREE.Mesh(bg(0.5, 0.62, 0.27, 0.31), s.torso); torso.position.set(0, 0.75, 0);
  const upper = new THREE.Group(); upper.position.set(0, 0.75, 0);
  const head = new THREE.Mesh(bg(0.46, 0.46, 0.46, 0.23), s.head); head.position.set(0, 0.62, 0);
  const armL = new THREE.Mesh(bg(0.22, 0.64, 0.22, -0.26), s.arm), armR = new THREE.Mesh(bg(0.22, 0.64, 0.22, -0.26), s.arm);
  armL.position.set(-0.36, 0.56, 0); armR.position.set(0.36, 0.56, 0);
  const gunMount = new THREE.Group(); gunMount.position.set(0, -0.56, -0.08); armR.add(gunMount);
  torso.position.set(0, 0, 0);
  upper.add(torso, head, armL, armR);
  if (s.hat === 'helmet') { addBox(head, 0.53, 0.16, 0.53, 0, 0.47, 0, 0x4b5a2e); addBox(head, 0.58, 0.04, 0.58, 0, 0.39, -0.02, 0x3f4a26); }
  else if (s.hat === 'crown') { addBox(head, 0.48, 0.1, 0.48, 0, 0.51, 0, 0xe3b341); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, -0.2]]) addBox(head, 0.08, 0.1, 0.08, x, 0.6, z, 0xf4d060); addBox(head, 0.08, 0.06, 0.02, 0, 0.51, -0.245, 0xd23b2a); }
  else if (s.hat === 'stem') addBox(head, 0.08, 0.14, 0.08, 0, 0.53, 0, 0x3a6a1a);
  else if (s.hat === 'cap') { addBox(head, 0.5, 0.12, 0.5, 0, 0.49, 0, s.hatColor || 0x1d2440); addBox(head, 0.5, 0.04, 0.2, 0, 0.44, -0.3, 0x111111); addBox(head, 0.1, 0.08, 0.02, 0, 0.5, -0.26, 0xe3b341); }
  else if (s.hat === 'santa') { addBox(head, 0.52, 0.1, 0.52, 0, 0.47, 0, 0xf0f0f0); addBox(head, 0.42, 0.16, 0.42, 0, 0.58, 0, 0xc0202a); addBox(head, 0.26, 0.14, 0.26, 0.06, 0.72, 0.06, 0xc0202a); addBox(head, 0.12, 0.12, 0.12, 0.14, 0.82, 0.14, 0xf0f0f0); }
  else if (s.hat === 'firehelmet') { addBox(head, 0.52, 0.16, 0.52, 0, 0.5, 0, 0xc0202a); addBox(head, 0.56, 0.04, 0.7, 0, 0.42, 0.06, 0xa01818); addBox(head, 0.12, 0.12, 0.04, 0, 0.5, -0.27, 0xe3b341); }
  else if (s.hat === 'cowboy') { addBox(head, 0.8, 0.04, 0.8, 0, 0.46, 0, 0x6b4220); addBox(head, 0.46, 0.16, 0.46, 0, 0.56, 0, 0x7a5028); addBox(head, 0.47, 0.04, 0.47, 0, 0.5, 0, 0x2a1a0a); }
  else if (s.hat === 'plume') { addBox(head, 0.5, 0.06, 0.5, 0, 0.48, 0, 0xa8b0b8); addBox(head, 0.08, 0.3, 0.3, 0, 0.62, 0.05, 0xc0302a); }
  else if (s.hat === 'wizard') { addBox(head, 0.62, 0.05, 0.62, 0, 0.47, 0, 0x3a1a6a); addBox(head, 0.4, 0.18, 0.4, 0, 0.58, 0, 0x4a2a8a); addBox(head, 0.26, 0.18, 0.26, 0.04, 0.75, 0.04, 0x4a2a8a); addBox(head, 0.13, 0.16, 0.13, 0.08, 0.9, 0.08, 0x4a2a8a); addBox(head, 0.08, 0.08, 0.02, 0, 0.6, -0.21, 0xf4d060); }
  else if (s.hat === 'ears') { addBox(head, 0.14, 0.12, 0.08, -0.18, 0.5, 0, 0x1a1a1a); addBox(head, 0.14, 0.12, 0.08, 0.18, 0.5, 0, 0x1a1a1a); }
  else if (s.hat === 'topknot') { addBox(head, 0.14, 0.14, 0.2, 0, 0.52, 0.1, 0x111111); addBox(head, 0.48, 0.05, 0.48, 0, 0.44, 0, 0x111111); }
  else if (s.hat === 'horns') { const hm = 0xe8e0c8; addBox(head, 0.08, 0.2, 0.08, -0.18, 0.55, 0.02, hm); addBox(head, 0.08, 0.2, 0.08, 0.18, 0.55, 0.02, hm); addBox(head, 0.06, 0.1, 0.06, -0.22, 0.68, 0.06, hm); addBox(head, 0.06, 0.1, 0.06, 0.22, 0.68, 0.06, hm); }
  if (s.cape) { const cp = addBox(torso, 0.52, 0.86, 0.04, 0, 0.18, 0.17, s.cape); cp.rotation.x = 0.12; }
  if (teamColor != null) { addBox(head, 0.5, 0.07, 0.5, 0, 0.3, 0, teamColor); addBox(armL, 0.24, 0.08, 0.24, 0, -0.12, 0, teamColor); addBox(armR, 0.24, 0.08, 0.24, 0, -0.12, 0, teamColor); }
  body.add(legL, legR, upper);
  for (const o of [legL, legR, torso, head, armL, armR]) { o.castShadow = false; }
  // 그림자
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; root.add(sh);
  root.userData = { body, legL, legR, upper, head, armL, armR, gunMount, gun: null, gunId: null, walk: 0, shadow: sh };
  return root;
}
const shadowMat = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16; const ctx = cv.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 7) { ctx.fillStyle = `rgba(0,0,0,${d < 4 ? 0.4 : 0.25})`; ctx.fillRect(x, y, 1, 1); } }
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter;
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
})();

export function setCharGun(ch, id, gskin) {
  const u = ch.userData;
  if (u.gunId === id && u.gskin === gskin) return;
  u.gskin = gskin;
  if (u.gun) u.gunMount.remove(u.gun);
  u.gunId = id;
  if (!id) { u.gun = null; return; }
  const g = makeGun(id, 0.026, gskin);
  g.rotation.x = -Math.PI / 2; // 팔(-y) 방향 = 총구(-z)
  u.gunMount.add(g); u.gun = g;
}
// 애니메이션: speed(m/s), pitch, crouch, dt
export function animChar(ch, dt, speed, pitch, crouch, air, dead) {
  const u = ch.userData;
  if (dead) {
    u.deadT = Math.min(1, (u.deadT || 0) + dt * 3);
    u.body.rotation.x = -u.deadT * Math.PI / 2 * 0.98; u.body.position.y = u.deadT * 0.15;
    return;
  }
  u.deadT = 0; u.body.rotation.x = 0;
  u.walk += dt * speed * 1.8;
  const sw = Math.sin(u.walk) * Math.min(1, speed / 5) * 0.8;
  u.legL.rotation.x = air ? 0.5 : sw; u.legR.rotation.x = air ? -0.3 : -sw;
  const cr = crouch ? 1 : 0;
  u.crouchT = (u.crouchT || 0) + (cr - (u.crouchT || 0)) * Math.min(1, dt * 12);
  const c = u.crouchT;
  u.body.position.y = -c * 0.42;
  u.legL.rotation.x += -c * 1.1; u.legR.rotation.x += -c * 1.1;
  u.legL.position.z = u.legR.position.z = c * 0.1;
  u.upper.rotation.x = c * 0.25;
  // 팔: 앞으로 뻗어 조준
  const aim = Math.PI / 2 + pitch - u.upper.rotation.x;
  u.armR.rotation.x = aim; u.armL.rotation.x = aim - 0.1;
  u.armL.rotation.z = 0.5; u.armR.rotation.z = -0.1;
  u.head.rotation.x = pitch * 0.7;
  if (u.gun && u.gun.userData.spin) u.gun.userData.spin.rotation.z += dt * (u.firing ? 30 : 0);
}
