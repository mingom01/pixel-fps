// 피라미드 — 기믹: 유사(流沙) 구덩이는 발이 묶여 느려짐 + 55초마다 모래폭풍(시야 감소)
(function (SH) {
  const { VMap, B, G, rng, ground, border, house, stairs, scatter } = SH.MAPKIT;

  function build() {
    const m = new VMap(64, 30, 64), r = rng(251);
    ground(m, B.SAND, B.SANDSTONE);
    border(m, B.SANDSTONE, 5, B.CHISEL, 8);
    // 계단식 피라미드 (가운데) + 안쪽 방
    for (let y = 0; y < 9; y++) { const h = 11 - y; m.fill(32 - h, G + y, 32 - h, 31 + h, G + y, 31 + h, y % 3 === 2 ? B.CHISEL : B.SANDSTONE); }
    m.fill(27, G, 27, 36, G + 3, 36, 0); // 안쪽 방
    m.fill(30, G, 21, 33, G + 2, 26, 0); m.fill(30, G, 37, 33, G + 2, 42, 0); // 남북 통로
    m.fill(21, G, 30, 26, G + 2, 33, 0); m.fill(37, G, 30, 42, G + 2, 33, 0); // 동서 통로
    m.fill(30, G, 30, 33, G, 33, B.GOLD); m.set(31, G + 1, 31, B.LAMP); m.set(32, G + 1, 32, B.LAMP);
    // 꼭대기로 오르는 계단 (서쪽 면)
    for (let k = 0; k < 9; k++) m.fill(20 + k, G + k, 28, 20 + k, G + k, 29, B.CHISEL);
    m.fill(20, G, 28, 20, G, 29, B.SANDSTONE);
    // 유사 구덩이 (느려짐)
    for (const [cx, cz, rad] of [[10, 32, 4], [53, 32, 4], [32, 8, 3.5], [32, 55, 3.5], [16, 50, 3], [47, 13, 3]]) {
      for (let z = Math.floor(cz - rad); z <= cz + rad; z++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) if (Math.hypot(x - cx, z - cz) <= rad) m.set(x, 3, z, B.QUICKSAND);
    }
    // 오벨리스크
    for (const [x, z] of [[14, 14], [49, 14], [14, 49], [49, 49]]) { m.fill(x, G, z, x + 1, G + 6, z + 1, B.SANDSTONE); m.fill(x, G + 7, z, x + 1, G + 7, z + 1, B.GOLD); }
    // 무너진 신전 기둥·벽
    const ruin = (x, z, len, alongX) => { for (let i = 0; i < len; i++) { const hh = 1 + Math.floor(r() * 3), cx = alongX ? x + i : x, cz = alongX ? z : z + i; if (m.free(cx, G, cz, cx, G, cz)) m.fill(cx, G, cz, cx, G + hh - 1, cz, r() < 0.3 ? B.CHISEL : B.SANDSTONE); } };
    ruin(4, 22, 7, true); ruin(53, 41, 7, true); ruin(22, 4, 6, false); ruin(41, 53, 6, false);
    // 상인 천막
    house(m, { x: 4, z: 4, w: 7, d: 6, h: 3, wall: B.WOOL_Y, corner: B.DARKWOOD, floor: B.SAND, roof: B.WOOL_R, doors: ['s', 'e'], parapet: false });
    house(m, { x: 53, z: 54, w: 7, d: 6, h: 3, wall: B.WOOL_Y, corner: B.DARKWOOD, floor: B.SAND, roof: B.WOOL_R, doors: ['n', 'w'], parapet: false });
    scatter(m, r, 16, 3, 3, 60, 60, (x, z) => {
      if (m.get(x, 3, z) !== B.SAND || !m.free(x - 1, G, z - 1, x + 1, G + 3, z + 1) || (x > 18 && x < 46 && z > 18 && z < 46)) return false;
      m.fill(x, G, z, x, G + 1 + (r() * 2 | 0), z, r() < 0.5 ? B.CACTUS : B.SANDSTONE); return true;
    });
    void stairs;
    return m;
  }

  SH.registerMap('pyramid', {
    name: '피라미드', build, sky: [0xf0b060, 0xffe8b8], fog: 0xf0d098, sun: 1.15,
    desc: '유사 구덩이 · 모래폭풍',
    gim: { events: [{ kind: 'sandstorm', every: 55000, dur: 14000, warn: 3000 }] },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
