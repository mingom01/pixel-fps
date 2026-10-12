// 발전소 — 기믹: 컨베이어 벨트(올라서면 밀려감) + 전기 바닥(주기적으로 감전) + 70초마다 정전(어두워짐)
(function (SH) {
  const { VMap, B, G, rng, ground, border, house, roofStairs, scatter } = SH.MAPKIT;
  const CONV = [
    { at: [18, 22, 45, 23], dir: [1, 0], sp: 4.5 },
    { at: [18, 31, 45, 32], dir: [-1, 0], sp: 4.5 },
    { at: [18, 40, 45, 41], dir: [1, 0], sp: 4.5 },
  ];
  const ZAPS = [[20, 8, 43, 10], [20, 53, 43, 55], [8, 20, 10, 43], [53, 20, 55, 43]];

  function build() {
    const m = new VMap(64, 28, 64), r = rng(241);
    ground(m, B.CONCRETE, B.STONE);
    border(m, B.METAL, 6, B.HAZARD, 8);
    // 터빈 홀
    const hall = house(m, { x: 16, z: 16, w: 32, d: 32, h: 7, wall: B.METAL, corner: B.CONCRETE, floor: B.CONCRETE, roof: B.GRATE, doors: ['n', 's', 'w', 'e'], doorW: 4, doorH: 3, parapetB: B.HAZARD });
    roofStairs(m, hall, 'w', B.GRATE);
    // 지붕 채광창 (가운데)
    m.fill(26, G + 7, 26, 37, G + 7, 37, 0);
    // 컨베이어 벨트 + 양 옆 경고선
    for (const c of CONV) { m.fill(c.at[0], 3, c.at[1], c.at[2], 3, c.at[3], B.CONVEYOR); m.fill(c.at[0], 3, c.at[1] - 1, c.at[2], 3, c.at[1] - 1, B.HAZARD); m.fill(c.at[0], 3, c.at[3] + 1, c.at[2], 3, c.at[3] + 1, B.HAZARD); }
    // 발전기 (벨트 사이)
    for (const [x, z] of [[21, 26], [31, 26], [41, 26], [21, 35], [31, 35], [41, 35]]) { m.fill(x, G, z, x + 2, G + 2, z + 2, B.METAL); m.fill(x, G + 1, z + 1, x + 2, G + 1, z + 1, B.GLOWC); }
    // 전기 바닥 통로 (홀 바깥 네 방향)
    for (const z of ZAPS) m.fill(z[0], 3, z[1], z[2], 3, z[3], B.ELECTRIC);
    // 냉각탑 (모서리)
    for (const [cx, cz] of [[7, 7], [56, 7], [7, 56], [56, 56]]) {
      for (let y = 0; y < 8; y++) for (let z = cz - 4; z <= cz + 4; z++) for (let x = cx - 4; x <= cx + 4; x++) {
        const d = Math.hypot(x - cx, z - cz), rad = 4 - (y > 2 && y < 6 ? 0.6 : 0);
        if (d <= rad && d > rad - 1.1) m.set(x, G + y, z, B.CONCRETE);
      }
      m.fill(cx - 1, G, cz + (cz < 32 ? 3 : -4), cx + 1, G + 2, cz + (cz < 32 ? 4 : -3), 0);
    }
    // 파이프·상자 엄폐물
    scatter(m, r, 18, 3, 3, 60, 60, (x, z) => {
      if (x > 14 && x < 49 && z > 14 && z < 49) return false;
      if (!m.free(x - 1, G, z - 1, x + 2, G + 2, z + 2) || m.get(x, 3, z) !== B.CONCRETE) return false;
      if (r() < 0.5) m.fill(x, G, z, x + 1, G + (r() < 0.5 ? 1 : 0), z + 1, B.CRATE); else m.fill(x, G + 1, z, x + 1, G + 1, z, B.METAL);
      return true;
    });
    return m;
  }

  SH.registerMap('powerplant', {
    name: '발전소', build, sky: [0x5a6a80, 0xb8c4d0], fog: 0x9aa6b4, sun: 0.9,
    desc: '컨베이어 · 전기 바닥 · 정전',
    gim: { conv: CONV, zap: 45, zaps: ZAPS, events: [{ kind: 'zap', every: 16000, warn: 3000, dur: 5000 }, { kind: 'blackout', every: 70000, dur: 12000, warn: 2000 }] },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
