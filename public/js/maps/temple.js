// 고대 사원 (스파이크 전용) — 기믹: 한 방향 포탈. A 길목 포탈 → B 길목, B 길목 포탈 → A 길목 (빠른 사이트 전환)
(function (SH) {
  const { VMap, B, G, rng, ground, border, stairs, tree } = SH.MAPKIT;
  const PORTALS = [
    { at: [9, 39, 10, 40], y: G, to: [52.5, G, 33.5] }, // A 길 → B 길
    { at: [53, 39, 54, 40], y: G, to: [11.5, G, 33.5] }, // B 길 → A 길
  ];

  function build() {
    const m = new VMap(64, 26, 64), r = rng(271);
    ground(m, B.GRASS, B.DIRT);
    for (let z = 0; z < 64; z++) for (let x = 0; x < 64; x++) if (r() < 0.3) m.set(x, 3, z, B.PATH);
    border(m, B.MOSSY, 6, B.STONEBRICK, 6);
    const wall = (x0, z0, x1, z1, h) => m.fill(x0, G, z0, x1, G + (h || 5) - 1, z1, r() < 0.5 ? B.MOSSY : B.STONEBRICK);
    const door = (x0, z0, x1, z1) => m.fill(x0, G, z0, x1, G + 2, z1, 0);
    // 공격 진영 앞 벽 (문 3개)
    wall(1, 46, 62, 47); door(7, 46, 11, 47); door(29, 46, 34, 47); door(52, 46, 56, 47);
    // 레인 구분벽
    wall(20, 29, 21, 45); wall(42, 29, 43, 45);
    // 사이트 ↔ 가운데 벽
    wall(20, 12, 21, 28); wall(42, 12, 43, 28); door(20, 17, 21, 19); door(42, 17, 43, 19);
    // 레인 → 사이트 입구
    wall(1, 28, 19, 28); wall(44, 28, 62, 28); door(4, 28, 8, 28); door(55, 28, 59, 28);
    // 수비 진영 앞 벽
    wall(1, 11, 62, 11); door(9, 11, 12, 11); door(29, 11, 34, 11); door(51, 11, 54, 11);
    // 사이트: 금 장식 바닥 + 제단
    m.fill(3, 3, 13, 18, 3, 26, B.STONEBRICK); m.fill(45, 3, 13, 60, 3, 26, B.STONEBRICK);
    for (const [x, z] of [[8, 17], [53, 17]]) { m.fill(x, G, z, x + 3, G, z + 3, B.GOLD); m.fill(x + 1, G + 1, z + 1, x + 2, G + 1, z + 2, B.CHISEL); }
    for (const [x, z] of [[4, 14], [15, 23], [16, 14], [4, 23], [46, 14], [57, 23], [58, 14], [46, 23]]) m.fill(x, G, z, x + 1, G + 1, z + 1, B.CRATE);
    // 가운데 안뜰: 무너진 탑 + 계단
    m.fill(27, G, 22, 36, G + 2, 31, B.STONEBRICK); m.fill(28, G, 23, 35, G + 2, 30, 0);
    m.fill(27, G + 3, 22, 36, G + 3, 31, B.MOSSY); m.fill(29, G + 3, 24, 34, G + 3, 29, 0);
    for (const [x0, z0, x1, z1] of [[30, 22, 33, 22], [30, 31, 33, 31], [27, 25, 27, 28], [36, 25, 36, 28]]) m.fill(x0, G, z0, x1, G + 1, z1, 0);
    stairs(m, 37, G, 25, 0, 1, 3, 2, B.STONEBRICK);
    tree(m, 24, 36, r); tree(m, 39, 36, r); tree(m, 24, 16, r); tree(m, 39, 16, r);
    // 레인 엄폐물
    for (const [x, z] of [[5, 33], [15, 37], [12, 42], [27, 38], [35, 41], [31, 35], [48, 33], [58, 37], [51, 42]]) m.fill(x, G, z, x + 1, G + (r() < 0.5 ? 1 : 0), z, r() < 0.5 ? B.CRATE : B.MOSSY);
    // 포탈 (주변을 기둥으로 표시)
    for (const p of PORTALS) {
      m.fill(p.at[0], 3, p.at[1], p.at[2], 3, p.at[3], B.PORTAL);
      for (const [dx, dz] of [[-1, -1], [2, -1], [-1, 2], [2, 2]]) m.fill(p.at[0] + dx, G, p.at[1] + dz, p.at[0] + dx, G + 2, p.at[1] + dz, B.OBSIDIAN);
    }
    return m;
  }

  SH.registerMap('temple', {
    name: '고대 사원', kind: 'spike', build, sky: [0x7fc08a, 0xe0f0c8], fog: 0xb8d8a8, sun: 1, fogNear: 30, fogFar: 120,
    desc: '스파이크 · 한 방향 포탈',
    spike: { atk: [24, 50, 39, 60], def: [24, 2, 39, 9], A: [3, 13, 18, 26], B: [45, 13, 60, 26] },
    gim: { portals: PORTALS },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
