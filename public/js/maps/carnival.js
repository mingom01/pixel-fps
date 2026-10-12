// 놀이공원 — 기믹: 트램펄린(떨어진 높이만큼 다시 튕겨 오름) + 30초마다 불꽃놀이
(function (SH) {
  const { VMap, B, G, rng, ground, border, house, scatter } = SH.MAPKIT;

  function build() {
    const m = new VMap(64, 30, 64), r = rng(261);
    ground(m, B.GRASS, B.DIRT);
    border(m, B.WOOL_W, 4, B.WOOL_R, 4);
    // 길 (십자 + 원형 광장)
    m.fill(30, 3, 2, 33, 3, 61, B.PATH); m.fill(2, 3, 30, 61, 3, 33, B.PATH);
    for (let z = 20; z <= 43; z++) for (let x = 20; x <= 43; x++) { const d = Math.hypot(x - 31.5, z - 31.5); if (d < 11.5) m.set(x, 3, z, d < 9 ? B.WOOL_Y : B.PATH); }
    // 가운데 회전목마 (지붕 + 기둥)
    for (let z = 25; z <= 38; z++) for (let x = 25; x <= 38; x++) { const d = Math.hypot(x - 31.5, z - 31.5); if (d < 6.5) m.set(x, G + 5, z, d < 3 ? B.WOOL_R : (Math.floor(Math.atan2(z - 31.5, x - 31.5) * 3) % 2 ? B.WOOL_R : B.WOOL_W)); }
    m.fill(31, G, 31, 32, G + 4, 32, B.GOLD);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = Math.round(31.5 + Math.cos(a) * 5), z = Math.round(31.5 + Math.sin(a) * 5); m.fill(x, G + 1, z, x, G + 4, z, B.GOLD); m.set(x, G, z, i % 2 ? B.CBLUE : B.CRED); }
    // 대관람차 (북쪽, 세로 링)
    for (let a = 0; a < Math.PI * 2; a += 0.04) { const x = Math.round(31.5 + Math.cos(a) * 9), y = Math.round(G + 12 + Math.sin(a) * 9); m.set(x, y, 7, B.METAL); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; for (let t = 0; t <= 9; t++) m.set(Math.round(31.5 + Math.cos(a) * t), Math.round(G + 12 + Math.sin(a) * t), 7, B.GRATE); const x = Math.round(31.5 + Math.cos(a) * 9), y = Math.round(G + 12 + Math.sin(a) * 9); m.fill(x - 1, y - 1, 6, x, y, 8, [B.CRED, B.CBLUE, B.CYELLOW, B.CGREEN][i % 4]); }
    m.fill(22, G, 7, 22, G + 2, 7, B.METAL); m.fill(41, G, 7, 41, G + 2, 7, B.METAL);
    // 서커스 천막 (동·서) + 매점
    for (const [x, z, d] of [[4, 22, ['e', 's']], [49, 22, ['w', 'n']]]) house(m, { x, z, w: 11, d: 20, h: 5, wall: B.WOOL_R, corner: B.WOOL_W, floor: B.PLANKS, roof: B.WOOL_W, doors: d, doorW: 3, parapetB: B.WOOL_R });
    for (const [x, z] of [[8, 50], [46, 50], [8, 8]]) house(m, { x, z, w: 7, d: 6, h: 3, wall: B.WOOL_W, corner: B.WOOL_B, floor: B.PLANKS, roof: B.WOOL_B, doors: ['n', 's'], parapet: false });
    // 트램펄린 (가운데 주변 + 천막 앞 + 남쪽 광장)
    for (const [x, z] of TRAMPS) m.fill(x, 3, z, x + 2, 3, z + 2, B.TRAMPOLINE);
    // 풍선 기둥·상자
    scatter(m, r, 16, 3, 3, 60, 60, (x, z) => {
      if (m.get(x, 3, z) !== B.GRASS || !m.free(x - 1, G, z - 1, x + 1, G + 4, z + 1)) return false;
      if (r() < 0.5) { m.fill(x, G, z, x, G + 2, z, B.WOOL_W); m.set(x, G + 3, z, [B.WOOL_R, B.WOOL_B, B.WOOL_Y][r() * 3 | 0]); } else m.fill(x, G, z, x + 1, G, z + 1, B.CRATE);
      return true;
    });
    return m;
  }
  const TRAMPS = [[19, 19], [42, 19], [19, 42], [42, 42], [16, 30], [45, 30], [30, 52], [24, 56], [36, 56], [30, 13]];

  SH.registerMap('carnival', {
    name: '놀이공원', build, sky: [0x7ab8ff, 0xffd8f0], fog: 0xf0d8f0, sun: 1.05,
    desc: '트램펄린 · 불꽃놀이',
    gim: { events: [{ kind: 'fireworks', every: 30000, dur: 6000 }] },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
