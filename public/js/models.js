// 복셀 총기 / 캐릭터 모델, 무기 아이콘
import * as THREE from '../lib/three.module.min.js';
import { skinMats } from './tex.js';
import { GUN_SKINS } from './skins/gunSkins.js';
import { glowMaterial, glowWeight } from './skins/gunMaterial.js';
import { CHAR_SKINS } from './skins/charSkins.js';
import { decorateChar, decorateGun } from './skins/skinFx.js';

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
  burst: { muz: [0, 5.4, 32], grip: [0, 0, 2], boxes: [
    [-1.5, 3, 0, 1.5, 7.5, 15, 'k'], [-0.6, 4.8, 15, 0.6, 6, 30, 'b'], [-1.7, 3.3, 15, 1.7, 7, 24, 'd'], [-1, -4, 7, 1, 3, 10, 'b'],
    [-1.5, 3, -11, 1.5, 6.5, 0, 'k'], [-1.5, 0, -12, 1.5, 3, -9, 'd'], [-1, -3, 1, 1, 3, 4, 'b'], [-1, 7.5, 2, 1, 9.5, 6, 'b'],
    [-1.75, 5, 17, 1.75, 6, 22, 'c'], [-0.9, 4.4, 30, 0.9, 6.4, 32, 'd']] },
  dmr: { muz: [0, 5.6, 40], grip: [0, 0, 2], boxes: [
    [-1.4, 3, 0, 1.4, 7, 16, 'd'], [-0.6, 5, 16, 0.6, 6.2, 38, 'b'], [-1.6, 3.2, 16, 1.6, 6.4, 28, 'w'], [-1.6, 1, -13, 1.6, 7, 0, 'w'], [-1.6, -1, -14, 1.6, 1, -7, 'w'],
    [-1, -3, 8, 1, 3, 11, 'b'], [-1, -3, 1, 1, 3, 4, 'W'], [-1, 7.5, 3, 1, 9.5, 12, 'b'], [-0.8, 7.7, 12, 0.8, 9.3, 12.2, 'c'], [-1, 4.6, 38, 1, 6.6, 40, 'm']] },
  uzi: { muz: [0, 5.2, 13], grip: [0, 0, 4], boxes: [
    [-1.3, 3, 0, 1.3, 7, 10, 'd'], [-0.5, 4.6, 10, 0.5, 5.8, 13, 'b'], [-1, -5, 3, 1, 3, 6, 'b'], [-1, -6, 3, 1, -5, 6, 'm'],
    [-0.5, 7, 1, 0.5, 8, 2, 'b'], [-0.5, 7, 8, 0.5, 8, 9, 'b'], [-1.35, 4.5, 2, 1.35, 5.5, 8, 'k']] },
  dbarrel: { muz: [0, 5.5, 30], grip: [0, 0, 1], boxes: [
    [-1.6, 4.5, 8, -0.1, 6.5, 30, 'm'], [0.1, 4.5, 8, 1.6, 6.5, 30, 'm'], [-1.6, 3, 8, 1.6, 4.5, 20, 'w'], [-1.6, 3, 0, 1.6, 7, 8, 'l'],
    [-1.6, 1, -12, 1.6, 6.5, 0, 'w'], [-1.6, -1, -13, 1.6, 1, -6, 'w'], [-1, -3, -1, 1, 3, 3, 'W'], [-1.7, 4.3, 29, 1.7, 6.7, 30, 'd'], [-0.3, 6.5, 28.5, 0.3, 7.2, 29.5, 'y']] },
  scout: { muz: [0, 5.6, 42], grip: [0, 0, 2], boxes: [
    [-0.6, 5, 14, 0.6, 6.2, 40, 'b'], [-1.4, 3, 0, 1.4, 7, 15, 'g'], [-1, 8, 2, 1, 10, 13, 'b'], [-1.2, 7.8, 11, 1.2, 10.2, 13, 'd'], [-1, 8.2, 12.9, 1, 9.8, 13.1, 'c'],
    [-0.5, 7, 4, 0.5, 8, 5, 'd'], [-0.5, 7, 10, 0.5, 8, 11, 'd'], [-1.4, 1, -12, 1.4, 7, 0, 'g'], [-1.4, -1, -13, 1.4, 1, -6, 'G'],
    [-1, -2, 7, 1, 3, 10, 'b'], [-1, -3, 1, 1, 3, 4, 'b'], [1.4, 6, 3, 2.8, 7, 4.5, 'l'], [-1, 4.6, 40, 1, 6.6, 42, 'd']] },
  rail: { muz: [0, 5, 34], grip: [0, 0, 5], boxes: [
    [-1.4, 3, -4, 1.4, 7.4, 16, 'k'], [-1.8, 3.4, 16, 1.8, 6.8, 17.5, 'c'], [-1.8, 3.4, 21, 1.8, 6.8, 22.5, 'c'], [-1.8, 3.4, 26, 1.8, 6.8, 27.5, 'c'],
    [-1.2, 6, 16, -0.6, 6.8, 34, 'l'], [0.6, 6, 16, 1.2, 6.8, 34, 'l'], [-0.5, 4.5, 16, 0.5, 5.5, 33, 'c'], [-1.2, 3.4, 16, 1.2, 4.2, 34, 'd'],
    [-1, -3, 4, 1, 3, 7, 'b'], [-1.4, 2.5, -12, 1.4, 6.5, -4, 'd'], [-0.9, 7.4, 2, 0.9, 9.2, 10, 'b'], [-1.45, 5, 4, 1.45, 6, 12, 'c']] },
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

// 총 스킨 카탈로그는 skins/gunSkins.js
export { GUN_SKINS };
const METAL_KEYS = { b: 0, d: 0, m: 1, l: 2, k: 2 }, BODY_KEYS = { w: 0, t: 0, g: 0, s: 0, o: 0, W: 1, G: 1 };
function skinColor(ck, gs, i) {
  const base = PAL[ck] != null ? PAL[ck] : ck;
  if (!gs || (!gs.camo && !gs.metal)) return base;
  if ('rycR'.includes(ck)) return gs.acc != null ? gs.acc : base;
  if (gs.camo) return gs.camo[(i * 7 + 3) % gs.camo.length];
  if (ck in METAL_KEYS) { const c = gs.metal[METAL_KEYS[ck]]; return ck === 'b' ? new THREE.Color(c).multiplyScalar(0.55).getHex() : c; }
  if (ck in BODY_KEYS) return gs.body[BODY_KEYS[ck]];
  return base;
}

const _c = new THREE.Color();
function boxGeom(list, scale, gs) {
  const pos = [], nor = [], col = [], glow = [];
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
        glow.push(glowWeight(ck));
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (gs && gs.glow) g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
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
  const mat = gs && gs.glow ? glowMaterial(gskin, gs.glow, scale) : gunMat;
  grp.add(new THREE.Mesh(gm.main, mat));
  if (gm.spin) {
    const pivot = new THREE.Group();
    const cy = (5 - def.grip[1]) * scale;
    pivot.position.set(0, cy, 0);
    const sm = new THREE.Mesh(gm.spin, mat); sm.position.set(0, -cy, 0);
    pivot.add(sm); grp.add(pivot); grp.userData.spin = pivot;
  }
  const m = def.muz;
  grp.userData.muzzle = new THREE.Vector3((m[0] - def.grip[0]) * scale, (m[1] - def.grip[1]) * scale, -(m[2] - def.grip[2]) * scale);
  return grp;
}

// 총 길이 (월드 단위) — 오라 크기 맞출 때
export function gunLength(id, scale) {
  const def = GUNS[id] || GUNS.pistol; let mn = 1e9, mx = -1e9;
  for (const b of def.boxes) { mn = Math.min(mn, b[2]); mx = Math.max(mx, b[5]); }
  return (mx - mn) * (scale || GUN_SCALE);
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
  decorateChar(root, CHAR_SKINS[sid]);
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
  decorateGun(g, GUN_SKINS[gskin], gunLength(id, 0.026), true);
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
