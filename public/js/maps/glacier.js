// 빙하 동굴 — 기믹: 얼음 바닥은 미끄러움(멈추기 어려움) + 50초마다 눈보라(시야 확 줄어듦)
(function (SH) {
  const { VMap, B, G, rng, ground, border, house, stairs, scatter, pineTree } = SH.MAPKIT;

  function build() {
    const m = new VMap(64, 28, 64), r = rng(221);
    ground(m, B.SNOW, B.STONE);
    border(m, B.ICE, 7, B.STONE, 6);
    // 가운데 얼어붙은 호수 (미끄러운 얼음)
    for (let z = 14; z <= 49; z++) for (let x = 16; x <= 47; x++) if (((x - 31.5) / 15) ** 2 + ((z - 31.5) / 17) ** 2 < 1) m.set(x, 3, z, B.ICE);
    // 호수 위 얼음 기둥 (엄폐물)
    for (const [x, z, h] of [[24, 24, 5], [39, 24, 4], [31, 31, 7], [24, 39, 4], [39, 39, 5], [31, 20, 3], [31, 43, 3]]) m.fill(x, G, z, x + 1, G + h - 1, z + 1, B.ICE);
    // 서쪽·동쪽 얼음 동굴 (천장 있는 통로)
    const cave = (x0, x1) => {
      m.fill(x0, G, 18, x1, G + 4, 45, B.STONE);
      m.fill(x0 + 1, G, 19, x1 - 1, G + 3, 44, 0);
      for (let z = 19; z <= 44; z++) for (let x = x0 + 1; x <= x1 - 1; x++) m.set(x, 3, z, r() < 0.35 ? B.ICE : B.SNOW);
      for (const z of [24, 32, 40]) { m.fill(x0, G, z, x0, G + 2, z + 2, 0); m.fill(x1, G, z, x1, G + 2, z + 2, 0); }
      for (let z = 20; z <= 43; z += 5) m.set(Math.round((x0 + x1) / 2), G + 4, z, B.ORE_DIA);
      m.fill(x0 + 2, G + 5, 20, x1 - 2, G + 5, 43, B.SNOW);
    };
    cave(4, 11); cave(52, 59);
    // 북쪽 연구 기지 / 남쪽 탐사 캠프
    const lab = house(m, { x: 22, z: 3, w: 20, d: 9, h: 4, wall: B.PANEL, corner: B.METAL, floor: B.CONCRETE, roof: B.SNOW, doors: ['s', 'w', 'e'], doorW: 3 });
    stairs(m, 43, G, 3, 0, 1, 4, 2, B.SNOW); void lab;
    house(m, { x: 24, z: 52, w: 16, d: 8, h: 3, wall: B.WOOL_W, corner: B.DARKWOOD, floor: B.PLANKS, roof: B.WOOL_R, doors: ['n', 'w', 'e'], doorW: 3, parapet: false });
    // 눈 언덕·소나무
    scatter(m, r, 14, 3, 3, 60, 60, (x, z) => {
      if (m.get(x, 3, z) !== B.SNOW || !m.free(x - 2, G, z - 2, x + 2, G + 3, z + 2)) return false;
      if (r() < 0.5) { pineTree(m, x, z, r); return true; }
      m.fill(x, G, z, x + 1, G + (r() < 0.4 ? 1 : 0), z + 1, B.SNOW); return true;
    });
    return m;
  }

  SH.registerMap('glacier', {
    name: '빙하 동굴', build, sky: [0x8ab0d8, 0xe0f0ff], fog: 0xd8e8f8, sun: 0.95, snow: true, fogNear: 34, fogFar: 120,
    desc: '미끄러운 얼음 · 눈보라',
    gim: { ice: true, events: [{ kind: 'blizzard', every: 50000, dur: 15000, warn: 3000 }] },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
