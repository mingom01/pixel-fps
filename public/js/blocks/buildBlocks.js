// 건축 블록 30종 (62~91번). 번호는 shared.js 의 B 에 있고, 여기는 이름 + 16×16 텍스처 그리기
// tex: [윗면, 옆면, 아랫면] 텍스처 이름 (같으면 생략). draw(px, r, h): h = { T, shade, noiseFill }
const CON = [['CON_W', '흰 콘크리트', 0xe8e8e4], ['CON_K', '검은 콘크리트', 0x2a2c30], ['CON_R', '빨간 콘크리트', 0xc0342e], ['CON_O', '주황 콘크리트', 0xe07a24],
  ['CON_Y', '노란 콘크리트', 0xe8c02c], ['CON_G', '초록 콘크리트', 0x4a9a3a], ['CON_B', '파란 콘크리트', 0x2e5ec0], ['CON_P', '보라 콘크리트', 0x7a3ab8]];

// 공용 그리기 도우미
const fill = (px, T, f) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, f(x, y)); };
function bricks(px, r, h, base, mortar, bw, bh) {
  const { T, shade } = h;
  fill(px, T, (x, y) => {
    const row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0;
    const edge = y % bh === bh - 1 || (x + off) % bw === bw - 1;
    return edge ? shade(mortar, 1) : shade(base, 0.9 + r() * 0.16);
  });
}
function planks(px, r, h, base) {
  const { T, shade } = h;
  fill(px, T, (x, y) => (y % 4 === 3 ? shade(base, 0.7) : (x + (y >> 2) * 5) % 16 === 0 ? shade(base, 0.78) : shade(base, 0.9 + r() * 0.14)));
}

export const BUILD_BLOCKS = [
  { key: 'GLASS', name: '유리', tex: ['glass'], draw: { glass: (px, r, { T, shade }) => fill(px, T, (x, y) => (x === 0 || y === 0 || x === T - 1 || y === T - 1) ? shade(0xd8eef4, 1) : (x - y === 3 || x - y === 4 || x - y === 9) ? shade(0xffffff, 1) : shade(0x9fd4e4, 0.95 + r() * 0.06)) } },
  { key: 'TILE_W', name: '흰 타일', tex: ['tile_w'], draw: { tile_w: (px, r, { T, shade }) => fill(px, T, (x, y) => (x % 8 === 7 || y % 8 === 7) ? shade(0xa8aab0, 1) : shade(0xf0f0ec, 0.96 + r() * 0.05)) } },
  { key: 'TILE_CK', name: '체크 타일', tex: ['tile_ck'], draw: { tile_ck: (px, r, { T, shade }) => fill(px, T, (x, y) => ((x >> 2) + (y >> 2)) % 2 ? shade(0x1e1e22, 1 + r() * 0.1) : shade(0xeeeeea, 0.96 + r() * 0.05)) } },
  { key: 'MARBLE_BRICK', name: '대리석 벽돌', tex: ['marble_brick'], draw: { marble_brick: (px, r, h) => bricks(px, r, h, 0xe8e2d8, 0xb0a898, 8, 4) } },
  { key: 'BIRCH', name: '자작나무 판자', tex: ['birch'], draw: { birch: (px, r, h) => planks(px, r, h, 0xe0cc94) } },
  { key: 'CHERRY', name: '벚나무 판자', tex: ['cherry'], draw: { cherry: (px, r, h) => planks(px, r, h, 0xe4a8a0) } },
  { key: 'BAMBOO', name: '대나무', tex: ['bamboo_top', 'bamboo'], draw: {
    bamboo: (px, r, { T, shade }) => fill(px, T, (x, y) => x % 4 === 3 ? shade(0x4a7a2a, 1) : y % 8 === 0 ? shade(0x6a9a3a, 0.8) : shade(0x8ac04a, 0.92 + r() * 0.12)),
    bamboo_top: (px, r, { T, shade }) => fill(px, T, (x, y) => (x % 4 === 3 || y % 4 === 3) ? shade(0x4a7a2a, 1) : (x % 4 === 1 && y % 4 === 1) ? shade(0xc8d890, 1) : shade(0x8ac04a, 1)),
  } },
  ...CON.map(([key, name, c]) => ({ key, name, tex: [key.toLowerCase()], draw: { [key.toLowerCase()]: (px, r, h) => h.noiseFill(px, r, c, 0.04, 10) } })),
  { key: 'IRON_DOOR', name: '철문', tex: ['metal_top', 'iron_door'], draw: {
    metal_top: (px, r, h) => h.noiseFill(px, r, 0xa8aeb4, 0.05, 8),
    iron_door: (px, r, { T, shade }) => fill(px, T, (x, y) => (x === 0 || x === T - 1 || y === 0 || x === 7 || x === 8) ? shade(0x6a7078, 1) : (y === 7 && x === 10) ? shade(0x2a2c30, 1) : (y % 5 === 2) ? shade(0x8a9098, 1) : shade(0xb4bac0, 0.95 + r() * 0.06)),
  } },
  { key: 'BOOKSHELF', name: '책장', tex: ['birch', 'bookshelf'], draw: {
    bookshelf: (px, r, { T, shade }) => { const cols = [0xb03a2e, 0x2e6ab0, 0x3a9a4a, 0xd8a83a, 0x7a4ab0, 0xe8e0d0]; const book = []; for (let i = 0; i < 16; i++) book.push(cols[r() * cols.length | 0]); fill(px, T, (x, y) => (y === 0 || y === 7 || y === 8 || y === 15 || x === 0 || x === 15) ? shade(0xa07a44, 0.85) : (y === 1 || y === 9) && r() < 0.4 ? shade(0x3a2a1a, 1) : shade(book[x + (y > 7 ? 8 : 0) & 15], 0.85 + r() * 0.15)); },
  } },
  { key: 'KIWA', name: '기와', tex: ['kiwa'], draw: { kiwa: (px, r, { T, shade }) => fill(px, T, (x, y) => { const w = Math.abs((x % 4) - 1.5); return y % 4 === 3 ? shade(0x24282e, 1) : shade(0x4a525c, 0.8 + (1.5 - w) * 0.15 + r() * 0.05); }) } },
  { key: 'DARK_BRICK', name: '검은 벽돌', tex: ['dark_brick'], draw: { dark_brick: (px, r, h) => bricks(px, r, h, 0x3a3436, 0x1a1618, 8, 4) } },
  { key: 'SAND_BRICK', name: '사암 벽돌', tex: ['sand_brick'], draw: { sand_brick: (px, r, h) => bricks(px, r, h, 0xdcc48a, 0xa8905a, 8, 4) } },
  { key: 'GRANITE', name: '화강암', tex: ['granite'], draw: { granite: (px, r, { T, shade }) => fill(px, T, () => { const v = r(); return shade(v < 0.15 ? 0x6a4a40 : v < 0.3 ? 0xd8c8c0 : 0x9a7a70, 0.9 + r() * 0.15); }) } },
  { key: 'SMOOTH', name: '매끈한 돌', tex: ['smooth'], draw: { smooth: (px, r, { T, shade }) => fill(px, T, (x, y) => (x === 0 || y === 0) ? shade(0xc8cacc, 1) : (x === T - 1 || y === T - 1) ? shade(0x8a8c90, 1) : shade(0xaeb0b4, 0.98 + r() * 0.04)) } },
  { key: 'COPPER', name: '구리', tex: ['copper'], draw: { copper: (px, r, { T, shade }) => fill(px, T, () => { const v = r(); return v < 0.12 ? shade(0x4ab89a, 0.9 + r() * 0.2) : shade(0xc87a4a, 0.88 + r() * 0.2); }) } },
  { key: 'STEEL', name: '철골', tex: ['steel'], draw: { steel: (px, r, { T, shade }) => fill(px, T, (x, y) => (x < 2 || x > 13 || y < 2 || y > 13 || Math.abs(x - y) < 1.5 || Math.abs(x + y - 15) < 1.5) ? ((x + y) % 7 === 0 ? shade(0xffffff, 0.9) : shade(0xc84a2a, 0.85 + r() * 0.15)) : shade(0x22252a, 1)) } },
  { key: 'PARQUET', name: '마루', tex: ['parquet'], draw: { parquet: (px, r, { T, shade }) => fill(px, T, (x, y) => { const q = ((x >> 2) + (y >> 2)) % 2, line = q ? y % 4 === 0 : x % 4 === 0; return line ? shade(0x6a4224, 1) : shade(q ? 0xb07a44 : 0x9a6a3a, 0.92 + r() * 0.12); }) } },
  { key: 'CARPET', name: '빨간 카펫', tex: ['carpet'], draw: { carpet: (px, r, { T, shade }) => fill(px, T, (x, y) => (x === 1 || x === 14 || y === 1 || y === 14) ? shade(0xe8c03a, 1) : shade(0xa82a2e, 0.9 + r() * 0.15)) } },
  { key: 'WALLPAPER', name: '줄무늬 벽지', tex: ['wallpaper'], draw: { wallpaper: (px, r, { T, shade }) => fill(px, T, (x) => x % 6 < 3 ? shade(0xe8dcc0, 0.97 + r() * 0.05) : shade(0x9ab8a0, 0.97 + r() * 0.05)) } },
  { key: 'VENT', name: '환풍구', tex: ['metal_top', 'vent'], draw: { vent: (px, r, { T, shade }) => fill(px, T, (x, y) => (x < 1 || x > 14 || y < 1 || y > 14) ? shade(0x7a8088, 1) : y % 3 === 0 ? shade(0x1a1c20, 1) : shade(0x9aa0a8, 0.95 + r() * 0.06)) } },
  { key: 'SHUTTER', name: '셔터', tex: ['metal_top', 'shutter'], draw: { shutter: (px, r, { T, shade }) => fill(px, T, (x, y) => y % 2 === 0 ? shade(0x8a9098, 0.95 + r() * 0.05) : shade(0xb8bec4, 0.95 + r() * 0.05)) } },
  { key: 'PILLAR', name: '대리석 기둥', tex: ['pillar_top', 'pillar'], draw: {
    pillar: (px, r, { T, shade }) => fill(px, T, (x) => x % 4 === 0 ? shade(0xb8b0a4, 1) : shade(0xf0ece4, 0.94 + (x % 4) * 0.02 + r() * 0.03)),
    pillar_top: (px, r, { T, shade }) => fill(px, T, (x, y) => Math.hypot(x - 7.5, y - 7.5) < 6 ? shade(0xf0ece4, 0.96 + r() * 0.04) : shade(0xd0c8bc, 1)),
  } },
];
