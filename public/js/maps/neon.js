// 네온 시티 — 기믹: 보라색 포탈을 밟으면 빌딩 옥상으로 순간이동 (옥상 포탈로 다시 내려옴)
(function (SH) {
  const { VMap, B, G, rng, ground, border, house, scatter } = SH.MAPKIT;
  const H = 9, ROOF = G + H + 1; // 옥상에 서는 높이
  const TOWERS = [[6, 6], [46, 6], [6, 46], [46, 46]];
  // 지상 포탈(타워에서 가운데 쪽)과 옥상 포탈(타워 안쪽 모서리)
  const PORTALS = [];
  TOWERS.forEach(([x, z]) => {
    const sx = x < 32 ? 1 : -1, sz = z < 32 ? 1 : -1;
    const gx = x < 32 ? x + 13 : x - 3, gz = z < 32 ? z + 13 : z - 3; // 지상 포탈 2x2 왼쪽 위
    const rx = x < 32 ? x + 8 : x + 2, rz = z < 32 ? z + 8 : z + 2; // 옥상 포탈
    PORTALS.push({ at: [gx, gz, gx + 1, gz + 1], y: G, to: [x + 6, ROOF, z + 6], ground: true });
    PORTALS.push({ at: [rx, rz, rx + 1, rz + 1], y: ROOF, to: [gx + 1 + sx * 3, G, gz + 1 + sz * 3] });
  });

  function build() {
    const m = new VMap(64, 32, 64), r = rng(231);
    ground(m, B.ASPHALT, B.STONE);
    border(m, B.CONCRETE, 6, B.NEON_B, 8);
    // 거리 네온 라인
    for (let i = 3; i < 61; i++) { if (i % 3) { m.set(i, 3, 31, B.NEON_B); m.set(31, 3, i, B.NEON_P); } }
    // 네 개의 네온 빌딩
    TOWERS.forEach(([x, z], i) => {
      const t = house(m, { x, z, w: 12, d: 12, h: H, wall: B.WINDOW, corner: i % 2 ? B.NEON_P : B.NEON_B, floor: B.CONCRETE, roof: B.CONCRETE, doors: [z < 32 ? 's' : 'n', x < 32 ? 'e' : 'w'], doorW: 3, parapetB: i % 2 ? B.NEON_P : B.NEON_B });
      // 2층 바닥 + 안쪽 계단
      m.fill(x + 1, G + 4, z + 1, x + 10, G + 4, z + 10, B.CONCRETE); m.fill(x + 2, G + 4, z + 2, x + 5, G + 4, z + 3, 0);
      for (let k = 0; k < 4; k++) m.fill(x + 2 + k, G, z + 2, x + 2 + k, G + k, z + 3, B.CONCRETE);
      void t;
    });
    // 포탈 바닥
    for (const p of PORTALS) m.fill(p.at[0], p.y - 1, p.at[1], p.at[2], p.y - 1, p.at[3], B.PORTAL);
    // 가운데 광장: 분수 + 네온 링
    for (let z = 24; z <= 39; z++) for (let x = 24; x <= 39; x++) { const d = Math.hypot(x - 31.5, z - 31.5); if (d < 7.5) m.set(x, 3, z, d < 4.5 ? B.WOOL_B : B.MARBLE); if (d >= 7 && d < 7.6) m.set(x, G, z, B.NEON_P); }
    m.fill(31, G, 31, 32, G + 2, 32, B.MARBLE); m.set(31, G + 3, 31, B.NEON_B); m.set(32, G + 3, 32, B.NEON_B);
    // 광고판 벽 (엄폐물)
    for (const [x, z, ax] of [[22, 14, 1], [38, 14, 1], [22, 49, 1], [38, 49, 1], [14, 26, 0], [14, 34, 0], [49, 26, 0], [49, 34, 0]]) {
      if (ax) { m.fill(x, G, z, x + 3, G + 2, z, B.CONCRETE); m.fill(x, G + 3, z, x + 3, G + 3, z, r() < 0.5 ? B.NEON_P : B.NEON_B); }
      else { m.fill(x, G, z, x, G + 2, z + 3, B.CONCRETE); m.fill(x, G + 3, z, x, G + 3, z + 3, r() < 0.5 ? B.NEON_P : B.NEON_B); }
    }
    // 자동차·상자
    scatter(m, r, 12, 3, 3, 60, 60, (x, z) => {
      if (!m.free(x - 1, G, z - 1, x + 3, G + 2, z + 3) || m.get(x, 3, z) !== B.ASPHALT || Math.hypot(x - 31.5, z - 31.5) < 10) return false;
      if (PORTALS.some(p => x > p.at[0] - 4 && x < p.at[2] + 4 && z > p.at[1] - 4 && z < p.at[3] + 4)) return false;
      const col = [B.CRED, B.CBLUE, B.CYELLOW, B.WOOL_W][r() * 4 | 0];
      if (r() < 0.5) { m.fill(x, G, z, x + 3, G, z + 1, col); m.fill(x + 1, G + 1, z, x + 2, G + 1, z + 1, B.WINDOW); } else m.fill(x, G, z, x, G + 1, z, B.CRATE);
      return true;
    });
    return m;
  }

  SH.registerMap('neon', {
    name: '네온 시티', build, sky: [0x05040e, 0x2a1050], fog: 0x1a0c30, sun: 0.75, stars: true, noClouds: true, fogNear: 40, fogFar: 150,
    desc: '포탈로 옥상 순간이동',
    gim: { portals: PORTALS.map(p => ({ at: p.at, y: p.y, to: p.to })) },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
