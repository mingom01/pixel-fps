// 화산섬 — 기믹: 용암 강(밟으면 화상) + 45초마다 화산 분화(운석이 떨어져 폭발, 벽도 부서짐)
(function (SH) {
  const { VMap, B, G, rng, ground, border, house, stairs, scatter, mound } = SH.MAPKIT;

  function build() {
    const m = new VMap(64, 28, 64), r = rng(201);
    ground(m, B.BASALT, B.OBSIDIAN);
    for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) if (r() < 0.08) m.set(x, 3, z, B.OBSIDIAN);
    border(m, B.BASALT, 6, B.OBSIDIAN, 7);
    // 용암 강 두 줄기 (가운데 화산에서 동·서로 흘러감), 다리 3개씩
    const river = (x0, x1, zc) => {
      for (let x = x0; x <= x1; x++) { const w = 1 + Math.round(Math.sin(x * 0.4) * 0.8); for (let z = zc - w; z <= zc + w + 1; z++) m.set(x, 3, z, B.LAVA); }
    };
    river(2, 22, 31); river(41, 61, 31);
    for (const x of [6, 14, 47, 55]) m.fill(x, 3, 27, x + 2, 3, 35, B.BASALT);
    // 다리 난간
    for (const x of [6, 14, 47, 55]) { m.fill(x - 1, G, 28, x - 1, G, 34, B.OBSIDIAN); m.fill(x + 3, G, 28, x + 3, G, 34, B.OBSIDIAN); }
    // 가운데 화산 (계단식 원뿔 + 꼭대기 분화구)
    for (let y = 0; y < 8; y++) {
      const rad = 10 - y;
      for (let z = 32 - rad; z <= 32 + rad; z++) for (let x = 32 - rad; x <= 32 + rad; x++) if (Math.hypot(x - 31.5, z - 31.5) <= rad) m.set(x, G + y, z, y > 5 ? B.OBSIDIAN : B.BASALT);
    }
    for (let z = 28; z <= 35; z++) for (let x = 28; x <= 35; x++) if (Math.hypot(x - 31.5, z - 31.5) <= 2.6) { m.fill(x, G + 4, z, x, G + 7, z, 0); m.set(x, G + 3, z, B.LAVA); }
    // 화산 오르는 길 (북·남 계단)
    stairs(m, 31, G, 20, 0, 1, 7, 2, B.BASALT); stairs(m, 31, G, 43, 0, -1, 7, 2, B.BASALT);
    // 무너진 관측소 4채 (모서리)
    for (const [x, z, d] of [[5, 5, ['s', 'e']], [46, 5, ['s', 'w']], [5, 47, ['n', 'e']], [46, 47, ['n', 'w']]]) {
      house(m, { x, z, w: 12, d: 11, h: 4, wall: B.BASALT, corner: B.OBSIDIAN, floor: B.BASALT, roof: B.OBSIDIAN, doors: d });
      m.fill(x + 3, G + 4, z + 3, x + 5, G + 5, z + 5, 0); // 지붕 구멍
    }
    // 바위·흑요석 기둥 엄폐물
    scatter(m, r, 26, 3, 3, 60, 60, (x, z) => {
      if (!m.free(x - 1, G, z - 1, x + 2, G + 3, z + 2) || m.get(x, 3, z) === B.LAVA || m.get(x + 1, 3, z + 1) === B.LAVA) return false;
      if (Math.hypot(x - 31.5, z - 31.5) < 13) return false;
      if (r() < 0.5) m.fill(x, G, z, x + 1, G + 1 + (r() * 2 | 0), z + 1, B.BASALT); else mound(m, x, z, 3, 3, 2, B.OBSIDIAN);
      return true;
    });
    return m;
  }

  SH.registerMap('volcano', {
    name: '화산섬', build, sky: [0x3a1410, 0xc8501a], fog: 0x6a2a18, sun: 0.85, fogNear: 30, fogFar: 120, noClouds: true,
    desc: '용암 강 · 화산 분화',
    gim: { lava: 35, events: [{ kind: 'eruption', every: 45000, warn: 4000 }] },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
