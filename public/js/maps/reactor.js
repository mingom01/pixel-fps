// 원자로 (스파이크 전용) — 기믹: 가운데 통로 전기 바닥(주기적 감전) + B 길목 컨베이어(사이트 쪽으로 밀어줌) + 정전
(function (SH) {
  const { VMap, B, G, rng, ground, border } = SH.MAPKIT;
  const CONV = [{ at: [50, 31, 56, 44], dir: [0, -1], sp: 3.5 }];
  const ZAPS = [[28, 18, 35, 26], [28, 34, 35, 42]];

  function build() {
    const m = new VMap(64, 26, 64), r = rng(291);
    ground(m, B.CONCRETE, B.STONE);
    border(m, B.METAL, 7, B.HAZARD, 6);
    const wall = (x0, z0, x1, z1, h) => m.fill(x0, G, z0, x1, G + (h || 5) - 1, z1, B.PANEL);
    const door = (x0, z0, x1, z1) => m.fill(x0, G, z0, x1, G + 2, z1, 0);
    // 기본 구조 (공격 아래 / 수비 위)
    wall(1, 46, 62, 47); door(6, 46, 10, 47); door(29, 46, 34, 47); door(51, 46, 56, 47);
    wall(21, 29, 22, 45); wall(41, 29, 42, 45);
    wall(21, 12, 22, 28); wall(41, 12, 42, 28); door(21, 15, 22, 17); door(41, 15, 42, 17);
    wall(1, 28, 20, 28); wall(43, 28, 62, 28); door(9, 28, 13, 28); door(50, 28, 56, 28);
    wall(1, 11, 62, 11); door(8, 11, 11, 11); door(29, 11, 34, 11); door(52, 11, 55, 11);
    // 가운데: 원자로 코어 (빛나는 기둥) + 전기 바닥 통로
    m.fill(29, G, 29, 34, G + 5, 34, B.METAL); m.fill(30, G, 30, 33, G + 6, 33, B.GLOWC);
    for (const [x0, z0, x1, z1] of ZAPS) m.fill(x0, 3, z0, x1, 3, z1, B.ELECTRIC);
    for (const [x, z] of [[24, 20], [38, 20], [24, 38], [38, 38]]) m.fill(x, G, z, x + 1, G + 1, z + 1, B.METAL);
    // 사이트: 냉각수 탱크·제어판
    m.fill(3, 3, 13, 19, 3, 27, B.GRATE); m.fill(44, 3, 13, 60, 3, 27, B.GRATE);
    for (const [x, z] of [[6, 16], [14, 22], [17, 14], [5, 24], [47, 16], [55, 22], [58, 14], [46, 24]]) m.fill(x, G, z, x + 1, G + 1 + (r() < 0.4 ? 1 : 0), z + 1, r() < 0.5 ? B.METAL : B.CRATE);
    for (const [x, z] of [[10, 18], [51, 18]]) { m.fill(x, G, z, x + 2, G + 2, z + 2, B.CBLUE); m.fill(x, G + 3, z, x + 2, G + 3, z + 2, B.GLOWC); }
    // B 길목 컨베이어 (사이트 쪽으로)
    for (const c of CONV) { m.fill(c.at[0], 3, c.at[1], c.at[2], 3, c.at[3], B.CONVEYOR); m.fill(c.at[0] - 1, 3, c.at[1], c.at[0] - 1, 3, c.at[3], B.HAZARD); m.fill(c.at[2] + 1, 3, c.at[1], c.at[2] + 1, 3, c.at[3], B.HAZARD); }
    // A 길목 엄폐물 · 파이프
    for (const [x, z] of [[5, 33], [15, 36], [10, 41], [27, 44], [36, 44], [46, 33], [59, 38]]) m.fill(x, G, z, x + 1, G + (r() < 0.5 ? 1 : 0), z, B.CRATE);
    for (let x = 2; x < 62; x++) if (x % 9 !== 0) m.set(x, G + 6, 29, B.METAL);
    return m;
  }

  SH.registerMap('reactor', {
    name: '원자로', kind: 'spike', build, sky: [0x3a4a5a, 0x9ab0c0], fog: 0x6a7a8a, sun: 0.85, fogNear: 34, fogFar: 130,
    desc: '스파이크 · 전기 바닥 · 컨베이어 · 정전',
    spike: { atk: [24, 50, 39, 60], def: [24, 2, 39, 9], A: [3, 13, 19, 27], B: [44, 13, 60, 27] },
    gim: { conv: CONV, zap: 45, zaps: ZAPS, events: [{ kind: 'zap', every: 14000, warn: 3000, dur: 4500 }, { kind: 'blackout', every: 60000, dur: 10000, warn: 2000 }] },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
