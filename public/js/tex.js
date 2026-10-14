// 픽셀 텍스처 생성 (16x16 블록 아틀라스, 캐릭터 스킨)
import * as THREE from '../lib/three.module.min.js';
import { CHAR_SKINS } from './skins/charSkins.js';
const { B } = window.SH;

const T = 16, COLS = 8;
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
function shade(c, f) { const [r, g, b] = hex(c); return [Math.min(255, r * f) | 0, Math.min(255, g * f) | 0, Math.min(255, b * f) | 0]; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function painter(img, W, ox, oy) {
  return function px(x, y, rgb) {
    if (x < 0 || y < 0 || x >= T || y >= T) return;
    const i = ((oy + y) * W + ox + x) * 4;
    img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
  };
}
// 노이즈 + 디더링으로 기본 채우기
function noiseFill(px, r, base, amt, levels) {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const n = r() * amt * 2 - amt + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * amt * 0.6;
    let f = 1 + n;
    if (levels) f = Math.round(f * levels) / levels;
    px(x, y, shade(base, f));
  }
}

const TILES = [];
const TI = {};
function def(name, fn) { TI[name] = TILES.length; TILES.push(fn); }

def('grass_top', (px, r) => { noiseFill(px, r, 0x5fae3a, 0.16, 6); for (let i = 0; i < 14; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0x7ccd4a, 1)); for (let i = 0; i < 8; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0x4a8f2c, 1)); });
def('grass_side', (px, r) => {
  noiseFill(px, r, 0x8a5a36, 0.16, 6);
  for (let x = 0; x < T; x++) { const d = 3 + (r() * 3 | 0); for (let y = 0; y < d; y++) px(x, y, shade(y === d - 1 ? 0x4a8f2c : 0x5fae3a, 0.92 + r() * 0.16)); }
  for (let i = 0; i < 6; i++) px(r() * 16 | 0, 6 + r() * 10 | 0, shade(0x6b4226, 1));
});
def('dirt', (px, r) => { noiseFill(px, r, 0x8a5a36, 0.18, 6); for (let i = 0; i < 10; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0x6b4226, 1)); for (let i = 0; i < 5; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0xa77650, 1)); });
def('stone', (px, r) => { noiseFill(px, r, 0x8d8f94, 0.12, 6); for (let i = 0; i < 7; i++) { const x = r() * 14 | 0, y = r() * 15 | 0; px(x, y, shade(0x6c6e73, 1)); px(x + 1, y, shade(0x6c6e73, 1)); px(x + 2, y + 1, shade(0x6c6e73, 1)); } });
def('cobble', (px, r) => {
  noiseFill(px, r, 0x6f7177, 0.1, 5);
  const stones = [[1, 1, 6, 4], [8, 0, 7, 5], [0, 6, 4, 5], [5, 6, 6, 4], [12, 6, 4, 5], [1, 12, 6, 4], [8, 11, 7, 5], [5, 10, 3, 2]];
  for (const [sx, sy, w, h] of stones) {
    const c = [0x9a9ca1, 0x8a8c91, 0xa8aaaf][r() * 3 | 0];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(sx + x, sy + y, shade(c, (y === 0 || x === 0 ? 1.12 : y === h - 1 || x === w - 1 ? 0.78 : 1) * (0.95 + r() * 0.1)));
  }
});
def('planks', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = y >> 2, seam = (y & 3) === 3, off = (row * 5) % 16, vs = ((x + off) % 16) === 0;
    px(x, y, shade(0xb5844c, seam || vs ? 0.68 : (0.92 + r() * 0.12) * (1 + ((x * 7 + row * 3) % 5 === 0 ? -0.08 : 0))));
  }
});
def('log_side', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(0x6e4b2a, (x % 4 === 0 ? 0.7 : 0.95 + r() * 0.15) * (r() < 0.06 ? 0.75 : 1))); });
def('log_top', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); px(x, y, d > 6.5 ? shade(0x6e4b2a, 0.9) : shade(0xb88a55, (Math.round(d) % 2 ? 0.85 : 1) * (0.95 + r() * 0.08))); } });
def('leaves', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = r(); px(x, y, shade(v < 0.15 ? 0x245c1c : v < 0.6 ? 0x3d8a2c : 0x52a53a, 0.95 + r() * 0.1)); } });
def('sand', (px, r) => { noiseFill(px, r, 0xe3cf94, 0.07, 8); for (let i = 0; i < 10; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0xcdb57a, 1)); });
def('sandstone_side', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(0xd8c088, (y < 3 ? 1.06 : y > 12 ? 0.86 : y % 5 === 0 ? 0.9 : 0.98) * (0.97 + r() * 0.06))); });
def('sandstone_top', (px, r) => { noiseFill(px, r, 0xdcc48c, 0.05, 8); for (let i = 0; i < T; i++) { px(i, 0, shade(0xc2a870, 1)); px(0, i, shade(0xc2a870, 1)); } });
def('brick', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = y >> 2, mort = (y & 3) === 3 || ((x + (row % 2) * 4) % 8) === 7;
    px(x, y, mort ? shade(0xc8c0b4, 0.9 + r() * 0.1) : shade(row % 2 ? 0xa4442e : 0xb34d34, 0.9 + r() * 0.18));
  }
});
def('concrete', (px, r) => { noiseFill(px, r, 0xb4b7ba, 0.05, 10); for (let i = 0; i < 5; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0x9ea1a4, 1)); });
def('metal', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(0x7f8e9c, [1.1, 1, 0.85, 0.95][x % 4] * (y === 0 || y === 15 ? 0.8 : 1) * (0.97 + r() * 0.06))); for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) px(x, y, shade(0x4f5a66, 1)); });
def('crate', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const edge = x < 2 || y < 2 || x > 13 || y > 13, diag = Math.abs(x - y) < 1.5 || Math.abs(x - (15 - y)) < 1.5;
    px(x, y, shade(edge ? 0x7a5230 : diag ? 0x8c6038 : 0xb98a52, (edge && (x === 0 || y === 0) ? 1.15 : 1) * (0.93 + r() * 0.12) * (!edge && (y % 4 === 0) ? 0.85 : 1)));
  }
});
def('roof', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const ry = y % 4, sc = ry === 3 || (ry === 2 && (x % 4 === 0 || x % 4 === 3)); px(x, y, shade(0x9c3226, (sc ? 0.65 : ry === 0 ? 1.12 : 1) * (0.94 + r() * 0.1))); } });
def('bedrock', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = r(); px(x, y, shade(v < 0.3 ? 0x2a2a2a : v < 0.7 ? 0x4a4a4a : 0x6a6a6a, 1)); } });
def('asphalt', (px, r) => { noiseFill(px, r, 0x45484d, 0.12, 6); for (let i = 0; i < 12; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0x5d6066, 1)); });
def('path', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = r(); px(x, y, shade(v < 0.3 ? 0x8f7a5a : v < 0.7 ? 0xa48d69 : 0x7a6649, 1)); } });
def('hay_side', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade((y === 3 || y === 12) ? 0x8a5a24 : 0xd6ad3a, (x % 2 ? 0.92 : 1.04) * (0.95 + r() * 0.1))); });
def('hay_top', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(0xcfa236, ((x + y) % 3 === 0 ? 0.85 : 1) * (0.95 + r() * 0.1))); });
def('cactus_side', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(0x3f8a2e, (x === 0 || x === 15 ? 0.7 : x % 5 === 2 ? 1.2 : 1) * (0.95 + r() * 0.1))); for (let i = 0; i < 8; i++) px(1 + (r() * 14 | 0), r() * 16 | 0, [235, 230, 200]); });
def('cactus_top', (px, r) => { noiseFill(px, r, 0x4f9c3a, 0.1, 6); for (let i = 0; i < T; i++) { px(i, 0, shade(0x2f6a22, 1)); px(0, i, shade(0x2f6a22, 1)); px(i, 15, shade(0x2f6a22, 1)); px(15, i, shade(0x2f6a22, 1)); } });
for (const [n, c] of [['c_red', 0xb3392e], ['c_blue', 0x2e64b3], ['c_green', 0x3f8a46], ['c_yellow', 0xd9a42b]]) {
  def(n, (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(c, [1.12, 1, 0.82, 1][x % 4] * (y === 0 || y === 15 ? 0.75 : 1) * (0.96 + r() * 0.07))); });
}
def('chisel', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const b = x === 0 || y === 0 || x === 15 || y === 15, inner = x > 3 && x < 12 && y > 3 && y < 12, ring = inner && (x === 4 || x === 11 || y === 4 || y === 11);
    px(x, y, shade(0xd8c088, (b ? 0.78 : ring ? 0.82 : inner && (x + y) % 4 === 0 ? 0.9 : 1.02) * (0.97 + r() * 0.06)));
  }
});
def('lamp', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const b = x < 2 || y < 2 || x > 13 || y > 13; px(x, y, b ? shade(0x6b5a3a, 1) : shade(0xffe08a, 0.92 + r() * 0.12 + ((x + y) % 5 === 0 ? 0.1 : 0))); } });
def('plaster', (px, r) => { noiseFill(px, r, 0xe9e2d0, 0.04, 10); });
def('grate', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const g = x % 4 === 0 || y % 4 === 0; px(x, y, g ? shade(0x8c939b, 0.95 + r() * 0.1) : shade(0x2b2f33, 1)); } });
def('hazard', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, ((x + y) >> 2) % 2 ? shade(0x222222, 1) : shade(0xf0c020, 0.95 + r() * 0.08)); });
def('darkwood', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = y >> 2, seam = (y & 3) === 3, off = (row * 7) % 16, vs = ((x + off) % 16) === 0;
    px(x, y, shade(0x5e3b1e, seam || vs ? 0.65 : 0.92 + r() * 0.14));
  }
});

// ---- 새 맵용 타일 ----
def('snow', (px, r) => { noiseFill(px, r, 0xeef4fa, 0.04, 10); for (let i = 0; i < 10; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0xd4e2f0, 1)); });
def('snow_side', (px, r) => {
  noiseFill(px, r, 0x8a5a36, 0.16, 6);
  for (let x = 0; x < T; x++) { const d = 3 + (r() * 3 | 0); for (let y = 0; y < d; y++) px(x, y, shade(y === d - 1 ? 0xc8d6e4 : 0xeef4fa, 0.95 + r() * 0.08)); }
});
def('ice', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const st = (x + y * 2) % 11 === 0 || (x * 2 + y) % 13 === 0; px(x, y, shade(0x8fc4ec, (st ? 1.18 : 1) * (0.96 + r() * 0.06))); } });
def('pine', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = r(); px(x, y, shade(v < 0.2 ? 0x16331a : v < 0.65 ? 0x22472a : 0x2f5c34, 0.95 + r() * 0.1)); } });
def('mossy', (px, r) => {
  noiseFill(px, r, 0x6f7177, 0.1, 5);
  const stones = [[1, 1, 6, 4], [8, 0, 7, 5], [0, 6, 4, 5], [5, 6, 6, 4], [12, 6, 4, 5], [1, 12, 6, 4], [8, 11, 7, 5]];
  for (const [sx, sy, w, h] of stones) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(sx + x, sy + y, shade(r() < 0.35 ? 0x4f7a2e : 0x8a8c91, (y === 0 || x === 0 ? 1.1 : 1) * (0.92 + r() * 0.12)));
});
def('stonebrick', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const row = y >> 3, mort = (y & 7) === 7 || ((x + (row % 2) * 8) % 16) === 15;
    px(x, y, mort ? shade(0x55575c, 1) : shade(0x8d8f94, ((y & 7) === 0 ? 1.12 : 1) * (0.93 + r() * 0.1)));
  }
});
for (const [n, c] of [['ore_coal', 0x1d1d1d], ['ore_gold', 0xf2c33a], ['ore_dia', 0x5fe3e0]]) {
  def(n, (px, r) => {
    noiseFill(px, r, 0x8d8f94, 0.1, 6);
    for (let i = 0; i < 6; i++) { const x = 1 + (r() * 13 | 0), y = 1 + (r() * 13 | 0); px(x, y, shade(c, 1)); px(x + 1, y, shade(c, 0.85)); px(x, y + 1, shade(c, 1.1)); }
  });
}
def('regolith', (px, r) => { noiseFill(px, r, 0xb8b8b4, 0.08, 8); for (let i = 0; i < 4; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; px(x, y, shade(0x8a8a86, 1)); px(x + 1, y + 1, shade(0xd8d8d4, 1)); } });
def('moonrock', (px, r) => { noiseFill(px, r, 0x6e6e72, 0.12, 6); for (let i = 0; i < 8; i++) px(r() * 16 | 0, r() * 16 | 0, shade(0x4a4a4e, 1)); });
def('panel', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const seam = x === 0 || y === 0 || x === 8; px(x, y, seam ? shade(0x9aa1ab, 1) : shade(0xe6e9ee, 0.97 + r() * 0.04)); } for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(x, y, shade(0x7a818b, 1)); });
def('window', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const frame = x === 0 || y === 0 || x === 15 || y === 15 || x === 7 || y === 7, refl = (x + y) % 9 === 0 || (x + y) % 9 === 1;
    px(x, y, frame ? shade(0x3a3f46, 1) : shade(refl ? 0x9fd0f0 : 0x2f5a8a, 0.95 + r() * 0.06));
  }
});
for (const [n, c] of [['wool_r', 0xc0302a], ['wool_b', 0x2f5fc0], ['wool_w', 0xe8e8e8], ['wool_y', 0xe8b420]]) {
  def(n, (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(c, (((x * 3 + y * 5) % 7) === 0 ? 0.86 : 1) * (0.94 + r() * 0.1))); });
}
def('gold', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const b = x === 0 || y === 0, d = x === 15 || y === 15; px(x, y, shade(0xf2c33a, (b ? 1.2 : d ? 0.7 : (x - y) % 7 === 0 ? 1.15 : 1) * (0.96 + r() * 0.06))); } });
def('glowc', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const b = x < 2 || y < 2 || x > 13 || y > 13; px(x, y, b ? shade(0x1a2a3a, 1) : shade(0x5ff0ff, 0.9 + r() * 0.12 + ((x + y) % 4 === 0 ? 0.08 : 0))); } });

// ---- 기믹 블록 ----
def('lava', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const w = Math.sin(x * 0.7 + Math.sin(y * 0.5) * 2) + Math.sin(y * 0.9 + x * 0.2); px(x, y, shade(w > 1.1 ? 0xffe060 : w > 0.2 ? 0xff8a1a : 0xd23a0a, 0.92 + r() * 0.12)); } });
def('jumppad', (px, r) => {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const b = x < 2 || y < 2 || x > 13 || y > 13, ar = (y >= 3 && y <= 8 && Math.abs(x - 7.5) <= y - 2.5) || (y >= 9 && y <= 12 && x >= 6 && x <= 9);
    px(x, y, b ? shade(0x2a3a2a, 1) : ar ? shade(0xd8ffb0, 1) : shade(0x3adf5a, 0.9 + r() * 0.12));
  }
});
def('jumppad_side', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, y < 3 ? shade(0x3adf5a, 1) : shade(0x5a636e, (x % 4 === 0 ? 0.8 : 1) * (0.95 + r() * 0.08))); });
def('portal', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5), sw = Math.sin(a * 3 + d * 0.9); px(x, y, d > 7.2 ? shade(0x2a1040, 1) : shade(sw > 0.3 ? 0xe0a0ff : sw > -0.4 ? 0x9a4aff : 0x5a1ab0, 0.92 + r() * 0.12)); } });
def('conveyor', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const stripe = (y % 4) < 2, chev = Math.abs(x - 7.5) + (y % 8) < 6 && Math.abs(x - 7.5) + (y % 8) > 4; px(x, y, chev ? shade(0xf0c020, 1) : shade(stripe ? 0x3a3e44 : 0x2a2d32, 0.95 + r() * 0.08)); } });
def('quicksand', (px, r) => { noiseFill(px, r, 0xb89a5a, 0.14, 6); for (let i = 0; i < 3; i++) { const cx = r() * 16, cy = r() * 16; for (let a = 0; a < 6.28; a += 0.4) px(cx + Math.cos(a) * 2.5 | 0, cy + Math.sin(a) * 2.5 | 0, shade(0x8a6a3a, 1)); } });
def('electric', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const z = (Math.abs(((x + y * 2) % 12) - 6) < 1) || (Math.abs(((x * 2 - y + 32) % 14) - 7) < 1); px(x, y, z ? shade(0xfff060, 1) : shade(0x22262e, 0.9 + r() * 0.15)); } });
def('voidb', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = r(); px(x, y, shade(v < 0.3 ? 0xffffff : v < 0.75 ? 0xe8eef8 : 0xc8d4e8, 1)); } });
def('basalt', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, shade(0x56504f, (x % 5 === 0 ? 0.72 : 1) * (0.9 + r() * 0.2))); });
def('neon_p', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const b = x < 2 || y < 2 || x > 13 || y > 13; px(x, y, b ? shade(0x2a0a2a, 1) : shade(0xff4ad8, 0.9 + r() * 0.12)); } });
def('neon_b', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const b = x < 2 || y < 2 || x > 13 || y > 13; px(x, y, b ? shade(0x0a1a2a, 1) : shade(0x3ab8ff, 0.9 + r() * 0.12)); } });
def('obsidian', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = r(); px(x, y, shade(v < 0.03 ? 0x6a4aa8 : v < 0.6 ? 0x1e1a26 : 0x28222f, 1)); } });
def('trampoline', (px, r) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const b = x < 2 || y < 2 || x > 13 || y > 13, ring = Math.abs(Math.hypot(x - 7.5, y - 7.5) - 4) < 1; px(x, y, b ? shade(0xe2483a, 1) : ring ? shade(0xffffff, 1) : shade(0x2a6ae0, 0.92 + r() * 0.1)); } });
def('cloud', (px, r) => { noiseFill(px, r, 0xf4f8ff, 0.05, 10); });
def('marble', (px, r) => { noiseFill(px, r, 0xeae6e0, 0.04, 10); for (let i = 0; i < 3; i++) { let x = r() * 16, y = 0; for (; y < 16; y++) { x += (r() - 0.5) * 2; px(x | 0, y, shade(0xb8b0a8, 1)); } } });

// 블록 → [윗면, 옆면, 아랫면]
export const FACES = {};
const f3 = (b, t, s, bo) => { FACES[b] = [TI[t], TI[s || t], TI[bo || t]]; };
f3(B.GRASS, 'grass_top', 'grass_side', 'dirt'); f3(B.DIRT, 'dirt'); f3(B.STONE, 'stone'); f3(B.COBBLE, 'cobble'); f3(B.PLANKS, 'planks');
f3(B.LOG, 'log_top', 'log_side'); f3(B.LEAVES, 'leaves'); f3(B.SAND, 'sand'); f3(B.SANDSTONE, 'sandstone_top', 'sandstone_side', 'sandstone_top');
f3(B.BRICK, 'brick'); f3(B.CONCRETE, 'concrete'); f3(B.METAL, 'concrete', 'metal'); f3(B.CRATE, 'crate'); f3(B.ROOF, 'roof'); f3(B.BEDROCK, 'bedrock');
f3(B.ASPHALT, 'asphalt'); f3(B.PATH, 'path'); f3(B.HAY, 'hay_top', 'hay_side'); f3(B.CACTUS, 'cactus_top', 'cactus_side');
f3(B.CRED, 'c_red'); f3(B.CBLUE, 'c_blue'); f3(B.CGREEN, 'c_green'); f3(B.CYELLOW, 'c_yellow'); f3(B.CHISEL, 'sandstone_top', 'chisel');
f3(B.LAMP, 'lamp'); f3(B.PLASTER, 'plaster'); f3(B.GRATE, 'grate'); f3(B.HAZARD, 'hazard'); f3(B.DARKWOOD, 'darkwood');
f3(B.SNOW, 'snow', 'snow_side', 'dirt'); f3(B.ICE, 'ice'); f3(B.PINE, 'pine'); f3(B.MOSSY, 'mossy'); f3(B.STONEBRICK, 'stonebrick');
f3(B.ORE_COAL, 'ore_coal'); f3(B.ORE_GOLD, 'ore_gold'); f3(B.ORE_DIA, 'ore_dia'); f3(B.REGOLITH, 'regolith'); f3(B.MOONROCK, 'moonrock');
f3(B.LAVA, 'lava'); f3(B.JUMPPAD, 'jumppad', 'jumppad_side', 'basalt'); f3(B.PORTAL, 'portal'); f3(B.CONVEYOR, 'conveyor', 'metal'); f3(B.QUICKSAND, 'quicksand'); f3(B.ELECTRIC, 'electric', 'metal');
f3(B.VOIDB, 'voidb'); f3(B.BASALT, 'basalt'); f3(B.NEON_P, 'neon_p'); f3(B.NEON_B, 'neon_b'); f3(B.OBSIDIAN, 'obsidian'); f3(B.TRAMPOLINE, 'trampoline', 'c_blue'); f3(B.CLOUD, 'cloud'); f3(B.MARBLE, 'marble');
f3(B.PANEL, 'panel'); f3(B.WINDOW, 'panel', 'window'); f3(B.WOOL_R, 'wool_r'); f3(B.WOOL_B, 'wool_b'); f3(B.WOOL_W, 'wool_w'); f3(B.WOOL_Y, 'wool_y'); f3(B.GOLD, 'gold'); f3(B.GLOWC, 'glowc');
export const GLOW = new Set([B.LAMP, B.GLOWC, B.LAVA, B.JUMPPAD, B.PORTAL, B.ELECTRIC, B.NEON_P, B.NEON_B]);
// 블록 대표색 (파편용)
export const BLOCK_COLOR = {};

export const ATLAS_COLS = COLS;
export const ATLAS_ROWS = Math.ceil(TILES.length / COLS);
export function makeAtlas() {
  const W = COLS * T, H = ATLAS_ROWS * T;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  TILES.forEach((fn, i) => fn(painter(img, W, (i % COLS) * T, Math.floor(i / COLS) * T), rng(i * 7919 + 13)));
  ctx.putImageData(img, 0, 0);
  // 대표색
  for (const b in FACES) {
    const ti = FACES[b][0], ox = (ti % COLS) * T, oy = Math.floor(ti / COLS) * T;
    let r = 0, g = 0, bb = 0;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const i = ((oy + y) * W + ox + x) * 4; r += img.data[i]; g += img.data[i + 1]; bb += img.data[i + 2]; }
    BLOCK_COLOR[b] = (Math.round(r / 256) << 16) | (Math.round(g / 256) << 8) | Math.round(bb / 256);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, cv };
}

/* ---------- 캐릭터 스킨 ---------- */
export const PCOLORS = [0xd8382f, 0x2f6fd8, 0x3aa23a, 0xe0b52a, 0x8b45c9, 0xe27a24, 0x2fb8c4, 0xe25c9e, 0xe8e8e8, 0x2b2b2b, 0x8a5a2e, 0x9be03a];
export const PCOLOR_NAMES = ['빨강', '파랑', '초록', '노랑', '보라', '주황', '하늘', '분홍', '하양', '검정', '갈색', '연두'];
const SKINS = [0xf2c9a0, 0xe0ac7e, 0xc68a5c, 0x8d5a3b];
const HAIRS = [0x3b2416, 0x1d1d1d, 0x8a5a2e, 0xd9b45a, 0xb3392e];

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); draw(ctx);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rect(ctx, c, x, y, w, h) { ctx.fillStyle = typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c; ctx.fillRect(x, y, w, h); }
function dither(ctx, base, w, h, r, amt) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [a, b, c] = shade(base, 1 + (r() - 0.5) * amt + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * amt * 0.5); ctx.fillStyle = `rgb(${a},${b},${c})`; ctx.fillRect(x, y, 1, 1); }
}
function hexs(c) { return '#' + c.toString(16).padStart(6, '0'); }

// 캐릭터 스킨 (꾸미기 상점)
export { CHAR_SKINS };
const toN = (arr) => arr.reduce((a, v) => a * 256 + v, 0);
function camo(ctx, cols, w, h, r) {
  dither(ctx, cols[0], w, h, r, 0.08);
  for (let i = 0; i < (w * h) / 5; i++) { const x = r() * w | 0, y = r() * h | 0, c = cols[1 + (r() * (cols.length - 1) | 0)]; rect(ctx, c, x, y, 1 + (r() < 0.5 ? 1 : 0), 1); }
}
function stripes(ctx, c1, c2, w, h) { for (let y = 0; y < h; y++) rect(ctx, (y >> 1) % 2 ? c2 : c1, 0, y, w, 1); }
function normalFace(ctx, sp, r) {
  dither(ctx, sp.skin, 8, 8, r, 0.08);
  rect(ctx, sp.hair, 0, 0, 8, 2); rect(ctx, sp.hair, 0, 2, 1, 1); rect(ctx, sp.hair, 7, 2, 1, 1);
  rect(ctx, '#ffffff', 1, 4, 2, 1); rect(ctx, '#ffffff', 5, 4, 2, 1);
  rect(ctx, '#2a4ab0', 2, 4, 1, 1); rect(ctx, '#2a4ab0', 5, 4, 1, 1);
  rect(ctx, toN(shade(sp.skin, 0.75)), 3, 5, 2, 1);
  rect(ctx, '#6b2a20', 3, 6, 2, 1);
}
function skinSpec(ci, sid) {
  const sp = {
    skin: SKINS[ci % SKINS.length], hair: HAIRS[(ci * 3) % HAIRS.length], shirt: PCOLORS[ci % PCOLORS.length],
    pants: ci === 9 ? 0x3a3f4a : 0x2f3a56, boots: 0x2a1d14, hat: null,
    shirtPaint: null, pantsPaint: null, face: normalFace, chest: null,
    side: (ctx, s, r) => { dither(ctx, s.skin, 8, 8, r, 0.08); rect(ctx, s.hair, 0, 0, 8, 3); rect(ctx, s.hair, 0, 3, 2, 2); },
    back: (ctx, s, r) => { dither(ctx, s.hair, 8, 8, r, 0.15); rect(ctx, s.skin, 0, 7, 8, 1); },
    top: (ctx, s, r) => dither(ctx, s.hair, 8, 8, r, 0.15),
  };
  switch (sid) {
    case 'soldier': {
      const C = [0x55663a, 0x3f4a2a, 0x6b6a45, 0x2f3622];
      Object.assign(sp, { shirt: 0x55663a, pants: 0x3f4a2a, boots: 0x1d1d1d, hat: 'helmet', hair: 0x2a2018 });
      sp.shirtPaint = (ctx, w, h, r) => camo(ctx, C, w, h, r);
      sp.pantsPaint = (ctx, w, h, r) => camo(ctx, [0x3f4a2a, 0x2f3622, 0x55663a], w, h, r);
      sp.chest = (ctx) => { rect(ctx, '#2a2418', 0, 7, 8, 1); rect(ctx, '#4a4030', 1, 4, 2, 2); rect(ctx, '#4a4030', 5, 4, 2, 2); rect(ctx, '#2a2418', 1, 0, 1, 7); rect(ctx, '#2a2418', 6, 0, 1, 7); rect(ctx, '#c8c8c8', 2, 1, 1, 1); };
      sp.acc = [['torso', 0.38, 0.4, 0.14, 0, 0.32, 0.2, 0x4a5a2e], ['torso', 0.3, 0.12, 0.06, 0, 0.18, 0.29, 0x3a4a22]];
      break;
    }
    case 'pirate':
      Object.assign(sp, { shirt: 0xeeeeee, pants: 0x2a2a3a, hair: 0x3a2414 });
      sp.shirtPaint = (ctx, w, h) => stripes(ctx, 0xeeeeee, 0xc0302a, w, h);
      sp.face = (ctx, s, r) => { normalFace(ctx, s, r); rect(ctx, '#c0302a', 0, 0, 8, 2); rect(ctx, '#111111', 1, 3, 3, 2); rect(ctx, '#111111', 0, 2, 1, 1); rect(ctx, '#5a3a1a', 1, 6, 6, 2); rect(ctx, '#6b2a20', 3, 6, 2, 1); };
      sp.side = (ctx, s, r) => { dither(ctx, s.skin, 8, 8, r, 0.08); rect(ctx, '#c0302a', 0, 0, 8, 3); rect(ctx, '#111111', 0, 3, 8, 1); rect(ctx, '#5a3a1a', 6, 5, 2, 3); };
      sp.back = (ctx, s) => { rect(ctx, '#c0302a', 0, 0, 8, 4); rect(ctx, s.hair, 0, 4, 8, 4); rect(ctx, '#c0302a', 3, 4, 2, 3); };
      sp.top = (ctx) => rect(ctx, '#c0302a', 0, 0, 8, 8);
      break;
    case 'zombie':
      Object.assign(sp, { skin: 0x6aa84f, hair: 0x2a3a1a, shirt: 0x3a8fa0, pants: 0x4a3a7a, boots: 0x2a2a2a });
      sp.face = (ctx, s, r) => { dither(ctx, s.skin, 8, 8, r, 0.14); rect(ctx, s.hair, 0, 0, 8, 1); rect(ctx, '#111111', 1, 3, 2, 2); rect(ctx, '#111111', 5, 3, 2, 2); rect(ctx, '#d02020', 2, 4, 1, 1); rect(ctx, '#d02020', 5, 4, 1, 1); rect(ctx, '#2a1a10', 2, 6, 4, 1); rect(ctx, '#e8e0c0', 3, 6, 1, 1); };
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0x3a8fa0, w, h, r, 0.14); for (let i = 0; i < 4; i++) rect(ctx, 0x6aa84f, r() * w | 0, 2 + (r() * (h - 3) | 0), 1, 1); rect(ctx, 0x6aa84f, 0, h - 1, w, 1); };
      break;
    case 'ninja':
      Object.assign(sp, { shirt: 0x1b1b22, pants: 0x1b1b22, boots: 0x111111, hair: 0x1b1b22 });
      sp.face = (ctx, s, r) => { dither(ctx, 0x1b1b22, 8, 8, r, 0.1); rect(ctx, '#c0302a', 0, 1, 8, 1); rect(ctx, s.skin, 0, 3, 8, 2); rect(ctx, '#ffffff', 1, 3, 2, 1); rect(ctx, '#ffffff', 5, 3, 2, 1); rect(ctx, '#111111', 2, 3, 1, 1); rect(ctx, '#111111', 5, 3, 1, 1); };
      sp.side = (ctx, s, r) => { dither(ctx, 0x1b1b22, 8, 8, r, 0.1); rect(ctx, '#c0302a', 0, 1, 8, 1); };
      sp.back = (ctx, s, r) => { dither(ctx, 0x1b1b22, 8, 8, r, 0.1); rect(ctx, '#c0302a', 0, 1, 8, 1); rect(ctx, '#c0302a', 3, 2, 1, 3); rect(ctx, '#c0302a', 4, 2, 1, 2); };
      sp.chest = (ctx) => { rect(ctx, '#c0302a', 0, 7, 8, 1); rect(ctx, '#2a2a33', 3, 1, 2, 5); };
      break;
    case 'pumpkin': {
      const P0 = 0xe07a1f;
      Object.assign(sp, { shirt: 0x2f5a2a, pants: 0x4a3020, hat: 'stem' });
      const pk = (ctx, r) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) rect(ctx, toN(shade(P0, (x % 3 === 0 ? 0.82 : 1) * (0.95 + r() * 0.1))), x, y, 1, 1); };
      sp.face = (ctx, s, r) => { pk(ctx, r); rect(ctx, '#2a1200', 1, 2, 2, 2); rect(ctx, '#2a1200', 5, 2, 2, 2); rect(ctx, '#ffd040', 2, 3, 1, 1); rect(ctx, '#ffd040', 5, 3, 1, 1); rect(ctx, '#2a1200', 1, 5, 6, 1); rect(ctx, '#2a1200', 2, 6, 1, 1); rect(ctx, '#2a1200', 4, 6, 1, 1); rect(ctx, '#2a1200', 6, 6, 1, 1); rect(ctx, '#ffb020', 3, 5, 2, 1); };
      sp.side = (ctx, s, r) => pk(ctx, r); sp.back = (ctx, s, r) => pk(ctx, r);
      sp.top = (ctx, s, r) => { pk(ctx, r); rect(ctx, '#3a6a1a', 3, 3, 2, 2); };
      break;
    }
    case 'robot':
      Object.assign(sp, { skin: 0x9aa3ad, shirt: 0x7d8790, pants: 0x4f5862, boots: 0x2b2f36, hair: 0x6b7480 });
      sp.face = (ctx, s, r) => { dither(ctx, 0x9aa3ad, 8, 8, r, 0.06); rect(ctx, '#15181d', 1, 3, 6, 2); rect(ctx, '#ff3030', 2, 3, 1, 1); rect(ctx, '#ff3030', 5, 3, 1, 1); rect(ctx, '#5a626c', 2, 6, 4, 1); rect(ctx, '#d0d6dc', 0, 0, 8, 1); rect(ctx, '#3a3f46', 0, 0, 1, 1); rect(ctx, '#3a3f46', 7, 0, 1, 1); };
      sp.side = (ctx, s, r) => { dither(ctx, 0x8a939d, 8, 8, r, 0.06); rect(ctx, '#3a3f46', 3, 3, 2, 2); };
      sp.back = (ctx, s, r) => { dither(ctx, 0x8a939d, 8, 8, r, 0.06); rect(ctx, '#5a626c', 1, 2, 6, 1); rect(ctx, '#5a626c', 1, 5, 6, 1); };
      sp.top = (ctx, s, r) => { dither(ctx, 0x9aa3ad, 8, 8, r, 0.06); rect(ctx, '#ff3030', 3, 3, 2, 2); };
      sp.chest = (ctx) => { rect(ctx, '#5a626c', 1, 1, 6, 5); rect(ctx, '#3af0ff', 3, 2, 2, 2); rect(ctx, '#ffd040', 2, 5, 1, 1); rect(ctx, '#ff3030', 5, 5, 1, 1); };
      sp.acc = [['head', 0.04, 0.16, 0.04, 0.13, 0.54, 0, 0x5a626c], ['head', 0.09, 0.09, 0.09, 0.13, 0.65, 0, 0xff3030], ['arms', 0.27, 0.12, 0.27, 0.01, 0.0, 0, 0x5a626c]];
      break;
    case 'astro':
      Object.assign(sp, { skin: 0xdfe3e8, shirt: 0xeef1f4, pants: 0xe2e6ea, boots: 0x8a9099, hair: 0xeef1f4 });
      sp.face = (ctx, s, r) => { dither(ctx, 0xeef1f4, 8, 8, r, 0.05); rect(ctx, '#1f3a6a', 1, 2, 6, 5); rect(ctx, '#3a64a8', 1, 2, 6, 1); rect(ctx, '#bfe0ff', 2, 3, 1, 1); rect(ctx, '#e27a24', 0, 7, 8, 1); };
      sp.side = (ctx, s, r) => { dither(ctx, 0xeef1f4, 8, 8, r, 0.05); rect(ctx, '#e27a24', 0, 7, 8, 1); rect(ctx, '#9aa3ad', 3, 3, 2, 2); };
      sp.back = (ctx, s, r) => { dither(ctx, 0xeef1f4, 8, 8, r, 0.05); rect(ctx, '#e27a24', 0, 7, 8, 1); };
      sp.top = (ctx, s, r) => dither(ctx, 0xeef1f4, 8, 8, r, 0.05);
      sp.chest = (ctx) => { rect(ctx, '#3d8bf0', 1, 1, 2, 2); rect(ctx, '#e2483a', 5, 1, 2, 1); rect(ctx, '#9aa3ad', 2, 4, 4, 2); rect(ctx, '#e27a24', 0, 9, 8, 1); };
      sp.acc = [['torso', 0.42, 0.46, 0.16, 0, 0.32, 0.21, 0xd8dce0], ['torso', 0.08, 0.08, 0.04, -0.12, 0.44, 0.3, 0x3af0ff], ['torso', 0.08, 0.08, 0.04, 0.12, 0.44, 0.3, 0xff3030]];
      break;
    case 'king':
      Object.assign(sp, { shirt: 0xb3202a, pants: 0x5a1a1a, hat: 'crown', hair: 0xe8e8e8, cape: 0x8a1018 });
      sp.acc = [['arms', 0.27, 0.1, 0.27, 0.01, 0.02, 0, 0xf4f1e6]];
      sp.face = (ctx, s, r) => { normalFace(ctx, s, r); rect(ctx, '#e8e8e8', 1, 6, 6, 2); rect(ctx, '#e8e8e8', 0, 5, 1, 2); rect(ctx, '#e8e8e8', 7, 5, 1, 2); rect(ctx, '#6b2a20', 3, 6, 2, 1); };
      sp.chest = (ctx) => { rect(ctx, '#e3b341', 3, 0, 2, 10); rect(ctx, '#f4f1e6', 0, 9, 8, 1); rect(ctx, '#e3b341', 0, 0, 8, 1); rect(ctx, '#3d8bf0', 3, 3, 2, 1); };
      break;
    case 'police':
      Object.assign(sp, { shirt: 0x2a3a6a, pants: 0x1d2440, boots: 0x111111, hat: 'cap', hatColor: 0x1d2440 });
      sp.chest = (ctx) => { rect(ctx, '#e3b341', 5, 2, 2, 2); rect(ctx, '#1d2440', 0, 7, 8, 1); rect(ctx, '#e8e8e8', 3, 0, 2, 1); rect(ctx, '#c0302a', 3, 1, 2, 3); };
      break;
    case 'clown':
      Object.assign(sp, { shirt: 0xf4c22b, pants: 0x2f6fd8, hair: 0xe2483a, boots: 0xc0302a });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xf4c22b, w, h, r, 0.08); for (let i = 0; i < w * h / 6; i++) rect(ctx, ['#e2483a', '#3d8bf0', '#4cbf4c'][i % 3], r() * w | 0, r() * h | 0, 1, 1); };
      sp.face = (ctx, s2, r) => { dither(ctx, 0xf4f0ea, 8, 8, r, 0.04); rect(ctx, '#e2483a', 0, 0, 8, 2); rect(ctx, '#2a4ab0', 1, 3, 2, 2); rect(ctx, '#2a4ab0', 5, 3, 2, 2); rect(ctx, '#ffffff', 1, 3, 1, 1); rect(ctx, '#ffffff', 5, 3, 1, 1); rect(ctx, '#e2483a', 3, 4, 2, 2); rect(ctx, '#c0302a', 1, 6, 6, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, 0xf4f0ea, 8, 8, r, 0.04); rect(ctx, '#e2483a', 0, 0, 8, 4); rect(ctx, '#f4c22b', 0, 0, 3, 2); };
      sp.back = (ctx) => { rect(ctx, '#e2483a', 0, 0, 8, 6); rect(ctx, '#3d8bf0', 2, 1, 2, 2); };
      sp.top = (ctx) => { rect(ctx, '#e2483a', 0, 0, 8, 8); rect(ctx, '#4cbf4c', 2, 2, 4, 4); };
      break;
    case 'santa':
      Object.assign(sp, { shirt: 0xc0202a, pants: 0xc0202a, boots: 0x111111, hair: 0xf0f0f0, hat: 'santa' });
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#f0f0f0', 0, 5, 8, 3); rect(ctx, '#f0f0f0', 0, 0, 8, 2); rect(ctx, '#e8a090', 3, 5, 2, 1); rect(ctx, '#6b2a20', 3, 6, 2, 1); };
      sp.chest = (ctx) => { rect(ctx, '#f0f0f0', 3, 0, 2, 10); rect(ctx, '#111111', 0, 7, 8, 1); rect(ctx, '#e3b341', 3, 7, 2, 1); rect(ctx, '#f0f0f0', 0, 9, 8, 1); };
      break;
    case 'firefighter':
      Object.assign(sp, { shirt: 0xc8a24a, pants: 0xb8923a, boots: 0x1d1d1d, hat: 'firehelmet' });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xc8a24a, w, h, r, 0.08); rect(ctx, '#e8f070', 0, 4, w, 1); rect(ctx, '#b0b8c0', 0, 5, w, 1); rect(ctx, '#e8f070', 0, 8, w, 1); };
      break;
    case 'cowboy':
      Object.assign(sp, { shirt: 0xd8c8a0, pants: 0x3a4a6a, boots: 0x5a3018, hat: 'cowboy' });
      sp.chest = (ctx) => { rect(ctx, '#6b4220', 0, 0, 2, 9); rect(ctx, '#6b4220', 6, 0, 2, 9); rect(ctx, '#c0302a', 3, 0, 2, 2); rect(ctx, '#3a2a1a', 0, 8, 8, 1); rect(ctx, '#e3b341', 3, 8, 2, 1); };
      break;
    case 'skeleton':
      Object.assign(sp, { skin: 0xe8e0c8, shirt: 0x1a1a1a, pants: 0x1a1a1a, boots: 0xe8e0c8, hair: 0xe8e0c8 });
      sp.face = (ctx, s2, r) => { dither(ctx, 0xe8e0c8, 8, 8, r, 0.06); rect(ctx, '#111111', 1, 2, 2, 3); rect(ctx, '#111111', 5, 2, 2, 3); rect(ctx, '#111111', 3, 5, 2, 1); for (let x = 1; x < 7; x += 2) rect(ctx, '#111111', x, 7, 1, 1); };
      sp.side = (ctx, s2, r) => dither(ctx, 0xe8e0c8, 8, 8, r, 0.06); sp.back = sp.side; sp.top = sp.side;
      sp.shirtPaint = (ctx, w, h) => { rect(ctx, '#1a1a1a', 0, 0, w, h); for (let y = 1; y < h - 1; y += 2) rect(ctx, '#e8e0c8', 1, y, w - 2, 1); rect(ctx, '#e8e0c8', (w >> 1) - 1 < 0 ? 0 : (w >> 1) - 1, 0, 1, h); };
      sp.pantsPaint = (ctx, w, h) => { rect(ctx, '#1a1a1a', 0, 0, w, h); rect(ctx, '#e8e0c8', 1, 0, w > 2 ? w - 2 : 1, h); };
      break;
    case 'knight':
      Object.assign(sp, { skin: 0xb8c0c8, shirt: 0xa8b0b8, pants: 0x8a929a, boots: 0x5a626a, hair: 0xa8b0b8, hat: 'plume' });
      sp.face = (ctx, s2, r) => { dither(ctx, 0xb8c0c8, 8, 8, r, 0.08); rect(ctx, '#2a2e33', 1, 3, 6, 1); rect(ctx, '#2a2e33', 3, 4, 2, 3); rect(ctx, '#d8e0e8', 0, 0, 8, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, 0xa8b0b8, 8, 8, r, 0.08); rect(ctx, '#d8e0e8', 0, 0, 8, 1); }; sp.back = sp.side; sp.top = sp.side;
      sp.chest = (ctx) => { rect(ctx, '#c0302a', 2, 1, 4, 6); rect(ctx, '#f0f0f0', 3, 2, 2, 4); rect(ctx, '#f0f0f0', 2, 3, 4, 1); rect(ctx, '#5a626a', 0, 8, 8, 2); };
      sp.acc = [['arms', 0.29, 0.13, 0.29, 0.02, 0.03, 0, 0xc8d0d8], ['arms', 0.25, 0.05, 0.25, 0.02, -0.06, 0, 0x8a929a]];
      break;
    case 'panda':
      Object.assign(sp, { skin: 0xf0f0f0, shirt: 0xf0f0f0, pants: 0x1a1a1a, boots: 0x1a1a1a, hair: 0x1a1a1a, hat: 'ears' });
      sp.face = (ctx, s2, r) => { dither(ctx, 0xf4f4f4, 8, 8, r, 0.04); rect(ctx, '#1a1a1a', 1, 3, 2, 2); rect(ctx, '#1a1a1a', 5, 3, 2, 2); rect(ctx, '#ffffff', 2, 3, 1, 1); rect(ctx, '#ffffff', 5, 3, 1, 1); rect(ctx, '#1a1a1a', 3, 5, 2, 1); };
      sp.side = (ctx, s2, r) => dither(ctx, 0xf4f4f4, 8, 8, r, 0.04); sp.back = sp.side; sp.top = sp.side;
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xf0f0f0, w, h, r, 0.04); rect(ctx, '#1a1a1a', 0, 0, w, 3); };
      break;
    case 'wizard':
      Object.assign(sp, { shirt: 0x4a2a8a, pants: 0x3a1a6a, boots: 0x2a1a4a, hair: 0xe8e8e8, hat: 'wizard' });
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#e8e8e8', 1, 6, 6, 2); rect(ctx, '#e8e8e8', 2, 5, 1, 1); rect(ctx, '#e8e8e8', 5, 5, 1, 1); };
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0x4a2a8a, w, h, r, 0.1); for (let i = 0; i < 4; i++) rect(ctx, '#f4d060', r() * w | 0, r() * h | 0, 1, 1); };
      break;
    case 'alien':
      Object.assign(sp, { skin: 0x7ae05a, shirt: 0xb0b8c0, pants: 0x8a929a, boots: 0x5a626a, hair: 0x7ae05a });
      sp.face = (ctx, s2, r) => { dither(ctx, 0x7ae05a, 8, 8, r, 0.08); rect(ctx, '#111111', 0, 2, 3, 3); rect(ctx, '#111111', 5, 2, 3, 3); rect(ctx, '#ffffff', 1, 2, 1, 1); rect(ctx, '#ffffff', 6, 2, 1, 1); rect(ctx, '#3a8a2a', 3, 6, 2, 1); };
      sp.side = (ctx, s2, r) => dither(ctx, 0x7ae05a, 8, 8, r, 0.08); sp.back = sp.side; sp.top = (ctx, s2, r) => { dither(ctx, 0x7ae05a, 8, 8, r, 0.08); rect(ctx, '#3a8a2a', 3, 3, 2, 2); };
      sp.chest = (ctx) => { rect(ctx, '#5fe3ff', 3, 2, 2, 2); rect(ctx, '#7a828a', 0, 7, 8, 1); };
      break;
    case 'samurai':
      Object.assign(sp, { shirt: 0xa82020, pants: 0x1a1a1a, boots: 0x1a1a1a, hair: 0x111111, hat: 'topknot' });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xa82020, w, h, r, 0.08); for (let y = 1; y < h; y += 3) rect(ctx, '#2a0a0a', 0, y, w, 1); };
      sp.chest = (ctx) => { rect(ctx, '#e3b341', 3, 1, 2, 2); rect(ctx, '#111111', 0, 8, 8, 2); };
      sp.acc = [['arms', 0.3, 0.1, 0.28, 0.03, 0.02, 0, 0x8a1010], ['arms', 0.3, 0.04, 0.28, 0.03, -0.05, 0, 0xe3b341]];
      break;
    case 'hero':
      Object.assign(sp, { shirt: 0x2f5fd0, pants: 0x2f5fd0, boots: 0xc0202a, hair: 0x1a1a1a, cape: 0xc0202a });
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#1a1a1a', 0, 3, 8, 2); rect(ctx, '#ffffff', 1, 4, 2, 1); rect(ctx, '#ffffff', 5, 4, 2, 1); };
      sp.chest = (ctx) => { rect(ctx, '#f4c22b', 2, 1, 4, 4); rect(ctx, '#c0202a', 3, 2, 2, 2); rect(ctx, '#f4c22b', 0, 8, 8, 1); };
      break;
    case 'shadow':
      Object.assign(sp, { skin: 0x1a1420, shirt: 0x14101a, pants: 0x0e0a12, boots: 0x0a080c, hair: 0x14101a, cape: 0x2a1040 });
      sp.face = (ctx, s2, r) => { dither(ctx, 0x14101a, 8, 8, r, 0.1); rect(ctx, '#c050ff', 1, 3, 2, 1); rect(ctx, '#c050ff', 5, 3, 2, 1); rect(ctx, '#6a2aa0', 0, 1, 8, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, 0x14101a, 8, 8, r, 0.1); rect(ctx, '#6a2aa0', 0, 1, 8, 1); }; sp.back = sp.side; sp.top = sp.side;
      sp.chest = (ctx) => { rect(ctx, '#c050ff', 3, 2, 2, 1); rect(ctx, '#6a2aa0', 2, 3, 4, 1); rect(ctx, '#c050ff', 0, 8, 8, 1); };
      break;
    case 'dragon':
      Object.assign(sp, { skin: 0x3a8a3a, shirt: 0x2a6a2a, pants: 0x1f4a1f, boots: 0x6a1a10, hair: 0x2a6a2a, hat: 'horns', wings: { kind: 'bat', c1: 0x9a1a10, c2: 0x2a6a2a } });
      sp.shirtPaint = (ctx, w, h, r) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rect(ctx, toN(shade((x + (y >> 1)) % 3 ? 0x2a6a2a : 0x3a8a3a, 0.9 + r() * 0.2)), x, y, 1, 1); };
      sp.face = (ctx, s2, r) => { dither(ctx, 0x3a8a3a, 8, 8, r, 0.12); rect(ctx, '#ffd040', 1, 3, 2, 1); rect(ctx, '#ffd040', 5, 3, 2, 1); rect(ctx, '#111111', 2, 3, 1, 1); rect(ctx, '#111111', 5, 3, 1, 1); rect(ctx, '#ff6a20', 2, 6, 4, 1); };
      sp.side = (ctx, s2, r) => dither(ctx, 0x2a6a2a, 8, 8, r, 0.12); sp.back = sp.side; sp.top = sp.side;
      sp.chest = (ctx) => { rect(ctx, '#e3b341', 2, 2, 4, 5); rect(ctx, '#c08a20', 3, 3, 2, 3); };
      break;
    case 'golden':
      Object.assign(sp, { skin: 0xf2c33a, shirt: 0xe0aa20, pants: 0xc8901a, boots: 0x9a6a10, hair: 0xffe27a, hat: 'crown', cape: 0xffffff });
      sp.shirtPaint = (ctx, w, h, r) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rect(ctx, toN(shade(0xe0aa20, (x - y) % 4 === 0 ? 1.25 : 0.92 + r() * 0.12)), x, y, 1, 1); };
      sp.face = (ctx, s2, r) => { dither(ctx, 0xf2c33a, 8, 8, r, 0.08); rect(ctx, '#7a4a00', 1, 3, 6, 1); rect(ctx, '#ffffff', 2, 3, 1, 1); rect(ctx, '#ffffff', 5, 3, 1, 1); rect(ctx, '#ffe27a', 0, 0, 8, 1); };
      sp.side = (ctx, s2, r) => dither(ctx, 0xf2c33a, 8, 8, r, 0.1); sp.back = sp.side; sp.top = sp.side;
      sp.chest = (ctx) => { rect(ctx, '#ffffff', 3, 2, 2, 2); rect(ctx, '#d23b2a', 3, 3, 2, 1); rect(ctx, '#9a6a10', 0, 8, 8, 1); };
      sp.acc = [['arms', 0.29, 0.12, 0.29, 0.02, 0.03, 0, 0xffd84a], ['arms', 0.31, 0.04, 0.31, 0.02, -0.04, 0, 0xffffff]];
      break;
    case 'diver':
      Object.assign(sp, { shirt: 0xe8701a, pants: 0x1a1a22, boots: 0x111111, hair: 0xe8701a });
      sp.face = (ctx, s2, r) => { dither(ctx, 0xe8701a, 8, 8, r, 0.08); rect(ctx, '#2a3a4a', 1, 1, 6, 5); rect(ctx, '#7ac8e8', 2, 2, 4, 3); rect(ctx, '#d8f4ff', 2, 2, 1, 1); rect(ctx, '#9aa1ab', 3, 6, 2, 2); };
      sp.side = (ctx, s2, r) => { dither(ctx, 0xe8701a, 8, 8, r, 0.08); rect(ctx, '#9aa1ab', 3, 3, 2, 2); }; sp.back = sp.side; sp.top = (ctx, s2, r) => dither(ctx, 0xe8701a, 8, 8, r, 0.08);
      sp.chest = (ctx) => { rect(ctx, '#1a1a22', 0, 0, 8, 1); rect(ctx, '#ffd040', 1, 2, 6, 1); rect(ctx, '#1a1a22', 0, 8, 8, 1); };
      break;
    case 'chef':
      Object.assign(sp, { shirt: 0xf4f4f4, pants: 0x2a2a2a, boots: 0x1a1a1a, hat: 'chef' });
      sp.pantsPaint = (ctx, w, h) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rect(ctx, (x + y) % 2 ? '#2a2a2a' : '#e8e8e8', x, y, 1, 1); };
      sp.chest = (ctx) => { rect(ctx, '#d0d0d0', 2, 1, 1, 1); rect(ctx, '#d0d0d0', 5, 1, 1, 1); rect(ctx, '#d0d0d0', 2, 4, 1, 1); rect(ctx, '#d0d0d0', 5, 4, 1, 1); rect(ctx, '#e2483a', 3, 0, 2, 1); };
      break;
    case 'gamer':
      Object.assign(sp, { shirt: 0x22252e, pants: 0x2a3040, boots: 0xf0f0f0, hair: 0x3a2a1a, hat: 'headset' });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0x22252e, w, h, r, 0.1); rect(ctx, '#5aff8a', 0, 2, w, 1); };
      sp.chest = (ctx) => { rect(ctx, '#5aff8a', 2, 3, 4, 3); rect(ctx, '#22252e', 3, 4, 2, 1); rect(ctx, '#3a3e48', 1, 7, 6, 2); };
      break;
    case 'vampire':
      Object.assign(sp, { skin: 0xe8e0e8, shirt: 0x1a1a1e, pants: 0x1a1a1e, boots: 0x0a0a0a, hair: 0x14101a, cape: 0x8a0a1a });
      sp.face = (ctx, s2, r) => { dither(ctx, 0xe8e0e8, 8, 8, r, 0.05); rect(ctx, '#14101a', 0, 0, 8, 2); rect(ctx, '#14101a', 3, 2, 2, 1); rect(ctx, '#d01a2a', 1, 3, 2, 1); rect(ctx, '#d01a2a', 5, 3, 2, 1); rect(ctx, '#5a0a14', 2, 6, 4, 1); rect(ctx, '#ffffff', 2, 7, 1, 1); rect(ctx, '#ffffff', 5, 7, 1, 1); };
      sp.chest = (ctx) => { rect(ctx, '#f4f4f4', 2, 0, 4, 3); rect(ctx, '#d01a2a', 3, 1, 2, 1); rect(ctx, '#8a0a1a', 0, 8, 8, 1); };
      break;
    case 'cyborg':
      Object.assign(sp, { shirt: 0x3a3e48, pants: 0x22252e, boots: 0x14161a, hair: 0x2a2a2a });
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#9aa1ab', 4, 0, 4, 8); rect(ctx, '#5a626c', 4, 2, 4, 1); rect(ctx, '#ff2a2a', 5, 3, 2, 1); rect(ctx, '#5a626c', 4, 6, 4, 1); };
      sp.chest = (ctx) => { rect(ctx, '#9aa1ab', 4, 0, 4, 10); rect(ctx, '#ff2a2a', 5, 3, 2, 2); rect(ctx, '#5a626c', 0, 8, 8, 1); };
      break;
    case 'pharaoh':
      Object.assign(sp, { skin: 0xc68a5c, shirt: 0xf0e8d0, pants: 0xf0e8d0, boots: 0xe3b341, hat: 'nemes' });
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#1a1a1a', 1, 3, 2, 1); rect(ctx, '#1a1a1a', 5, 3, 2, 1); rect(ctx, '#2f5fd0', 0, 3, 1, 1); rect(ctx, '#2f5fd0', 7, 3, 1, 1); rect(ctx, '#e3b341', 3, 7, 2, 1); };
      sp.chest = (ctx) => { for (let x = 0; x < 8; x++) rect(ctx, x % 2 ? '#2f5fd0' : '#e3b341', x, 0, 1, 3); rect(ctx, '#e3b341', 0, 8, 8, 1); rect(ctx, '#2f5fd0', 3, 8, 2, 1); };
      break;
    case 'masked':
      Object.assign(sp, { shirt: 0x14141a, pants: 0x14141a, boots: 0x0a0a0a, hair: 0x14141a, cape: 0x4a1a6a });
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#14141a', 0, 0, 8, 2); rect(ctx, '#f4f4f4', 0, 2, 8, 3); rect(ctx, '#111111', 1, 3, 2, 1); rect(ctx, '#111111', 5, 3, 2, 1); rect(ctx, '#ffd040', 0, 2, 1, 1); rect(ctx, '#ffd040', 7, 2, 1, 1); };
      sp.chest = (ctx) => { rect(ctx, '#f4f4f4', 3, 0, 2, 5); rect(ctx, '#14141a', 3, 1, 2, 1); rect(ctx, '#a02a2a', 3, 2, 2, 1); };
      break;
    case 'valkyrie':
      Object.assign(sp, { skin: 0xf2c9a0, shirt: 0xc8d0d8, pants: 0x8a929a, boots: 0xe3b341, hair: 0xf4d880, hat: 'winghelm', wings: { kind: 'feather', c1: 0xffffff, c2: 0xe0e8f4 } });
      sp.acc = [['arms', 0.29, 0.12, 0.29, 0.02, 0.03, 0, 0xffd040]];
      sp.shirtPaint = (ctx, w, h, r) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rect(ctx, toN(shade(0xc8d0d8, (y % 3 === 0 ? 1.18 : 0.94) * (0.95 + r() * 0.1))), x, y, 1, 1); };
      sp.chest = (ctx) => { rect(ctx, '#ffd040', 3, 1, 2, 5); rect(ctx, '#ffd040', 1, 3, 6, 1); rect(ctx, '#ffd040', 0, 8, 8, 1); };
      sp.back = (ctx, s2) => { rect(ctx, s2.hair, 0, 0, 8, 8); rect(ctx, '#e0c060', 3, 0, 2, 8); };
      break;
    case 'voidwalker':
      Object.assign(sp, { skin: 0x1a0a3a, shirt: 0x14082e, pants: 0x0e061e, boots: 0x6a3ad0, hair: 0x14082e, cape: 0x2a0a5a });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0x14082e, w, h, r, 0.12); for (let i = 0; i < w * h / 7; i++) rect(ctx, r() < 0.6 ? '#ffffff' : '#c08aff', r() * w | 0, r() * h | 0, 1, 1); };
      sp.pantsPaint = sp.shirtPaint;
      sp.face = (ctx, s2, r) => { dither(ctx, 0x1a0a3a, 8, 8, r, 0.12); rect(ctx, '#e0c8ff', 1, 3, 2, 1); rect(ctx, '#e0c8ff', 5, 3, 2, 1); rect(ctx, '#8a5aff', 0, 0, 8, 1); rect(ctx, '#ffffff', 6, 6, 1, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, 0x1a0a3a, 8, 8, r, 0.12); rect(ctx, '#ffffff', r() * 8 | 0, r() * 8 | 0, 1, 1); }; sp.back = sp.side; sp.top = sp.side;
      break;
    case 's1_agent': // 시즌1 비밀 요원: 검은 정장 · 선글라스 · 이어피스
      Object.assign(sp, { hair: 0x1a1a1a, shirt: 0x15161c, pants: 0x15161c, boots: 0x0a0a0a });
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#0a0a0a', 0, 3, 8, 2); rect(ctx, '#3af0ff', 1, 3, 2, 1); rect(ctx, '#3af0ff', 5, 3, 2, 1); rect(ctx, '#6b2a20', 3, 6, 2, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, s2.skin, 8, 8, r, 0.06); rect(ctx, s2.hair, 0, 0, 8, 3); rect(ctx, '#0a0a0a', 4, 3, 4, 1); rect(ctx, '#3af0ff', 1, 4, 1, 2); };
      sp.chest = (ctx) => { rect(ctx, '#f4f4f4', 3, 0, 2, 4); rect(ctx, '#0a0a0a', 3, 1, 2, 4); rect(ctx, '#3af0ff', 6, 2, 1, 1); rect(ctx, '#0a0a0a', 0, 9, 8, 1); };
      break;
    case 's1_ranger': // 시즌1 사막 레인저: 모래색 망토 · 고글 · 스카프
      Object.assign(sp, { hair: 0x5a3a1a, shirt: 0xc8a060, pants: 0x6a5032, boots: 0x3a2410, hat: 'fedora', hatColor: 0x8a6a3a, cape: 0xb08a50 });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xc8a060, w, h, r, 0.1); rect(ctx, '#ffb040', 0, 1, w, 1); };
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#3a2a1a', 0, 3, 8, 1); rect(ctx, '#ffb040', 1, 3, 2, 1); rect(ctx, '#ffb040', 5, 3, 2, 1); rect(ctx, '#c84a2a', 0, 5, 8, 3); };
      sp.chest = (ctx) => { rect(ctx, '#c84a2a', 1, 0, 6, 2); rect(ctx, '#5a3a1a', 0, 3, 8, 1); rect(ctx, '#5a3a1a', 2, 4, 1, 4); rect(ctx, '#ffb040', 5, 5, 2, 2); rect(ctx, '#3a2410', 0, 9, 8, 1); };
      sp.acc = [['arms', 0.28, 0.1, 0.28, 0.02, 0.02, 0, 0x8a6a3a]];
      break;
    case 's1_lord': // 시즌1 픽셀 군주: 무지개 망토 · 왕관 · 날개
      Object.assign(sp, { skin: 0xf2c9a0, hair: 0xffffff, shirt: 0x2a1040, pants: 0x1a0a2a, boots: 0xffd84a, hat: 'crown', cape: 0x7a2aa0, wings: { kind: 'feather', c1: 0xffffff, c2: 0xffd84a } });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0x2a1040, w, h, r, 0.08); const C = ['#ff5a5a', '#ffd84a', '#5aff8a', '#5ab8ff', '#d85aff']; for (let y = 0; y < h; y++) rect(ctx, C[y % 5], 0, y, 1, 1), rect(ctx, C[(y + 2) % 5], w - 1, y, 1, 1); };
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#ffd84a', 1, 4, 2, 1); rect(ctx, '#ffd84a', 5, 4, 2, 1); rect(ctx, '#7a2aa0', 2, 4, 1, 1); rect(ctx, '#7a2aa0', 5, 4, 1, 1); };
      sp.chest = (ctx) => { rect(ctx, '#ffd84a', 2, 1, 4, 4); rect(ctx, '#ff5a7a', 3, 2, 2, 2); rect(ctx, '#ffffff', 3, 2, 1, 1); rect(ctx, '#ffd84a', 0, 8, 8, 1); };
      sp.acc = [['arms', 0.29, 0.12, 0.29, 0.02, 0.03, 0, 0xffd84a]];
      break;
    case 'politician': // 정치인: 남색 정장 · 빨간 넥타이 · 금배지 · 2:8 가르마 · 안경 · 활짝 웃음
      Object.assign(sp, { skin: 0xf2c9a0, hair: 0x2a2a30, shirt: 0x1e2a4a, pants: 0x1e2a4a, boots: 0x111111 });
      sp.shirtPaint = (ctx, w, h, r) => dither(ctx, 0x1e2a4a, w, h, r, 0.06);
      sp.face = (ctx, s2, r) => {
        dither(ctx, s2.skin, 8, 8, r, 0.06);
        rect(ctx, s2.hair, 0, 0, 8, 2); rect(ctx, s2.hair, 0, 2, 1, 2); rect(ctx, s2.hair, 7, 2, 1, 1); rect(ctx, s2.hair, 3, 2, 5, 1); rect(ctx, '#55555e', 2, 0, 1, 2);
        rect(ctx, '#ffffff', 1, 4, 2, 1); rect(ctx, '#ffffff', 5, 4, 2, 1); rect(ctx, '#2a2a2a', 2, 4, 1, 1); rect(ctx, '#2a2a2a', 5, 4, 1, 1);
        rect(ctx, '#1a1a1a', 0, 4, 1, 1); rect(ctx, '#1a1a1a', 3, 4, 2, 1); rect(ctx, '#1a1a1a', 7, 4, 1, 1); rect(ctx, '#1a1a1a', 1, 3, 2, 1); rect(ctx, '#1a1a1a', 5, 3, 2, 1);
        rect(ctx, '#6b2a20', 2, 6, 4, 1); rect(ctx, '#ffffff', 3, 6, 2, 1); rect(ctx, toN(shade(s2.skin, 0.8)), 3, 5, 2, 1);
      };
      sp.side = (ctx, s2, r) => { dither(ctx, s2.skin, 8, 8, r, 0.06); rect(ctx, s2.hair, 0, 0, 8, 3); rect(ctx, s2.hair, 0, 3, 3, 2); rect(ctx, '#1a1a1a', 3, 4, 5, 1); };
      sp.back = (ctx, s2, r) => { dither(ctx, s2.hair, 8, 8, r, 0.08); rect(ctx, s2.skin, 0, 7, 8, 1); };
      sp.chest = (ctx) => {
        rect(ctx, '#f4f4f4', 2, 0, 4, 4); rect(ctx, '#c0202a', 3, 1, 2, 1); rect(ctx, '#a01820', 3, 2, 2, 4); rect(ctx, '#e04040', 3, 3, 1, 1);
        rect(ctx, '#141c34', 1, 0, 1, 6); rect(ctx, '#141c34', 6, 0, 1, 6); rect(ctx, '#e3b341', 5, 2, 1, 1);
        rect(ctx, '#0a0f1e', 3, 7, 1, 1); rect(ctx, '#0a0f1e', 4, 8, 1, 1); rect(ctx, '#111111', 0, 9, 8, 1);
      };
      sp.acc = [['torso', 0.1, 0.03, 0.03, -0.15, 0.45, -0.145, 0xf4f4f4]];
      break;
    case 'detective':
      Object.assign(sp, { shirt: 0xb89a68, pants: 0x4a4038, boots: 0x2a1a10, hat: 'fedora', hatColor: 0x5a4632, hair: 0x3a2416 });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xb89a68, w, h, r, 0.08); rect(ctx, '#8a7048', 0, 6, w, 1); };
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#5a3a1a', 5, 6, 3, 1); rect(ctx, '#3a2010', 7, 5, 1, 1); rect(ctx, toN(shade(s2.skin, 0.85)), 1, 7, 6, 1); };
      sp.chest = (ctx) => { rect(ctx, '#d8c8a8', 1, 0, 2, 3); rect(ctx, '#d8c8a8', 5, 0, 2, 3); rect(ctx, '#3a2a1a', 3, 0, 2, 1); rect(ctx, '#5a4632', 2, 4, 1, 1); rect(ctx, '#5a4632', 5, 4, 1, 1); rect(ctx, '#5a4632', 2, 7, 1, 1); rect(ctx, '#5a4632', 5, 7, 1, 1); rect(ctx, '#6a5030', 0, 6, 8, 1); rect(ctx, '#c8a040', 3, 6, 2, 1); };
      break;
    case 'doctor':
      Object.assign(sp, { shirt: 0xf4f4f4, pants: 0x3a7a8a, boots: 0xf0f0f0 });
      sp.shirtPaint = (ctx, w, h, r) => dither(ctx, 0xf4f4f4, w, h, r, 0.03);
      sp.chest = (ctx) => { rect(ctx, '#3a7a8a', 3, 0, 2, 3); rect(ctx, '#2a2a2a', 2, 0, 1, 4); rect(ctx, '#2a2a2a', 5, 0, 1, 4); rect(ctx, '#2a2a2a', 3, 4, 2, 1); rect(ctx, '#c0c8d0', 4, 5, 1, 1); rect(ctx, '#d8d8d8', 1, 6, 2, 2); rect(ctx, '#3d8bf0', 1, 5, 1, 2); rect(ctx, '#e2483a', 6, 1, 1, 1); rect(ctx, '#d8d8d8', 0, 9, 8, 1); };
      sp.acc = [['head', 0.16, 0.16, 0.03, -0.12, 0.42, -0.24, 0xd8e0e8], ['head', 0.5, 0.04, 0.5, 0, 0.42, 0, 0x2a2a2a]];
      break;
    case 'student':
      Object.assign(sp, { shirt: 0x23305a, pants: 0x3a4258, boots: 0x111111, hair: 0x1d1d1d });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0x23305a, w, h, r, 0.06); rect(ctx, '#e0c040', 0, h - 3, w, 1); };
      sp.chest = (ctx) => { rect(ctx, '#f4f4f4', 2, 0, 4, 4); rect(ctx, '#a02030', 3, 1, 2, 5); rect(ctx, '#e0c040', 3, 3, 2, 1); rect(ctx, '#ffffff', 5, 4, 2, 1); rect(ctx, '#3d8bf0', 5, 4, 1, 1); rect(ctx, '#e0c040', 0, 7, 8, 1); rect(ctx, '#111111', 0, 9, 8, 1); };
      sp.acc = [['torso', 0.4, 0.42, 0.14, 0, 0.3, 0.2, 0x3d8bf0], ['torso', 0.06, 0.4, 0.04, -0.14, 0.32, -0.15, 0x2a5aa0], ['torso', 0.06, 0.4, 0.04, 0.14, 0.32, -0.15, 0x2a5aa0]];
      break;
    case 'idol':
      Object.assign(sp, { hair: 0xff8ac8, shirt: 0xf8f0ff, pants: 0x2a2a3a, boots: 0xffffff, hat: 'headset' });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xf8f0ff, w, h, r, 0.03); for (let i = 0; i < w * h / 6; i++) rect(ctx, ['#ff5aa8', '#5ad8ff', '#ffd84a'][i % 3], r() * w | 0, r() * h | 0, 1, 1); };
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, s2.hair, 0, 2, 1, 4); rect(ctx, s2.hair, 7, 2, 1, 4); rect(ctx, s2.hair, 1, 2, 2, 1); rect(ctx, '#ff9ab8', 1, 5, 1, 1); rect(ctx, '#ff9ab8', 6, 5, 1, 1); rect(ctx, '#ffd84a', 6, 3, 1, 1); rect(ctx, '#e04070', 3, 6, 2, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, s2.skin, 8, 8, r, 0.08); rect(ctx, s2.hair, 0, 0, 8, 3); rect(ctx, s2.hair, 0, 3, 4, 5); };
      sp.back = (ctx, s2, r) => dither(ctx, s2.hair, 8, 8, r, 0.1);
      sp.chest = (ctx) => { rect(ctx, '#ff5aa8', 2, 0, 1, 2); rect(ctx, '#ff5aa8', 5, 0, 1, 2); rect(ctx, '#ff8ac8', 3, 1, 2, 1); rect(ctx, '#ffd84a', 3, 4, 2, 2); rect(ctx, '#ff5aa8', 0, 8, 8, 1); };
      break;
    case 'seonbi': // 조선 선비: 흰 도포 · 갓 · 수염
      Object.assign(sp, { hair: 0x111111, shirt: 0xf4f0e6, pants: 0xeee8d8, boots: 0x2a2a2a, hat: 'gat' });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xf4f0e6, w, h, r, 0.04); rect(ctx, '#d8d0bc', 0, h - 2, w, 1); };
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#1a1a1a', 2, 6, 1, 1); rect(ctx, '#1a1a1a', 5, 6, 1, 1); rect(ctx, '#1a1a1a', 3, 7, 2, 1); rect(ctx, '#1a1a1a', 1, 3, 2, 1); rect(ctx, '#1a1a1a', 5, 3, 2, 1); };
      sp.chest = (ctx) => { rect(ctx, '#d8d0bc', 2, 0, 1, 1); rect(ctx, '#d8d0bc', 3, 1, 1, 1); rect(ctx, '#d8d0bc', 4, 2, 1, 1); rect(ctx, '#d8d0bc', 5, 3, 1, 1); rect(ctx, '#ffffff', 1, 0, 1, 1); rect(ctx, '#3a2a6a', 4, 3, 2, 1); rect(ctx, '#3a2a6a', 5, 4, 1, 3); rect(ctx, '#2a6aa0', 0, 7, 8, 1); rect(ctx, '#e04040', 1, 7, 1, 2); };
      break;
    case 'angel':
      Object.assign(sp, { hair: 0xf4d880, shirt: 0xffffff, pants: 0xf4f0e0, boots: 0xe3b341, hat: 'halo', wings: { kind: 'feather', c1: 0xffffff, c2: 0xfff2c8 } });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xffffff, w, h, r, 0.03); rect(ctx, '#ffd040', 0, h - 1, w, 1); };
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, s2.hair, 0, 2, 1, 3); rect(ctx, s2.hair, 7, 2, 1, 3); rect(ctx, '#ffb0b0', 1, 5, 1, 1); rect(ctx, '#ffb0b0', 6, 5, 1, 1); };
      sp.chest = (ctx) => { rect(ctx, '#ffd040', 1, 0, 1, 1); rect(ctx, '#ffd040', 2, 1, 1, 1); rect(ctx, '#ffd040', 3, 2, 1, 1); rect(ctx, '#ffd040', 4, 3, 1, 1); rect(ctx, '#ffd040', 5, 4, 1, 1); rect(ctx, '#ffd040', 6, 5, 1, 1); rect(ctx, '#ffd040', 0, 7, 8, 1); rect(ctx, '#5ad8ff', 3, 7, 2, 1); };
      break;
    case 'demon':
      Object.assign(sp, { skin: 0xb8282a, hair: 0x1a0a0a, shirt: 0x1a0a0e, pants: 0x1a0a0e, boots: 0x0a0a0a, hat: 'horns', wings: { kind: 'bat', c1: 0x5a0a14, c2: 0x1a0406 } });
      sp.face = (ctx, s2, r) => { dither(ctx, 0xb8282a, 8, 8, r, 0.1); rect(ctx, s2.hair, 0, 0, 8, 2); rect(ctx, '#1a0a0a', 1, 3, 2, 1); rect(ctx, '#1a0a0a', 5, 3, 2, 1); rect(ctx, '#ffd040', 1, 4, 2, 1); rect(ctx, '#ffd040', 5, 4, 2, 1); rect(ctx, '#1a0a0a', 2, 4, 1, 1); rect(ctx, '#1a0a0a', 5, 4, 1, 1); rect(ctx, '#2a0a0a', 2, 6, 4, 1); rect(ctx, '#ffffff', 2, 6, 1, 1); rect(ctx, '#ffffff', 5, 6, 1, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, 0xb8282a, 8, 8, r, 0.1); rect(ctx, s2.hair, 0, 0, 8, 3); };
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0x1a0a0e, w, h, r, 0.1); for (let i = 0; i < w; i += 3) rect(ctx, '#ff3a1a', i, h - 2, 1, 1); };
      sp.chest = (ctx) => { rect(ctx, '#ff3a1a', 3, 2, 2, 2); rect(ctx, '#ff8a20', 3, 2, 1, 1); rect(ctx, '#5a0a14', 0, 8, 8, 1); };
      sp.acc = [['torso', 0.06, 0.06, 0.34, 0, 0.05, 0.3, 0x1a0a0e], ['torso', 0.16, 0.16, 0.04, 0, 0.05, 0.48, 0xb8282a]];
      break;
    case 'neon':
      Object.assign(sp, { shirt: 0x111118, pants: 0x111118, boots: 0x0a0a0a, hair: 0x111118 });
      sp.shirtPaint = (ctx, w, h) => { rect(ctx, '#111118', 0, 0, w, h); rect(ctx, '#3af0ff', 0, 0, 1, h); rect(ctx, '#ff3ad0', w - 1, 0, 1, h); rect(ctx, '#3af0ff', 0, h - 2, w, 1); };
      sp.pantsPaint = (ctx, w, h) => { rect(ctx, '#111118', 0, 0, w, h); rect(ctx, '#ff3ad0', 0, 0, 1, h); };
      sp.face = (ctx) => { rect(ctx, '#15151c', 0, 0, 8, 8); rect(ctx, '#3af0ff', 0, 3, 8, 2); rect(ctx, '#d8ffff', 1, 3, 2, 1); rect(ctx, '#ff3ad0', 0, 6, 8, 1); };
      sp.side = (ctx) => { rect(ctx, '#15151c', 0, 0, 8, 8); rect(ctx, '#3af0ff', 0, 3, 8, 2); }; sp.back = (ctx) => { rect(ctx, '#15151c', 0, 0, 8, 8); rect(ctx, '#ff3ad0', 3, 0, 2, 8); }; sp.top = (ctx) => { rect(ctx, '#15151c', 0, 0, 8, 8); rect(ctx, '#3af0ff', 3, 0, 2, 8); };
      sp.chest = (ctx) => { rect(ctx, '#3af0ff', 1, 1, 6, 1); rect(ctx, '#ff3ad0', 3, 2, 2, 3); rect(ctx, '#3af0ff', 0, 8, 8, 1); };
      break;
    case 'frostqueen':
      Object.assign(sp, { skin: 0xe8f0ff, hair: 0xf0f8ff, shirt: 0x8ac8f0, pants: 0x5a8ac0, boots: 0xd8f0ff, hat: 'icecrown', cape: 0xc8e8ff, wings: { kind: 'ice', c1: 0xd8f4ff, c2: 0x8ad0ff } });
      sp.shirtPaint = (ctx, w, h, r) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rect(ctx, toN(shade(0x8ac8f0, 1.15 - y / h * 0.35 + r() * 0.06)), x, y, 1, 1); for (let i = 0; i < w * h / 8; i++) rect(ctx, '#ffffff', r() * w | 0, r() * h | 0, 1, 1); };
      sp.face = (ctx, s2, r) => { dither(ctx, s2.skin, 8, 8, r, 0.04); rect(ctx, s2.hair, 0, 0, 8, 2); rect(ctx, s2.hair, 0, 2, 1, 5); rect(ctx, s2.hair, 7, 2, 1, 5); rect(ctx, '#ffffff', 1, 4, 2, 1); rect(ctx, '#ffffff', 5, 4, 2, 1); rect(ctx, '#3a8ad0', 2, 4, 1, 1); rect(ctx, '#3a8ad0', 5, 4, 1, 1); rect(ctx, '#5a8ac0', 3, 6, 2, 1); rect(ctx, '#bfe8ff', 1, 3, 1, 1); rect(ctx, '#bfe8ff', 6, 3, 1, 1); };
      sp.side = (ctx, s2, r) => { dither(ctx, s2.skin, 8, 8, r, 0.04); rect(ctx, s2.hair, 0, 0, 8, 3); rect(ctx, s2.hair, 0, 3, 5, 5); };
      sp.back = (ctx, s2, r) => { dither(ctx, s2.hair, 8, 8, r, 0.06); rect(ctx, '#bfe8ff', 3, 0, 2, 8); };
      sp.chest = (ctx) => { rect(ctx, '#ffffff', 3, 1, 2, 2); rect(ctx, '#3a8ad0', 3, 1, 1, 1); rect(ctx, '#d8f4ff', 2, 3, 4, 1); rect(ctx, '#ffffff', 0, 8, 8, 1); rect(ctx, '#3a8ad0', 3, 8, 2, 1); };
      sp.acc = [['arms', 0.29, 0.12, 0.29, 0.02, 0.03, 0, 0xd8f4ff]];
      break;
    case 'phoenixlord':
      Object.assign(sp, { hair: 0xff6a10, shirt: 0xc8301a, pants: 0x5a1408, boots: 0xffb020, hat: 'plume', cape: 0xff8a20, wings: { kind: 'fire', c1: 0xff8a20, c2: 0xffd040 } });
      sp.shirtPaint = (ctx, w, h, r) => { dither(ctx, 0xc8301a, w, h, r, 0.08); for (let y = 1; y < h; y += 3) for (let x = (y % 2); x < w; x += 2) rect(ctx, '#ffb020', x, y, 1, 1); };
      sp.face = (ctx, s2, r) => { normalFace(ctx, s2, r); rect(ctx, '#ffd040', 1, 4, 2, 1); rect(ctx, '#ffd040', 5, 4, 2, 1); rect(ctx, '#b01a0a', 2, 4, 1, 1); rect(ctx, '#b01a0a', 5, 4, 1, 1); rect(ctx, '#ffb020', 0, 2, 8, 1); };
      sp.chest = (ctx) => { rect(ctx, '#ffd040', 2, 1, 4, 4); rect(ctx, '#ff6a10', 3, 2, 2, 2); rect(ctx, '#ffffff', 3, 2, 1, 1); rect(ctx, '#ffb020', 0, 8, 8, 1); };
      sp.acc = [['arms', 0.29, 0.12, 0.29, 0.02, 0.03, 0, 0xffb020], ['arms', 0.3, 0.05, 0.3, 0.02, -0.05, 0, 0xb01a0a]];
      break;
  }
  return sp;
}

const skinCache = new Map();
// 반환: { head:[6 mats], torso:[6], arm:[6], leg:[6], hat, shirt, skin }
export function skinMats(ci, sid) {
  sid = CHAR_SKINS[sid] ? sid : 'default';
  const key = ci + '|' + sid;
  if (skinCache.has(key)) return skinCache.get(key);
  const r = rng(ci * 131 + 7 + sid.length * 17), sp = skinSpec(ci, sid);
  const { skin, shirt, pants, boots } = sp;
  const mat = (t) => new THREE.MeshLambertMaterial({ map: t });
  const paintShirt = (ctx, w, h) => sp.shirtPaint ? sp.shirtPaint(ctx, w, h, r) : dither(ctx, shirt, w, h, r, 0.12);
  const paintPants = (ctx, w, h) => sp.pantsPaint ? sp.pantsPaint(ctx, w, h, r) : dither(ctx, pants, w, h, r, 0.14);
  const headSide = canvasTex(8, 8, ctx => sp.side(ctx, sp, r));
  const headBack = canvasTex(8, 8, ctx => sp.back(ctx, sp, r));
  const headTop = canvasTex(8, 8, ctx => sp.top(ctx, sp, r));
  const headBot = canvasTex(8, 8, ctx => dither(ctx, skin, 8, 8, r, 0.06));
  const face = canvasTex(8, 8, ctx => sp.face(ctx, sp, r));
  const torsoF = canvasTex(8, 10, ctx => {
    paintShirt(ctx, 8, 10);
    if (sp.chest) sp.chest(ctx);
    else { rect(ctx, skin, 3, 0, 2, 1); rect(ctx, toN(shade(shirt, 0.7)), 0, 8, 8, 1); rect(ctx, '#3a2a1a', 0, 9, 8, 1); rect(ctx, '#c9a23a', 3, 9, 2, 1); }
  });
  const torsoS = canvasTex(4, 10, ctx => { paintShirt(ctx, 4, 10); rect(ctx, '#3a2a1a', 0, 9, 4, 1); });
  const torsoB = canvasTex(8, 10, ctx => { paintShirt(ctx, 8, 10); rect(ctx, '#3a2a1a', 0, 9, 8, 1); });
  const armS = canvasTex(4, 10, ctx => { paintShirt(ctx, 4, 10); dither2(ctx, skin, 0, 7, 4, 3, r); });
  const armT = canvasTex(4, 4, ctx => paintShirt(ctx, 4, 4));
  const armB = canvasTex(4, 4, ctx => dither(ctx, skin, 4, 4, r, 0.08));
  const legS = canvasTex(4, 10, ctx => { paintPants(ctx, 4, 10); rect(ctx, hexs(boots), 0, 8, 4, 2); });
  const legT = canvasTex(4, 4, ctx => paintPants(ctx, 4, 4));
  const legB = canvasTex(4, 4, ctx => rect(ctx, hexs(boots), 0, 0, 4, 4));
  // 박스 면 순서: +x -x +y -y +z -z  (앞 = -z)
  const out = {
    head: [mat(headSide), mat(headSide), mat(headTop), mat(headBot), mat(headBack), mat(face)],
    torso: [mat(torsoS), mat(torsoS), mat(armT), mat(armT), mat(torsoB), mat(torsoF)],
    arm: [mat(armS), mat(armS), mat(armT), mat(armB), mat(armS), mat(armS)],
    leg: [mat(legS), mat(legS), mat(legT), mat(legB), mat(legS), mat(legS)],
    shirt, skin, hat: sp.hat, hatColor: sp.hatColor, cape: sp.cape, wings: sp.wings, acc: sp.acc, faceCanvas: face.image,
  };
  skinCache.set(key, out);
  return out;
}
function dither2(ctx, base, ox, oy, w, h, r) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [a, b, c] = shade(base, 1 + (r() - 0.5) * 0.08); ctx.fillStyle = `rgb(${a},${b},${c})`; ctx.fillRect(ox + x, oy + y, 1, 1); }
}

/* ---------- 스프라이트 ---------- */
export function flashTex() {
  return canvasTex(16, 16, ctx => {
    const pts = [[7, 0], [8, 0], [7, 1], [8, 1], [3, 3], [12, 3], [0, 7], [15, 7], [0, 8], [15, 8], [3, 12], [12, 12], [7, 15], [8, 15], [7, 14], [8, 14]];
    for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 6) rect(ctx, d < 2.5 ? '#ffffff' : d < 4.2 ? '#ffe46a' : '#ff9a2a', x, y, 1, 1); }
    for (const [x, y] of pts) rect(ctx, '#ffd040', x, y, 1, 1);
  });
}
export function smokeTex() {
  return canvasTex(8, 8, ctx => { const r = rng(5); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const d = Math.hypot(x - 3.5, y - 3.5); if (d < 3.6 + r() * 0.6) { const v = 200 + (r() * 40 | 0); ctx.fillStyle = `rgba(${v},${v},${v},${d < 2 ? 1 : 0.85})`; ctx.fillRect(x, y, 1, 1); } } });
}
export function holeTex() {
  return canvasTex(8, 8, ctx => { rect(ctx, 'rgba(0,0,0,0)', 0, 0, 8, 8); rect(ctx, '#1a1a1a', 2, 2, 4, 4); rect(ctx, '#1a1a1a', 3, 1, 2, 6); rect(ctx, '#1a1a1a', 1, 3, 6, 2); rect(ctx, '#000000', 3, 3, 2, 2); });
}
export function textSprite(text, color) {
  const cv = document.createElement('canvas'); const ctx = cv.getContext('2d');
  ctx.font = '12px Galmuri11, monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 8; cv.width = w; cv.height = 16;
  ctx.font = '12px Galmuri11, monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, 16);
  ctx.fillStyle = color || '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 4, 8.5);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, w, h: 16 };
}
