// 유리·색유리·식물·꽃·덩굴·거미줄·횃불·랜턴 (106~146번) 이름 + 16×16 텍스처 (투명한 칸은 안 칠함 → 뒤가 보임)
// 번호와 종류(SEE·DECO)는 shared.js. draw(px, r, h): h = { T, shade, noiseFill, rgba(c, a) }
const GLASS_COLORS = [['GLASS_W', '흰 색유리', 0xf0f0f0], ['GLASS_GY', '회색 색유리', 0x6a6e74], ['GLASS_K', '검은 색유리', 0x1c1e22], ['GLASS_R', '빨간 색유리', 0xd03a2e],
  ['GLASS_O', '주황 색유리', 0xf08a2a], ['GLASS_Y', '노란 색유리', 0xf4d03a], ['GLASS_LM', '연두 색유리', 0x8ae04a], ['GLASS_G', '초록 색유리', 0x3a8a3a],
  ['GLASS_LB', '하늘 색유리', 0x6ac8f0], ['GLASS_B', '파란 색유리', 0x2e5ec8], ['GLASS_P', '보라 색유리', 0x8a4ac8], ['GLASS_PK', '분홍 색유리', 0xf08ac0]];

// 줄기 + 꽃송이 (한 칸 꽃)
function flower(px, r, { shade, rgba }, petal, center, stemTop) {
  for (let y = stemTop; y < 16; y++) px(7 + (y % 5 === 0 ? 1 : 0), y, rgba(0x3a8a2a, 255));
  for (const [x, y] of [[6, 11], [5, 10], [9, 12], [10, 11]]) px(x, y, rgba(0x4caa34, 255));
  const cy = stemTop - 2;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [-2, 0], [2, 0]]) px(7 + dx, cy + dy, [...shade(petal, 0.9 + r() * 0.2), 255]);
  px(7, cy, rgba(center, 255));
}
function grassBlades(px, r, { shade }, col, from) {
  for (let i = 0; i < 9; i++) { const x = 1 + Math.floor(r() * 14), h = from + Math.floor(r() * (14 - from)); for (let y = 15; y > 15 - h; y--) px(x + (y < 8 && i % 2 ? 1 : 0), y, [...shade(col, 0.8 + r() * 0.35), 255]); }
}
const tallTop = (name, draw) => ({ [name]: draw });

export const DECO_BLOCKS = [
  // 투명 유리: 테두리와 반짝이 몇 줄만, 안은 비어 있음
  { key: 'GLASS_C', name: '투명 유리', tex: ['glass_c'], draw: { glass_c: (px, r, { rgba }) => { for (let i = 0; i < 16; i++) { px(i, 0, rgba(0xd8eef4, 255)); px(i, 15, rgba(0xa8c8d0, 255)); px(0, i, rgba(0xd8eef4, 255)); px(15, i, rgba(0xa8c8d0, 255)); } for (let k = 0; k < 4; k++) { px(3 + k, 6 - k, rgba(0xffffff, 230)); px(9 + k, 13 - k, rgba(0xffffff, 200)); } } } },
  // 색유리: 반투명 색 + 진한 테두리
  ...GLASS_COLORS.map(([key, name, c]) => ({ key, name, tex: [key.toLowerCase()], draw: { [key.toLowerCase()]: (px, r, { shade }) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; px(x, y, [...shade(c, edge ? 0.7 : 1), edge ? 235 : 130]); } } } })),
  // 한 칸 식물
  { key: 'P_GRASS', name: '풀', tex: ['p_grass'], draw: { p_grass: (px, r, h) => grassBlades(px, r, h, 0x5fae3a, 5) } },
  { key: 'P_FERN', name: '고사리', tex: ['p_fern'], draw: { p_fern: (px, r, { shade }) => { for (let y = 3; y < 16; y++) { px(7, y, [...shade(0x3a7a2a, 1), 255]); const w = Math.floor((y - 2) / 2); if (y % 2) for (let k = 1; k <= w; k++) { px(7 - k, y - (k >> 1), [...shade(0x4c9a34, 0.85 + r() * 0.3), 255]); px(7 + k, y - (k >> 1), [...shade(0x4c9a34, 0.85 + r() * 0.3), 255]); } } } } },
  { key: 'P_DANDELION', name: '민들레', tex: ['p_dandelion'], draw: { p_dandelion: (px, r, h) => flower(px, r, h, 0xf4d03a, 0xe8a020, 9) } },
  { key: 'P_POPPY', name: '양귀비', tex: ['p_poppy'], draw: { p_poppy: (px, r, h) => flower(px, r, h, 0xd8302a, 0x2a2a2a, 8) } },
  { key: 'P_ORCHID', name: '파란 난초', tex: ['p_orchid'], draw: { p_orchid: (px, r, h) => flower(px, r, h, 0x3ab0e8, 0xc8f0ff, 8) } },
  { key: 'P_TULIP_R', name: '빨간 튤립', tex: ['p_tulip_r'], draw: { p_tulip_r: (px, r, h) => flower(px, r, h, 0xe0402e, 0xf07a5a, 7) } },
  { key: 'P_TULIP_P', name: '분홍 튤립', tex: ['p_tulip_p'], draw: { p_tulip_p: (px, r, h) => flower(px, r, h, 0xf0a0c8, 0xffd0e4, 7) } },
  { key: 'P_DAISY', name: '데이지', tex: ['p_daisy'], draw: { p_daisy: (px, r, h) => flower(px, r, h, 0xf4f4f0, 0xf0c83a, 8) } },
  { key: 'P_CORNFLOWER', name: '수레국화', tex: ['p_cornflower'], draw: { p_cornflower: (px, r, h) => flower(px, r, h, 0x4a6ae0, 0x2a3aa8, 8) } },
  { key: 'P_LILY', name: '은방울꽃', tex: ['p_lily'], draw: { p_lily: (px, r, { rgba }) => { for (let y = 4; y < 16; y++) px(7, y, rgba(0x3a8a2a, 255)); for (const [x, y] of [[5, 5], [9, 7], [5, 9], [9, 11]]) { px(x, y, rgba(0xffffff, 255)); px(x, y + 1, rgba(0xe8e8e0, 255)); px(x === 5 ? 6 : 8, y, rgba(0x3a8a2a, 255)); } for (const [x, y] of [[6, 13], [8, 12], [5, 12], [9, 14]]) px(x, y, rgba(0x4caa34, 255)); } } },
  { key: 'P_MUSH_R', name: '빨간 버섯', tex: ['p_mush_r'], draw: { p_mush_r: (px, r, { rgba }) => { for (let y = 11; y < 16; y++) for (let x = 6; x < 10; x++) px(x, y, rgba(0xe8e0d0, 255)); for (let y = 6; y < 11; y++) for (let x = 3 + (y === 6 ? 2 : 0); x < 13 - (y === 6 ? 2 : 0); x++) px(x, y, rgba((x + y) % 4 === 0 ? 0xffffff : 0xd8302a, 255)); } } },
  { key: 'P_MUSH_B', name: '갈색 버섯', tex: ['p_mush_b'], draw: { p_mush_b: (px, r, { rgba }) => { for (let y = 11; y < 16; y++) for (let x = 6; x < 10; x++) px(x, y, rgba(0xd8d0c0, 255)); for (let y = 8; y < 11; y++) for (let x = 3 + (y === 8 ? 1 : 0); x < 13 - (y === 8 ? 1 : 0); x++) px(x, y, rgba(0x9a6a4a, 255)); } } },
  { key: 'P_DEADBUSH', name: '마른 덤불', tex: ['p_deadbush'], draw: { p_deadbush: (px, r, { rgba }) => { const br = (x, y, dx, n) => { for (let i = 0; i < n; i++) px(x + Math.round(dx * i), y - i, rgba(0x8a6a3a, 255)); }; br(7, 15, 0, 9); br(7, 12, -0.7, 6); br(7, 11, 0.8, 6); br(7, 9, -0.4, 5); br(7, 8, 0.5, 4); } } },
  { key: 'P_SAPLING', name: '묘목', tex: ['p_sapling'], draw: { p_sapling: (px, r, { shade }) => { for (let y = 9; y < 16; y++) px(7, y, [...shade(0x6a4a2a, 1), 255]); for (let y = 2; y < 11; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, y - 6) < 4.6 && r() < 0.8) px(x, y, [...shade(0x3a8a2a, 0.8 + r() * 0.4), 255]); } } },
  // 두 칸 꽃 (아래 칸 그림 / 윗칸 그림)
  { key: 'T_GRASS', name: '큰 풀', tex: ['t_grass'], top: 't_grass_top', draw: { t_grass: (px, r, h) => grassBlades(px, r, h, 0x5fae3a, 14), ...tallTop('t_grass_top', (px, r, h) => grassBlades(px, r, h, 0x6abc42, 8)) } },
  { key: 'T_SUNFLOWER', name: '해바라기', tex: ['t_sunflower'], top: 't_sunflower_top', draw: {
    t_sunflower: (px, r, { rgba }) => { for (let y = 0; y < 16; y++) px(7, y, rgba(0x3a8a2a, 255)); for (const [x, y] of [[5, 6], [4, 5], [9, 10], [10, 9], [6, 12]]) px(x, y, rgba(0x4caa34, 255)); },
    ...tallTop('t_sunflower_top', (px, r, { rgba }) => { for (let y = 10; y < 16; y++) px(7, y, rgba(0x3a8a2a, 255)); for (let y = 1; y < 11; y++) for (let x = 2; x < 13; x++) { const d = Math.hypot(x - 7.5, y - 5.5); if (d < 2.4) px(x, y, rgba(0x6a3a1a, 255)); else if (d < 5) px(x, y, rgba(r() < 0.8 ? 0xf4c82a : 0xe8a020, 255)); } }) } },
  { key: 'T_ROSE', name: '장미 덤불', tex: ['t_rose'], top: 't_rose_top', draw: {
    t_rose: (px, r, { shade }) => { for (let y = 0; y < 16; y++) for (let x = 2; x < 14; x++) if (r() < 0.55) px(x, y, [...shade(0x2e7a2a, 0.75 + r() * 0.4), 255]); },
    ...tallTop('t_rose_top', (px, r, { shade }) => { for (let y = 4; y < 16; y++) for (let x = 2; x < 14; x++) if (r() < 0.6) px(x, y, r() < 0.3 ? [...shade(0xd0283a, 0.9 + r() * 0.2), 255] : [...shade(0x2e7a2a, 0.75 + r() * 0.4), 255]); }) } },
  { key: 'T_LILAC', name: '라일락', tex: ['t_lilac'], top: 't_lilac_top', draw: {
    t_lilac: (px, r, { shade }) => { for (let y = 0; y < 16; y++) for (let x = 4; x < 12; x++) if (r() < 0.4 || x === 7) px(x, y, [...shade(0x3a7a2a, 0.75 + r() * 0.4), 255]); },
    ...tallTop('t_lilac_top', (px, r, { shade }) => { for (let y = 2; y < 16; y++) for (let x = 3; x < 13; x++) if (Math.abs(x - 7.5) < 2 + y * 0.25 && r() < 0.75) px(x, y, y > 12 ? [...shade(0x3a7a2a, 1), 255] : [...shade(0xc89ae0, 0.85 + r() * 0.3), 255]); }) } },
  { key: 'T_PEONY', name: '모란', tex: ['t_peony'], top: 't_peony_top', draw: {
    t_peony: (px, r, { shade }) => { for (let y = 0; y < 16; y++) for (let x = 3; x < 13; x++) if (r() < 0.45) px(x, y, [...shade(0x3a8a34, 0.75 + r() * 0.4), 255]); },
    ...tallTop('t_peony_top', (px, r, { shade }) => { for (let y = 3; y < 16; y++) for (let x = 2; x < 14; x++) { const d = Math.hypot(x - 7.5, y - 7); if (d < 5 && r() < 0.9) px(x, y, [...shade(0xf0b0d0, 0.8 + r() * 0.35), 255]); else if (y > 11 && r() < 0.5) px(x, y, [...shade(0x3a8a34, 1), 255]); } }) } },
  // 덩굴(벽에 붙음)·거미줄·횃불·랜턴
  { key: 'VINE', name: '덩굴', tex: ['vine'], draw: { vine: (px, r, { shade }) => { for (let k = 0; k < 4; k++) { let x = 2 + k * 4; for (let y = 0; y < 16; y++) { x += r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0; px(x, y, [...shade(0x3a7a2a, 0.8 + r() * 0.4), 255]); if (r() < 0.35) px(x + 1, y, [...shade(0x4c9a34, 0.8 + r() * 0.4), 255]); } } } } },
  { key: 'COBWEB', name: '거미줄', tex: ['cobweb'], draw: { cobweb: (px, r, { rgba }) => { for (let i = 0; i < 16; i++) { px(i, i, rgba(0xf0f0f0, 220)); px(15 - i, i, rgba(0xf0f0f0, 220)); px(7, i, rgba(0xe8e8e8, 200)); px(i, 7, rgba(0xe8e8e8, 200)); } for (const rr of [3, 6]) for (let a = 0; a < 6.28; a += 0.35) px(7.5 + Math.cos(a) * rr | 0, 7.5 + Math.sin(a) * rr | 0, rgba(0xdcdcdc, 190)); } } },
  { key: 'TORCH', name: '횃불', tex: ['torch'], draw: { torch: (px, r, { rgba }) => { for (let y = 7; y < 16; y++) { px(7, y, rgba(0x8a5a2a, 255)); px(8, y, rgba(0x6a4220, 255)); } for (const [x, y, c] of [[7, 6, 0xffe060], [8, 6, 0xffb020], [7, 5, 0xfff0a0], [8, 5, 0xffd040], [7, 4, 0xffa020]]) px(x, y, rgba(c, 255)); } } },
  { key: 'LANTERN', name: '랜턴', tex: ['lantern'], draw: { lantern: (px, r, { rgba }) => { for (let y = 5; y < 15; y++) for (let x = 4; x < 12; x++) { const edge = x === 4 || x === 11 || y === 5 || y === 14 || y === 9; px(x, y, rgba(edge ? 0x3a3a44 : (r() < 0.8 ? 0xffd060 : 0xffa030), 255)); } for (const [x, y] of [[7, 2], [8, 2], [7, 3], [8, 4], [6, 4], [9, 4]]) px(x, y, rgba(0x3a3a44, 255)); } } },
];
// 횃불·랜턴은 빛남
export const DECO_GLOW = ['TORCH', 'LANTERN'];
