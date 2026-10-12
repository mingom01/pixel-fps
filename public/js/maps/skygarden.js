// 하늘 정원 — 기믹: 떠 있는 섬 사이를 잇는 점프대 + 떨어지면 즉사하는 구름 바다
(function (SH) {
  const { VMap, B, G, rng, house, tree, scatter } = SH.MAPKIT;

  // 섬: 중심 (cx, cz), 반지름 rad. 아래로 갈수록 좁아지는 바위
  function island(m, r, cx, cz, rad) {
    for (let z = Math.floor(cz - rad); z <= cz + rad; z++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      const d = Math.hypot(x - cx, z - cz) + (r() - 0.5) * 0.8;
      if (d > rad) continue;
      m.set(x, 3, z, B.GRASS);
      if (d < rad - 1) m.set(x, 2, z, B.DIRT);
      if (d < rad - 3) m.set(x, 1, z, B.STONE);
    }
  }

  function build() {
    const m = new VMap(64, 28, 64), r = rng(211);
    m.fill(0, 0, 0, 63, 0, 63, B.VOIDB);
    // 가운데 큰 섬 + 네 모서리 섬 + 동서 작은 섬
    island(m, r, 31.5, 31.5, 11);
    for (const [x, z] of [[11, 11], [52, 11], [11, 52], [52, 52]]) island(m, r, x, z, 8.5);
    island(m, r, 6, 31.5, 4.5); island(m, r, 57, 31.5, 4.5);
    // 나무 다리 (모서리 섬 ↔ 가운데, 대각선 둘만)
    const bridge = (x0, z0, x1, z1) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
      for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), z = Math.round(z0 + (z1 - z0) * i / n); m.fill(x, 3, z, x + 1, 3, z + 1, B.PLANKS); }
    };
    bridge(16, 16, 24, 24); bridge(39, 39, 46, 46);
    bridge(10, 31, 21, 31); bridge(42, 31, 53, 31);
    // 가운데 신전 (대리석 기둥 + 2층 단)
    m.fill(27, G, 27, 36, G, 36, B.MARBLE);
    for (const [x, z] of [[27, 27], [36, 27], [27, 36], [36, 36]]) m.fill(x, G + 1, z, x, G + 5, z, B.MARBLE);
    m.fill(27, G + 6, 27, 36, G + 6, 36, B.MARBLE); m.fill(29, G + 6, 29, 34, G + 6, 34, 0);
    m.fill(30, G + 1, 25, 33, G + 1, 25, B.MARBLE); m.fill(30, G + 2, 26, 33, G + 2, 26, B.MARBLE);
    // 모서리 섬 오두막
    for (const [x, z, d] of [[7, 7, ['s', 'e']], [48, 7, ['s', 'w']], [7, 48, ['n', 'e']], [48, 48, ['n', 'w']]]) house(m, { x, z, w: 8, d: 7, h: 3, wall: B.PLANKS, corner: B.LOG, floor: B.PLANKS, roof: B.LEAVES, doors: d, parapet: false });
    // 점프대 (2x2): 섬 → 다른 섬
    for (const p of PADS) m.fill(p.at[0], 3, p.at[1], p.at[2], 3, p.at[3], B.JUMPPAD);
    const nearPad = (x, z) => PADS.some(p => x > p.at[0] - 4 && x < p.at[2] + 4 && z > p.at[1] - 4 && z < p.at[3] + 4);
    scatter(m, r, 14, 4, 4, 59, 59, (x, z) => !nearPad(x, z) && m.get(x, 3, z) === B.GRASS && m.get(x + 2, 3, z + 2) === B.GRASS && m.get(x - 2, 3, z - 2) === B.GRASS && tree(m, x, z, r));
    return m;
  }
  const PADS = [
    { at: [35, 22, 36, 23], to: [50.5, 4, 13.5], h: 7 }, // 가운데 → 북동 섬
    { at: [27, 40, 28, 41], to: [13.5, 4, 50.5], h: 7 }, // 가운데 → 남서 섬
    { at: [47, 15, 48, 16], to: [38, 4, 26], h: 7 }, // 북동 → 가운데
    { at: [15, 47, 16, 48], to: [26, 4, 38], h: 7 }, // 남서 → 가운데
    { at: [11, 18, 12, 19], to: [52, 4, 46.5], h: 9 }, // 북서 → 남동 (멀리)
    { at: [51, 44, 52, 45], to: [12, 4, 15.5], h: 9 }, // 남동 → 북서
  ];

  SH.registerMap('skygarden', {
    name: '하늘 정원', build, sky: [0x6ab8ff, 0xe8f6ff], fog: 0xd8ecff, sun: 1.1, fogFar: 170,
    desc: '떠 있는 섬 · 점프대 · 추락 주의',
    gim: { voidY: 1.6, pads: PADS },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
