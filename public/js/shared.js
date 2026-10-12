// 픽셀 스트라이크 — 서버/클라 공용 (맵·물리·무기 데이터)
// 브라우저: window.SH, Node: require()
(function (root, factory) {
  const S = factory();
  if (typeof module === 'object' && module.exports) module.exports = S; else root.SH = S;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ================= 블록 ================= */
  const B = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANKS: 5, LOG: 6, LEAVES: 7, SAND: 8, SANDSTONE: 9,
    BRICK: 10, CONCRETE: 11, METAL: 12, CRATE: 13, ROOF: 14, BEDROCK: 15, ASPHALT: 16, PATH: 17, HAY: 18,
    CACTUS: 19, CRED: 20, CBLUE: 21, CGREEN: 22, CHISEL: 23, LAMP: 24, PLASTER: 25, GRATE: 26, HAZARD: 27,
    DARKWOOD: 28, CYELLOW: 29,
    SNOW: 30, ICE: 31, PINE: 32, MOSSY: 33, STONEBRICK: 34, ORE_COAL: 35, ORE_GOLD: 36, ORE_DIA: 37, REGOLITH: 38, MOONROCK: 39,
    PANEL: 40, WINDOW: 41, WOOL_R: 42, WOOL_B: 43, WOOL_W: 44, WOOL_Y: 45, GOLD: 46, GLOWC: 47,
  };

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  class VMap {
    constructor(W, H, D) { this.W = W; this.H = H; this.D = D; this.d = new Uint8Array(W * H * D); }
    inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.W && y < this.H && z < this.D; }
    get(x, y, z) {
      if (x < 0 || z < 0 || x >= this.W || z >= this.D) return B.BEDROCK;
      if (y < 0) return B.BEDROCK;
      if (y >= this.H) return 0;
      return this.d[(y * this.D + z) * this.W + x];
    }
    solid(x, y, z) { return this.get(x, y, z) !== 0; }
    set(x, y, z, b) { if (this.inside(x, y, z)) this.d[(y * this.D + z) * this.W + x] = b; }
    fill(x0, y0, z0, x1, y1, z1, b) {
      if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, b);
    }
    clone() {
      const m = new VMap(this.W, this.H, this.D); m.d.set(this.d);
      m.id = this.id; m.spawns = this.spawns; m.bases = this.bases; m.teamSpawns = this.teamSpawns; m.shops = this.shops; m.pickups = this.pickups; m.grav = this.grav; m.spike = this.spike; m.range = this.range;
      return m;
    }
    free(x0, y0, z0, x1, y1, z1) {
      for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.get(x, y, z)) return false;
      return true;
    }
  }

  /* ================= 맵 빌더 ================= */
  const G = 4; // 지면 위 걷는 높이

  function ground(m, top, sub) {
    m.fill(0, 0, 0, m.W - 1, 0, m.D - 1, B.BEDROCK);
    m.fill(0, 1, 0, m.W - 1, 2, m.D - 1, sub);
    m.fill(0, 3, 0, m.W - 1, 3, m.D - 1, top);
  }
  function border(m, b, h, post, every) {
    for (let i = 0; i < m.W; i++) { m.fill(i, G, 0, i, G + h - 1, 0, b); m.fill(i, G, m.D - 1, i, G + h - 1, m.D - 1, b); }
    for (let i = 0; i < m.D; i++) { m.fill(0, G, i, 0, G + h - 1, i, b); m.fill(m.W - 1, G, i, m.W - 1, G + h - 1, i, b); }
    if (post) {
      for (let i = 0; i < m.W; i += every) { m.fill(i, G, 0, i, G + h, 0, post); m.fill(i, G, m.D - 1, i, G + h, m.D - 1, post); }
      for (let i = 0; i < m.D; i += every) { m.fill(0, G, i, 0, G + h, i, post); m.fill(m.W - 1, G, i, m.W - 1, G + h, i, post); }
    }
  }
  // 집: 문/창문/평지붕(+난간). 문 방향 n(-z) s(+z) w(-x) e(+x)
  function house(m, o) {
    const y = o.y == null ? G : o.y, { x, z, w, d, h } = o;
    const x1 = x + w - 1, z1 = z + d - 1, wall = o.wall, corner = o.corner || wall;
    m.fill(x, y - 1, z, x1, y - 1, z1, o.floor || wall);
    for (let yy = y; yy < y + h; yy++) {
      for (let i = x; i <= x1; i++) { m.set(i, yy, z, wall); m.set(i, yy, z1, wall); }
      for (let i = z; i <= z1; i++) { m.set(x, yy, i, wall); m.set(x1, yy, i, wall); }
      m.set(x, yy, z, corner); m.set(x1, yy, z, corner); m.set(x, yy, z1, corner); m.set(x1, yy, z1, corner);
    }
    m.fill(x + 1, y, z + 1, x1 - 1, y + h - 1, z1 - 1, 0);
    m.fill(x, y + h, z, x1, y + h, z1, o.roof || wall);
    if (o.parapet !== false) {
      const py = y + h + 1, pb = o.parapetB || corner;
      for (let i = x; i <= x1; i++) { m.set(i, py, z, pb); m.set(i, py, z1, pb); }
      for (let i = z; i <= z1; i++) { m.set(x, py, i, pb); m.set(x1, py, i, pb); }
    }
    // 창문 (2칸 x 1칸, 가슴 높이)
    if (o.win !== false) {
      const wy = y + 1;
      const winAlong = (len, put) => { if (len < 6) return; const n = len >= 12 ? 3 : len >= 8 ? 2 : 1; for (let k = 1; k <= n; k++) { const c = Math.round(len * k / (n + 1)); put(c - 1); put(c); } };
      winAlong(w, i => { if (i > 0 && i < w - 1) { m.set(x + i, wy, z, 0); m.set(x + i, wy, z1, 0); } });
      winAlong(d, i => { if (i > 0 && i < d - 1) { m.set(x, wy, z + i, 0); m.set(x1, wy, z + i, 0); } });
    }
    const dw = o.doorW || 2, dh = o.doorH || 2;
    for (const s of (o.doors || ['s'])) {
      if (s === 'n' || s === 's') {
        const cx = x + Math.floor((w - dw) / 2), zz = s === 'n' ? z : z1;
        m.fill(cx, y, zz, cx + dw - 1, y + dh - 1, zz, 0);
      } else {
        const cz = z + Math.floor((d - dw) / 2), xx = s === 'w' ? x : x1;
        m.fill(xx, y, cz, xx, y + dh - 1, cz + dw - 1, 0);
      }
    }
    return { x, z, w, d, h, y };
  }
  // 바깥 계단으로 지붕 올라가기
  function roofStairs(m, hs, side, block) {
    const { x, z, w, d, h, y } = hs, x1 = x + w - 1, z1 = z + d - 1;
    let ox, oz, ax, az, nx, nz;
    if (side === 's') { ox = x; oz = z1 + 1; ax = 1; az = 0; nx = 0; nz = 1; }
    else if (side === 'n') { ox = x; oz = z - 1; ax = 1; az = 0; nx = 0; nz = -1; }
    else if (side === 'e') { ox = x1 + 1; oz = z; ax = 0; az = 1; nx = 1; nz = 0; }
    else { ox = x - 1; oz = z; ax = 0; az = 1; nx = -1; nz = 0; }
    for (let k = 0; k < h; k++) for (let wi = 0; wi < 2; wi++) {
      const cx = ox + ax * k + nx * wi, cz = oz + az * k + nz * wi;
      m.fill(cx, y, cz, cx, y + k, cz, block);
    }
    for (const k of [h - 1, h - 2]) m.set(ox + ax * k - nx, y + h + 1, oz + az * k - nz, 0);
  }
  // 계단: (x,z)에서 (dx,dz) 방향으로 올라감, 폭은 수직 방향 +
  function stairs(m, x, y, z, dx, dz, len, width, block) {
    const px = dz !== 0 ? 1 : 0, pz = dx !== 0 ? 1 : 0;
    for (let k = 0; k < len; k++) for (let wi = 0; wi < width; wi++) {
      const cx = x + dx * k + px * wi, cz = z + dz * k + pz * wi;
      m.fill(cx, y, cz, cx, y + k, cz, block);
    }
  }
  function tree(m, x, z, r, y) {
    y = y == null ? G : y;
    const th = 4 + Math.floor(r() * 2);
    if (!m.free(x - 2, y, z - 2, x + 2, y + th + 2, z + 2)) return false;
    for (let dy = th - 2; dy <= th + 1; dy++) {
      const rad = dy >= th ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && r() < 0.7) continue;
        if (dy === th + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        m.set(x + dx, y + dy, z + dz, B.LEAVES);
      }
    }
    m.fill(x, y, z, x, y + th - 1, z, B.LOG);
    return true;
  }
  function scatter(m, r, n, x0, z0, x1, z1, fn) {
    let placed = 0;
    for (let t = 0; t < n * 12 && placed < n; t++) {
      const x = x0 + Math.floor(r() * (x1 - x0 + 1)), z = z0 + Math.floor(r() * (z1 - z0 + 1));
      if (fn(x, z)) placed++;
    }
  }
  function crateStack(m, r, x, z, b) {
    const w = r() < 0.5 ? 1 : 2, dd = r() < 0.5 ? 1 : 2, hh = r() < 0.35 ? 2 : 1;
    if (!m.free(x - 1, G, z - 1, x + w, G + 2, z + dd)) return false;
    if (!m.solid(x, G - 1, z)) return false;
    m.fill(x, G, z, x + w - 1, G + hh - 1, z + dd - 1, b);
    if (hh === 1 && w === 2 && r() < 0.5) m.set(x, G + 1, z, b);
    return true;
  }

  function buildVillage() {
    const m = new VMap(64, 26, 64), r = rng(11);
    ground(m, B.GRASS, B.DIRT);
    border(m, B.COBBLE, 3, B.LOG, 6);
    for (let i = 1; i < 63; i++) { if (r() < 0.45) m.set(i, G + 3, 0, B.LEAVES); if (r() < 0.45) m.set(i, G + 3, 63, B.LEAVES); if (r() < 0.45) m.set(0, G + 3, i, B.LEAVES); if (r() < 0.45) m.set(63, G + 3, i, B.LEAVES); }
    m.fill(3, 3, 30, 60, 3, 33, B.PATH); m.fill(30, 3, 3, 33, 3, 60, B.PATH);
    m.fill(24, 3, 24, 39, 3, 39, B.COBBLE);
    // 분수대
    m.fill(28, G, 28, 35, G, 35, B.STONE); m.fill(29, G, 29, 34, G, 34, 0);
    m.fill(31, G, 31, 32, G + 2, 32, B.STONE); m.fill(31, G + 3, 31, 32, G + 3, 32, B.LAMP);
    // 광장 엄폐 벽
    for (const [ax, az] of [[25, 25], [36, 25], [25, 36], [36, 36]]) { m.fill(ax, G, az, ax + 2, G + 1, az, B.BRICK); m.fill(ax, G, az, ax, G + 1, az + 2, B.BRICK); }
    m.fill(25, G, 36, 27, G + 1, 36, B.BRICK); m.fill(27, G, 36, 27, G + 1, 38, 0); m.fill(25, G, 36, 25, G + 1, 38, B.BRICK);
    const H = [
      { x: 5, z: 5, w: 10, d: 8, h: 4, wall: B.PLANKS, corner: B.LOG, floor: B.PLANKS, roof: B.ROOF, doors: ['s'], st: 'e' },
      { x: 18, z: 6, w: 8, d: 8, h: 4, wall: B.PLASTER, corner: B.LOG, floor: B.PLANKS, roof: B.ROOF, doors: ['s', 'w'], st: 'e' },
      { x: 40, z: 5, w: 12, d: 9, h: 5, wall: B.BRICK, corner: B.COBBLE, floor: B.PLANKS, roof: B.DARKWOOD, doors: ['s', 'e'], st: 'w' },
      { x: 5, z: 40, w: 13, d: 11, h: 6, wall: B.PLANKS, corner: B.LOG, floor: B.PATH, roof: B.ROOF, doors: ['n', 'e'], st: 's', doorW: 3, doorH: 3 },
      { x: 42, z: 42, w: 10, d: 9, h: 4, wall: B.PLASTER, corner: B.BRICK, floor: B.PLANKS, roof: B.ROOF, doors: ['n', 'w'], st: 'e' },
      { x: 22, z: 46, w: 7, d: 7, h: 4, wall: B.COBBLE, corner: B.LOG, floor: B.PLANKS, roof: B.DARKWOOD, doors: ['n'], st: 'w' },
      { x: 52, z: 20, w: 7, d: 9, h: 4, wall: B.PLANKS, corner: B.DARKWOOD, floor: B.PLANKS, roof: B.ROOF, doors: ['w'], st: 's' },
    ];
    for (const o of H) { const hs = house(m, o); roofStairs(m, hs, o.st, o.wall === B.PLASTER ? B.PLANKS : o.wall); }
    // 헛간 안 건초
    m.fill(7, G, 47, 9, G + 1, 49, B.HAY); m.fill(14, G, 42, 15, G, 43, B.HAY); m.set(7, G + 2, 49, B.HAY);
    // 집 안 가구(상자)
    m.fill(6, G, 6, 7, G, 6, B.CRATE); m.fill(44, G, 6, 45, G + 1, 6, B.CRATE); m.fill(49, G, 48, 50, G, 49, B.CRATE);
    scatter(m, r, 16, 4, 4, 59, 59, (x, z) => tree(m, x, z, r));
    scatter(m, r, 16, 4, 4, 59, 59, (x, z) => crateStack(m, r, x, z, r() < 0.5 ? B.CRATE : B.HAY));
    return m;
  }

  function buildDesert() {
    const m = new VMap(64, 26, 64), r = rng(23);
    ground(m, B.SAND, B.SAND);
    border(m, B.SANDSTONE, 4, B.CHISEL, 8);
    // 피라미드 신전
    m.fill(20, G, 20, 43, G + 2, 43, B.SANDSTONE);
    m.fill(20, G, 30, 43, G + 1, 33, 0); // 동서 터널
    m.fill(20, G + 2, 30, 43, G + 2, 33, B.CHISEL);
    m.fill(31, G, 20, 32, G + 1, 29, 0); m.fill(31, G, 34, 32, G + 1, 43, 0); // 남북 통로(입구)
    m.fill(31, G + 2, 20, 32, G + 2, 43, B.CHISEL);
    stairs(m, 26, G, 46, 0, -1, 3, 2, B.SANDSTONE); stairs(m, 36, G, 46, 0, -1, 3, 2, B.SANDSTONE);
    stairs(m, 26, G, 17, 0, 1, 3, 2, B.SANDSTONE); stairs(m, 36, G, 17, 0, 1, 3, 2, B.SANDSTONE);
    m.fill(25, G + 3, 25, 38, G + 4, 38, B.SANDSTONE);
    stairs(m, 38 + 2, G + 3, 31, -1, 0, 2, 2, B.SANDSTONE); stairs(m, 25 - 2, G + 3, 31, 1, 0, 2, 2, B.SANDSTONE);
    m.fill(29, G + 5, 29, 34, G + 5, 34, B.CHISEL);
    for (const [px, pz] of [[29, 29], [34, 29], [29, 34], [34, 34]]) m.fill(px, G + 6, pz, px, G + 8, pz, B.CHISEL);
    m.fill(28, G + 9, 28, 35, G + 9, 35, B.SANDSTONE); m.fill(30, G + 9, 30, 33, G + 9, 33, 0);
    m.fill(31, G + 6, 31, 32, G + 6, 32, B.LAMP);
    stairs(m, 31, G + 5, 36, 0, -1, 1, 2, B.SANDSTONE);
    // 오두막
    const H = [
      { x: 4, z: 4, w: 9, d: 8, h: 4, doors: ['s', 'e'], st: 'w' },
      { x: 50, z: 5, w: 9, d: 9, h: 5, doors: ['s', 'w'], st: 'e' },
      { x: 5, z: 50, w: 10, d: 8, h: 4, doors: ['n', 'e'], st: 's' },
      { x: 49, z: 49, w: 9, d: 9, h: 4, doors: ['n', 'w'], st: 'e' },
    ];
    for (const o of H) { const hs = house(m, Object.assign({ wall: B.SANDSTONE, corner: B.CHISEL, floor: B.SANDSTONE, roof: B.SANDSTONE }, o)); roofStairs(m, hs, o.st, B.SANDSTONE); }
    // 무너진 벽, 기둥
    const ruin = (x, z, len, dirX) => {
      for (let i = 0; i < len; i++) {
        const hh = 1 + Math.floor(r() * 4), cx = dirX ? x + i : x, cz = dirX ? z : z + i;
        if (m.free(cx, G, cz, cx, G, cz)) m.fill(cx, G, cz, cx, G + hh - 1, cz, r() < 0.2 ? B.CHISEL : B.SANDSTONE);
      }
    };
    ruin(16, 8, 9, true); ruin(40, 10, 8, true); ruin(8, 22, 8, false); ruin(55, 24, 9, false);
    ruin(14, 56, 8, true); ruin(41, 55, 6, true); ruin(10, 33, 6, false); ruin(54, 37, 7, false);
    for (const [px, pz] of [[16, 16], [47, 16], [16, 47], [47, 47], [12, 30], [51, 33], [31, 12], [31, 51]]) {
      if (m.free(px, G, pz, px, G + 5, pz)) { m.fill(px, G, pz, px, G + 4, pz, B.CHISEL); m.fill(px - 1, G + 5, pz - 1, px + 1, G + 5, pz + 1, B.SANDSTONE); }
    }
    scatter(m, r, 22, 3, 3, 60, 60, (x, z) => {
      if (!m.free(x - 1, G, z - 1, x + 1, G + 3, z + 1)) return false;
      m.fill(x, G, z, x, G + 1 + Math.floor(r() * 2), z, B.CACTUS); return true;
    });
    scatter(m, r, 12, 3, 3, 60, 60, (x, z) => crateStack(m, r, x, z, B.CRATE));
    return m;
  }

  function buildFactory() {
    const m = new VMap(64, 28, 64), r = rng(37);
    ground(m, B.ASPHALT, B.STONE);
    m.fill(2, 3, 2, 61, 3, 61, B.CONCRETE);
    m.fill(3, 3, 28, 60, 3, 35, B.ASPHALT); m.fill(28, 3, 3, 35, 3, 60, B.ASPHALT);
    for (let i = 4; i < 60; i += 4) { m.set(i, 3, 31, B.HAZARD); m.set(i + 1, 3, 31, B.HAZARD); m.set(31, 3, i, B.HAZARD); m.set(31, 3, i + 1, B.HAZARD); }
    border(m, B.METAL, 5, B.CONCRETE, 8);
    // 창고 1
    const w1 = house(m, { x: 4, z: 4, w: 20, d: 14, h: 7, wall: B.METAL, corner: B.CONCRETE, floor: B.CONCRETE, roof: B.METAL, doors: ['s', 'e'], doorW: 4, doorH: 3, parapetB: B.HAZARD });
    m.fill(5, G + 3, 5, 22, G + 3, 8, B.GRATE);
    stairs(m, 7, G, 11, 0, -1, 3, 2, B.GRATE);
    roofStairs(m, w1, 'w', B.GRATE);
    m.fill(16, G, 12, 17, G + 1, 13, B.CRATE); m.fill(10, G, 14, 11, G, 15, B.CRATE); m.fill(19, G, 6, 21, G + 2, 6, B.CRATE);
    // 창고 2
    const w2 = house(m, { x: 40, z: 42, w: 20, d: 16, h: 7, wall: B.METAL, corner: B.CONCRETE, floor: B.CONCRETE, roof: B.METAL, doors: ['n', 'w'], doorW: 4, doorH: 3, parapetB: B.HAZARD });
    m.fill(41, G + 3, 53, 58, G + 3, 56, B.GRATE);
    stairs(m, 52, G, 49, 0, 1, 3, 2, B.GRATE);
    roofStairs(m, w2, 'e', B.GRATE);
    m.fill(44, G, 45, 45, G + 1, 46, B.CRATE); m.fill(54, G, 46, 55, G, 47, B.CRATE);
    // 사무동
    const of = house(m, { x: 42, z: 5, w: 15, d: 11, h: 5, wall: B.CONCRETE, corner: B.BRICK, floor: B.CONCRETE, roof: B.CONCRETE, doors: ['s', 'w'] });
    roofStairs(m, of, 'e', B.CONCRETE);
    m.fill(44, G, 7, 46, G, 7, B.DARKWOOD); m.fill(51, G, 11, 53, G, 11, B.DARKWOOD);
    const sh = house(m, { x: 5, z: 44, w: 12, d: 12, h: 4, wall: B.BRICK, corner: B.CONCRETE, floor: B.CONCRETE, roof: B.CONCRETE, doors: ['n', 'e'] });
    roofStairs(m, sh, 's', B.BRICK);
    // 컨테이너 야적장
    const cont = (x, z, alongX, b, y) => {
      y = y == null ? G : y;
      const x1 = alongX ? x + 6 : x + 2, z1 = alongX ? z + 2 : z + 6;
      m.fill(x, y, z, x1, y + 2, z1, b);
    };
    cont(22, 20, true, B.CRED); cont(22, 20, true, B.CBLUE, G + 3);
    cont(36, 22, false, B.CGREEN); cont(19, 38, false, B.CYELLOW);
    cont(34, 39, true, B.CBLUE); cont(10, 24, false, B.CRED); cont(50, 25, false, B.CGREEN); cont(50, 25, false, B.CYELLOW, G + 3);
    stairs(m, 50 - 1, G, 32 + 1, 0, 1, 0, 1, B.CRATE);
    stairs(m, 47, G, 26, 1, 0, 3, 2, B.CRATE); // 컨테이너 위로
    stairs(m, 25, G, 17, 0, 1, 3, 2, B.CRATE);
    // 가로등
    for (const [lx, lz] of [[27, 27], [36, 27], [27, 36], [36, 36]]) { m.fill(lx, G, lz, lx, G + 3, lz, B.METAL); m.set(lx, G + 4, lz, B.LAMP); }
    scatter(m, r, 18, 3, 3, 60, 60, (x, z) => crateStack(m, r, x, z, B.CRATE));
    return m;
  }

  /* ---------- 추가 맵 ---------- */
  function pineTree(m, x, z, r, y) {
    y = y == null ? G : y;
    const th = 6 + Math.floor(r() * 3);
    if (!m.free(x - 2, y, z - 2, x + 2, y + th + 1, z + 2)) return false;
    for (let dy = 2; dy <= th; dy++) {
      const rad = dy >= th - 1 ? 0 : dy >= th - 3 ? 1 : (dy % 2 ? 2 : 1);
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        m.set(x + dx, y + dy, z + dz, B.PINE);
      }
    }
    m.set(x, y + th + 1, z, B.SNOW);
    m.fill(x, y, z, x, y + th - 2, z, B.LOG);
    return true;
  }
  function bigTree(m, x, z, r) {
    const th = 8 + Math.floor(r() * 3);
    if (!m.free(x - 4, G, z - 4, x + 5, G + th + 2, z + 5)) return false;
    for (let dy = th - 3; dy <= th + 1; dy++) {
      const rad = dy === th + 1 ? 2 : dy === th - 3 ? 3 : 4;
      for (let dx = -rad; dx <= rad + 1; dx++) for (let dz = -rad; dz <= rad + 1; dz++) {
        const ex = Math.max(Math.abs(dx - 0.5) - rad + 0.5, 0), ez = Math.max(Math.abs(dz - 0.5) - rad + 0.5, 0);
        if (Math.hypot(dx - 0.5, dz - 0.5) > rad + 0.6 || ex + ez > 0.5 || r() < 0.08) continue;
        m.set(x + dx, G + dy, z + dz, B.LEAVES);
      }
    }
    m.fill(x, G, z, x + 1, G + th, z + 1, B.LOG);
    return true;
  }
  function mound(m, x, z, w, d, h, b) {
    if (!m.free(x - 1, G, z - 1, x + w, G + h, z + d)) return false;
    for (let i = 0; i < h; i++) m.fill(x + i, G + i, z + i, x + w - 1 - i, G + i, z + d - 1 - i, b);
    return true;
  }

  function buildSnow() {
    const m = new VMap(64, 26, 64), r = rng(51);
    ground(m, B.SNOW, B.DIRT);
    border(m, B.STONEBRICK, 3, B.DARKWOOD, 8);
    for (let i = 0; i < 64; i++) { m.set(i, G + 3, 0, B.SNOW); m.set(i, G + 3, 63, B.SNOW); m.set(0, G + 3, i, B.SNOW); m.set(63, G + 3, i, B.SNOW); }
    // 얼어붙은 호수
    for (let z = 34; z < 52; z++) for (let x = 30; x < 54; x++) if (((x - 42) / 11) ** 2 + ((z - 43) / 8) ** 2 < 1) m.set(x, 3, z, B.ICE);
    const H = [
      { x: 6, z: 6, w: 9, d: 8, h: 4, doors: ['s', 'e'], st: 'w' },
      { x: 48, z: 6, w: 10, d: 8, h: 4, doors: ['s', 'w'], st: 'e' },
      { x: 6, z: 48, w: 8, d: 9, h: 5, doors: ['n', 'e'], st: 'w' },
    ];
    for (const o of H) { const hs = house(m, Object.assign({ wall: B.DARKWOOD, corner: B.LOG, floor: B.PLANKS, roof: B.SNOW, parapetB: B.SNOW }, o)); roofStairs(m, hs, o.st, B.DARKWOOD); }
    // 벙커
    const bk = house(m, { x: 22, z: 18, w: 14, d: 12, h: 4, wall: B.STONEBRICK, corner: B.CONCRETE, floor: B.CONCRETE, roof: B.CONCRETE, doors: ['n', 's', 'w'], doorW: 3, parapetB: B.SNOW });
    roofStairs(m, bk, 'e', B.STONEBRICK);
    m.fill(25, G, 21, 26, G, 22, B.CRATE); m.fill(31, G, 25, 32, G + 1, 25, B.CRATE);
    // 감시탑
    m.fill(50, G, 24, 54, G + 4, 28, B.DARKWOOD); m.fill(51, G, 25, 53, G + 4, 27, 0); m.fill(50, G + 5, 24, 54, G + 5, 28, B.PLANKS);
    m.fill(52, G, 24, 52, G + 1, 24, 0);
    stairs(m, 50, G, 29, 1, 0, 5, 2, B.PLANKS);
    scatter(m, r, 26, 3, 3, 60, 60, (x, z) => pineTree(m, x, z, r));
    scatter(m, r, 14, 3, 3, 60, 60, (x, z) => mound(m, x, z, 2 + (r() * 3 | 0), 2 + (r() * 2 | 0), 2, B.SNOW));
    scatter(m, r, 10, 3, 3, 60, 60, (x, z) => crateStack(m, r, x, z, B.CRATE));
    return m;
  }

  function buildCastle() {
    const m = new VMap(64, 28, 64), r = rng(61);
    ground(m, B.GRASS, B.DIRT);
    border(m, B.LEAVES, 3, B.LOG, 7);
    const a = 9, b = 54, wh = 5;
    for (let i = a; i <= b; i++) for (const t of [0, 1]) {
      m.fill(i, G, a + t, i, G + wh - 1, a + t, B.STONEBRICK); m.fill(i, G, b - t, i, G + wh - 1, b - t, B.STONEBRICK);
      m.fill(a + t, G, i, a + t, G + wh - 1, i, B.STONEBRICK); m.fill(b - t, G, i, b - t, G + wh - 1, i, B.STONEBRICK);
    }
    for (let i = a; i <= b; i += 2) { m.set(i, G + wh, a, B.STONEBRICK); m.set(i, G + wh, b, B.STONEBRICK); m.set(a, G + wh, i, B.STONEBRICK); m.set(b, G + wh, i, B.STONEBRICK); }
    const c = 30;
    m.fill(c, G, a, c + 3, G + 2, a + 1, 0); m.fill(c, G, b - 1, c + 3, G + 2, b, 0); m.fill(a, G, c, a + 1, G + 2, c + 3, 0); m.fill(b - 1, G, c, b, G + 2, c + 3, 0);
    for (const [tx, tz] of [[a - 1, a - 1], [b - 3, a - 1], [a - 1, b - 3], [b - 3, b - 3]]) {
      m.fill(tx, G, tz, tx + 4, G + wh, tz + 4, B.STONE);
      for (let i = 0; i <= 4; i += 2) { m.set(tx + i, G + wh + 1, tz, B.STONE); m.set(tx + i, G + wh + 1, tz + 4, B.STONE); m.set(tx, G + wh + 1, tz + i, B.STONE); m.set(tx + 4, G + wh + 1, tz + i, B.STONE); }
    }
    // 성벽 계단 (안쪽)
    stairs(m, a + 6, G, a + 2, 1, 0, wh, 2, B.STONEBRICK);
    stairs(m, b - 6, G, b - 3, -1, 0, wh, 2, B.STONEBRICK);
    stairs(m, a + 2, G, b - 6, 0, -1, wh, 2, B.STONEBRICK);
    stairs(m, b - 3, G, a + 6, 0, 1, wh, 2, B.STONEBRICK);
    // 길
    m.fill(c, 3, 1, c + 3, 3, 62, B.PATH); m.fill(1, 3, c, 62, 3, c + 3, B.PATH);
    // 본성
    const kp = house(m, { x: 23, z: 22, w: 18, d: 18, h: 7, wall: B.STONEBRICK, corner: B.STONE, floor: B.STONEBRICK, roof: B.STONEBRICK, doors: ['n', 's'], doorW: 3, doorH: 3 });
    roofStairs(m, kp, 'w', B.STONEBRICK);
    for (const [px, pz] of [[23, 22], [40, 22], [23, 39], [40, 39]]) { m.fill(px, G + 8, pz, px, G + 10, pz, B.STONE); }
    for (const bx of [26, 37]) { m.fill(bx, G + 2, 39, bx, G + 6, 39, B.WOOL_R); m.fill(bx, G + 2, 22, bx, G + 6, 22, B.WOOL_R); }
    m.fill(31, G - 1, 23, 32, G - 1, 36, B.WOOL_R);
    m.fill(31, G, 36, 32, G, 37, B.GOLD); m.set(31, G + 1, 37, B.GOLD); m.set(32, G + 1, 37, B.GOLD);
    for (const [px, pz] of [[27, 27], [36, 27], [27, 33], [36, 33]]) m.fill(px, G, pz, px, G + 6, pz, B.STONE);
    // 시장 노점
    const stall = (x, z, col) => {
      if (!m.free(x, G, z, x + 3, G + 3, z + 2)) return;
      for (const [px, pz] of [[x, z], [x + 3, z], [x, z + 2], [x + 3, z + 2]]) m.fill(px, G, pz, px, G + 2, pz, B.LOG);
      m.fill(x, G + 3, z, x + 3, G + 3, z + 2, col); m.fill(x + 1, G, z, x + 2, G, z, B.PLANKS);
    };
    stall(14, 15, B.WOOL_R); stall(45, 15, B.WOOL_Y); stall(14, 45, B.WOOL_B); stall(45, 45, B.WOOL_W);
    m.fill(17, G, 24, 18, G + 1, 25, B.HAY); m.fill(45, G, 37, 46, G, 38, B.CRATE); m.fill(16, G, 38, 16, G + 1, 39, B.CRATE);
    scatter(m, r, 26, 2, 2, 61, 61, (x, z) => (x > a - 4 && x < b + 4 && z > a - 4 && z < b + 4) ? false : tree(m, x, z, r));
    scatter(m, r, 8, 12, 12, 51, 51, (x, z) => (x > 20 && x < 43 && z > 19 && z < 42) ? false : crateStack(m, r, x, z, r() < 0.5 ? B.CRATE : B.HAY));
    return m;
  }

  function buildJungle() {
    const m = new VMap(64, 28, 64), r = rng(71);
    ground(m, B.GRASS, B.DIRT);
    border(m, B.LEAVES, 4, B.LOG, 5);
    // 계단식 사원
    m.fill(22, G, 22, 41, G + 1, 41, B.MOSSY);
    m.fill(25, G + 2, 25, 38, G + 3, 38, B.COBBLE);
    m.fill(28, G + 4, 28, 35, G + 5, 35, B.MOSSY);
    m.fill(22, G, 30, 41, G + 1, 33, 0); // 동서 통로
    for (const zz of [[43, -1], [20, 1]]) {
      const [z0, d] = zz;
      stairs(m, 31, G, z0, 0, d, 2, 2, B.MOSSY);
      stairs(m, 31, G + 2, z0 + d * 3, 0, d, 2, 2, B.COBBLE);
      stairs(m, 31, G + 4, z0 + d * 6, 0, d, 2, 2, B.MOSSY);
    }
    for (const [px, pz] of [[29, 29], [34, 29], [29, 34], [34, 34]]) m.fill(px, G + 6, pz, px, G + 8, pz, B.MOSSY);
    m.fill(28, G + 9, 28, 35, G + 9, 35, B.GOLD); m.fill(30, G + 9, 30, 33, G + 9, 33, B.MOSSY);
    m.fill(31, G + 6, 31, 32, G + 6, 32, B.LAMP);
    // 유적 벽
    const ruin = (x, z, len, dirX) => { for (let i = 0; i < len; i++) { const hh = 1 + Math.floor(r() * 3), cx = dirX ? x + i : x, cz = dirX ? z : z + i; if (m.free(cx, G, cz, cx, G, cz)) m.fill(cx, G, cz, cx, G + hh - 1, cz, r() < 0.5 ? B.MOSSY : B.COBBLE); } };
    ruin(8, 12, 8, true); ruin(47, 50, 8, true); ruin(12, 44, 7, false); ruin(52, 10, 7, false);
    // 쓰러진 통나무
    m.fill(10, G, 30, 16, G, 30, B.LOG); m.fill(48, G, 34, 54, G, 34, B.LOG); m.fill(30, G, 52, 30, G, 57, B.LOG);
    scatter(m, r, 12, 3, 3, 58, 58, (x, z) => (x > 17 && x < 46 && z > 17 && z < 46) ? false : bigTree(m, x, z, r));
    scatter(m, r, 18, 3, 3, 60, 60, (x, z) => (x > 19 && x < 44 && z > 19 && z < 44) ? false : tree(m, x, z, r));
    scatter(m, r, 30, 3, 3, 60, 60, (x, z) => { if (!m.free(x, G, z, x, G, z) || !m.solid(x, G - 1, z)) return false; m.set(x, G, z, B.LEAVES); if (r() < 0.4) m.set(x + 1, G, z, B.LEAVES); return true; });
    return m;
  }

  function buildCity() {
    const m = new VMap(64, 34, 64), r = rng(81);
    ground(m, B.CONCRETE, B.STONE);
    m.fill(1, 3, 27, 62, 3, 36, B.ASPHALT); m.fill(27, 3, 1, 36, 3, 62, B.ASPHALT);
    for (let i = 2; i < 62; i += 4) { m.set(i, 3, 31, B.WOOL_W); m.set(i + 1, 3, 31, B.WOOL_W); m.set(31, 3, i, B.WOOL_W); m.set(31, 3, i + 1, B.WOOL_W); }
    for (let i = 27; i <= 36; i += 2) { m.set(i, 3, 25, B.WOOL_W); m.set(i, 3, 38, B.WOOL_W); m.set(25, 3, i, B.WOOL_W); m.set(38, 3, i, B.WOOL_W); }
    border(m, B.CONCRETE, 4, B.BRICK, 9);
    // 고층 빌딩
    const tw = house(m, { x: 5, z: 5, w: 14, d: 14, h: 12, wall: B.WINDOW, corner: B.CONCRETE, floor: B.CONCRETE, roof: B.CONCRETE, doors: ['s', 'e'], doorW: 2 });
    roofStairs(m, tw, 'w', B.CONCRETE);
    m.fill(6, G + 6, 6, 17, G + 6, 17, B.CONCRETE); m.fill(8, G + 6, 10, 9, G + 6, 15, 0); // 중간층 (계단 구멍)
    stairs(m, 8, G, 15, 0, -1, 6, 2, B.CONCRETE);
    const b2 = house(m, { x: 42, z: 5, w: 10, d: 9, h: 7, wall: B.BRICK, corner: B.CONCRETE, floor: B.PLANKS, roof: B.CONCRETE, doors: ['s', 'w'] });
    roofStairs(m, b2, 'e', B.BRICK);
    const b3 = house(m, { x: 54, z: 5, w: 7, d: 14, h: 9, wall: B.WINDOW, corner: B.PLASTER, floor: B.CONCRETE, roof: B.CONCRETE, doors: ['w'] });
    roofStairs(m, b3, 's', B.PLASTER);
    // 상가
    const sh = house(m, { x: 41, z: 41, w: 18, d: 9, h: 5, wall: B.PLASTER, corner: B.BRICK, floor: B.CONCRETE, roof: B.CONCRETE, doors: ['n', 's'], doorW: 3 });
    roofStairs(m, sh, 'e', B.BRICK);
    m.fill(42, G + 4, 40, 57, G + 4, 40, B.WOOL_R);
    // 공원
    m.fill(4, 3, 40, 23, 3, 59, B.GRASS);
    m.fill(11, G, 47, 16, G, 52, B.STONE); m.fill(12, G, 48, 15, G, 51, 0); m.fill(13, G, 49, 14, G + 2, 50, B.STONE); m.set(13, G + 3, 49, B.LAMP);
    for (const [tx, tz] of [[6, 43], [20, 43], [6, 56], [20, 56], [8, 50]]) tree(m, tx, tz, r);
    m.fill(9, G, 42, 11, G, 42, B.DARKWOOD); m.fill(16, G, 57, 18, G, 57, B.DARKWOOD);
    // 자동차
    const car = (x, z, alongX, col) => {
      const x1 = alongX ? x + 3 : x + 1, z1 = alongX ? z + 1 : z + 3;
      if (!m.free(x, G, z, x1, G + 1, z1)) return;
      m.fill(x, G, z, x1, G, z1, col);
      if (alongX) m.fill(x + 1, G + 1, z, x + 2, G + 1, z1, B.WINDOW); else m.fill(x, G + 1, z + 1, x1, G + 1, z + 2, B.WINDOW);
    };
    car(5, 29, true, B.WOOL_R); car(14, 33, true, B.WOOL_B); car(45, 28, true, B.WOOL_Y); car(52, 33, true, B.WOOL_W);
    car(29, 6, false, B.WOOL_B); car(33, 16, false, B.WOOL_R); car(29, 46, false, B.WOOL_W); car(33, 55, false, B.WOOL_Y);
    car(43, 52, true, B.WOOL_R); car(49, 52, true, B.WOOL_B); car(43, 56, true, B.WOOL_W);
    // 가로등
    for (const [lx, lz] of [[25, 25], [38, 25], [25, 38], [38, 38], [12, 25], [50, 38]]) { m.fill(lx, G, lz, lx, G + 3, lz, B.METAL); m.set(lx, G + 4, lz, B.LAMP); }
    // 버스 정류장
    m.fill(20, G, 24, 20, G + 2, 24, B.METAL); m.fill(23, G, 24, 23, G + 2, 24, B.METAL); m.fill(20, G + 3, 23, 23, G + 3, 25, B.WINDOW);
    scatter(m, r, 10, 3, 3, 60, 60, (x, z) => crateStack(m, r, x, z, B.CRATE));
    return m;
  }

  function buildQuarry() {
    const m = new VMap(64, 26, 64), r = rng(91);
    ground(m, B.PATH, B.STONE);
    border(m, B.STONE, 8);
    // 계단식 절벽 (가장자리일수록 높음)
    for (let z = 1; z < 63; z++) for (let x = 1; x < 63; x++) {
      const e = Math.min(x, z, 63 - x, 63 - z);
      const h = Math.max(0, 7 - Math.floor((e - 1) / 2));
      if (h > 0) for (let y = G; y < G + h; y++) {
        const v = r();
        m.set(x, y, z, v < 0.03 ? B.ORE_GOLD : v < 0.08 ? B.ORE_COAL : v < 0.095 ? B.ORE_DIA : (y === G + h - 1 && r() < 0.3 ? B.COBBLE : B.STONE));
      }
    }
    // 비계 탑
    const scaff = (x, z, h) => {
      for (const [px, pz] of [[x, z], [x + 3, z], [x, z + 3], [x + 3, z + 3]]) m.fill(px, G, pz, px, G + h - 1, pz, B.LOG);
      m.fill(x, G + h, z, x + 3, G + h, z + 3, B.PLANKS);
      stairs(m, x + 4, G, z, 0, 1, h, 2, B.PLANKS);
    };
    scaff(20, 22, 4); scaff(38, 36, 4);
    // 광차 / 돌무더기 / 크레인
    m.fill(28, G, 40, 30, G, 41, B.CRED); m.fill(34, G, 22, 36, G, 23, B.CRED);
    m.fill(31, G, 31, 32, G + 8, 32, B.METAL); m.fill(25, G + 9, 31, 38, G + 9, 32, B.HAZARD); m.fill(26, G + 6, 31, 26, G + 8, 31, B.METAL);
    scatter(m, r, 18, 14, 14, 49, 49, (x, z) => mound(m, x, z, 2 + (r() * 2 | 0), 2 + (r() * 2 | 0), 1 + (r() * 2 | 0), r() < 0.5 ? B.COBBLE : B.STONE));
    scatter(m, r, 8, 14, 14, 49, 49, (x, z) => crateStack(m, r, x, z, B.CRATE));
    return m;
  }

  function buildMoon() {
    const m = new VMap(64, 26, 64), r = rng(101);
    ground(m, B.REGOLITH, B.MOONROCK);
    border(m, B.MOONROCK, 4);
    // 크레이터
    for (const [cx, cz, R] of [[16, 46, 6], [46, 14, 5], [48, 48, 4], [14, 14, 4], [32, 52, 3]]) {
      for (let z = cz - R - 2; z <= cz + R + 2; z++) for (let x = cx - R - 2; x <= cx + R + 2; x++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d < R - 1) m.set(x, 3, z, 0);
        else if (d <= R + 0.6 && m.free(x, G, z, x, G, z)) m.set(x, G, z, B.REGOLITH);
      }
    }
    // 돔 기지
    const dome = (cx, cz, R) => {
      for (let y = G; y <= G + R; y++) for (let z = cz - R; z <= cz + R; z++) for (let x = cx - R; x <= cx + R; x++) {
        const d = Math.hypot(x - cx, (y - G) * 1.15, z - cz);
        if (d <= R && d > R - 1.2) m.set(x, y, z, y === G + 2 ? B.WINDOW : B.PANEL);
        else if (d <= R - 1.2) m.set(x, y, z, 0);
      }
      m.fill(cx - R, 3, cz - R, cx + R, 3, cz + R, B.PANEL);
      m.fill(cx - 1, G, cz - R - 1, cx + 1, G + 2, cz + R + 1, 0);
      m.fill(cx - R - 1, G, cz - 1, cx + R + 1, G + 2, cz + 1, 0);
      m.fill(cx, G, cz, cx, G + 1, cz, B.GLOWC);
    };
    dome(22, 26, 7); dome(43, 38, 6);
    // 연결 통로
    house(m, { x: 28, z: 44, w: 9, d: 6, h: 3, wall: B.PANEL, corner: B.METAL, floor: B.PANEL, roof: B.PANEL, doors: ['n', 'e'], parapet: false });
    // 착륙장 + 착륙선
    m.fill(44, 3, 6, 56, 3, 18, B.CONCRETE);
    for (let i = 44; i <= 56; i++) { m.set(i, 3, 6, B.HAZARD); m.set(i, 3, 18, B.HAZARD); m.set(44, 3, i - 38, B.HAZARD); m.set(56, 3, i - 38, B.HAZARD); }
    m.fill(48, G + 2, 10, 52, G + 4, 14, B.PANEL); m.fill(49, G + 5, 11, 51, G + 5, 13, B.GOLD);
    for (const [lx, lz] of [[48, 10], [52, 10], [48, 14], [52, 14]]) m.fill(lx, G, lz, lx, G + 1, lz, B.METAL);
    // 안테나
    m.fill(10, G, 30, 10, G + 7, 30, B.METAL); m.fill(8, G + 8, 28, 12, G + 8, 32, B.PANEL); m.set(10, G + 9, 30, B.GLOWC);
    scatter(m, r, 22, 3, 3, 60, 60, (x, z) => mound(m, x, z, 1 + (r() * 3 | 0), 1 + (r() * 3 | 0), 1 + (r() * 2 | 0), B.MOONROCK));
    scatter(m, r, 6, 3, 3, 60, 60, (x, z) => crateStack(m, r, x, z, B.PANEL));
    return m;
  }

  function buildArena() {
    const m = new VMap(48, 22, 48), r = rng(111);
    ground(m, B.CONCRETE, B.STONE);
    for (let z = 1; z < 47; z++) for (let x = 1; x < 47; x++) if ((x + z) % 2 === 0) m.set(x, 3, z, B.WOOL_W);
    m.fill(1, 3, 1, 8, 3, 46, B.WOOL_R); m.fill(39, 3, 1, 46, 3, 46, B.WOOL_B);
    border(m, B.METAL, 5);
    for (let i = 0; i < 48; i++) { m.set(i, G + 4, 0, B.GLOWC); m.set(i, G + 4, 47, B.GLOWC); m.set(0, G + 4, i, B.GLOWC); m.set(47, G + 4, i, B.GLOWC); }
    // 좌우 대칭으로 배치
    const both = (x0, y0, z0, x1, y1, z1, bl, bl2) => { m.fill(x0, y0, z0, x1, y1, z1, bl); m.fill(47 - x1, y0, z0, 47 - x0, y1, z1, bl2 == null ? bl : bl2); };
    both(11, G, 10, 12, G + 3, 11, B.WOOL_R, B.WOOL_B); both(11, G, 36, 12, G + 3, 37, B.WOOL_R, B.WOOL_B);
    both(12, G + 4, 10, 12, G + 4, 10, B.GLOWC); both(12, G + 4, 37, 12, G + 4, 37, B.GLOWC);
    both(16, G, 20, 16, G + 1, 27, B.METAL); both(6, G, 22, 7, G, 25, B.CRATE);
    both(18, G, 6, 21, G + 1, 6, B.METAL); both(18, G, 41, 21, G + 1, 41, B.METAL);
    // 가운데 단상
    m.fill(20, G, 20, 27, G + 1, 27, B.METAL);
    stairs(m, 23, G, 29, 0, -1, 2, 2, B.GRATE); stairs(m, 23, G, 18, 0, 1, 2, 2, B.GRATE);
    stairs(m, 29, G, 23, -1, 0, 2, 2, B.GRATE); stairs(m, 18, G, 23, 1, 0, 2, 2, B.GRATE);
    m.fill(23, G + 2, 23, 24, G + 4, 24, B.GLOWC);
    // 공중 다리
    both(4, G + 3, 14, 15, G + 3, 15, B.GRATE); both(4, G + 3, 32, 15, G + 3, 33, B.GRATE);
    stairs(m, 4, G, 18, 0, -1, 4, 2, B.GRATE); stairs(m, 42, G, 18, 0, -1, 4, 2, B.GRATE);
    stairs(m, 4, G, 29, 0, 1, 4, 2, B.GRATE); stairs(m, 42, G, 29, 0, 1, 4, 2, B.GRATE);
    void r;
    return m;
  }

  /* ---------- 스파이크 / 연습장 전용 맵 ---------- */
  function cellsIn(m, rc) {
    const out = [];
    for (let z = rc[1]; z <= rc[3]; z++) for (let x = rc[0]; x <= rc[2]; x++) {
      if (walkable(m, x, G, z) && !bodyHits(m, x + 0.5, G, z + 0.5, P.H) && !m.solid(x, G + 2, z)) out.push([x + 0.5, G, z + 0.5]);
    }
    return out;
  }
  function buildOasis() {
    const m = new VMap(64, 26, 64), r = rng(121);
    ground(m, B.SAND, B.SAND);
    border(m, B.SANDSTONE, 5, B.CHISEL, 8);
    const wall = (x0, z0, x1, z1, h, b) => m.fill(x0, G, z0, x1, G + (h || 4) - 1, z1, b || B.SANDSTONE);
    const door = (x0, z0, x1, z1) => m.fill(x0, G, z0, x1, G + 2, z1, 0);
    // 공격 진영 앞 벽 (문 3개)
    wall(1, 44, 62, 45); door(8, 44, 11, 45); door(30, 44, 33, 45); door(52, 44, 55, 45);
    // 레인 구분벽
    wall(21, 30, 22, 43); wall(41, 30, 42, 43);
    // 사이트와 가운데 광장 사이 벽 (문 1개씩)
    wall(21, 12, 22, 29); wall(41, 12, 42, 29); door(21, 18, 22, 20); door(41, 18, 42, 20);
    // 레인 → 사이트 벽
    wall(1, 29, 20, 29); wall(43, 29, 62, 29); door(8, 29, 11, 29); door(52, 29, 55, 29);
    // 수비 진영 앞 벽
    wall(1, 11, 62, 11); door(10, 11, 13, 11); door(30, 11, 33, 11); door(50, 11, 53, 11);
    // 사이트 바닥 / 엄폐물
    m.fill(3, 3, 13, 19, 3, 27, B.CHISEL); m.fill(44, 3, 13, 60, 3, 27, B.CHISEL);
    for (const [x, z] of [[6, 16], [14, 22], [17, 14], [5, 24]]) { m.fill(x, G, z, x + 1, G + 1, z + 1, B.CRATE); }
    for (const [x, z] of [[56, 16], [48, 22], [45, 14], [57, 24]]) { m.fill(x, G, z, x + 1, G + 1, z + 1, B.CRATE); }
    m.fill(11, G, 18, 13, G + 1, 20, B.SANDSTONE); stairs(m, 11, G, 21, 0, -1, 1, 3, B.SANDSTONE);
    m.fill(50, G, 18, 52, G + 1, 20, B.SANDSTONE); stairs(m, 50, G, 21, 0, -1, 1, 3, B.SANDSTONE);
    // 가운데 오아시스
    for (let z = 14; z <= 27; z++) for (let x = 24; x <= 39; x++) if (((x - 31.5) / 5.5) ** 2 + ((z - 20.5) / 4.2) ** 2 < 1) m.set(x, 3, z, B.WOOL_B);
    for (const [x, z] of [[25, 14], [38, 26], [25, 27]]) tree(m, x, z, r);
    // 레인 엄폐물
    for (const [x, z] of [[5, 35], [15, 39], [10, 32], [27, 34], [35, 38], [31, 31], [48, 35], [58, 39], [53, 32]]) m.fill(x, G, z, x + 1, G + (r() < 0.5 ? 1 : 0), z, r() < 0.5 ? B.CRATE : B.SANDSTONE);
    for (const [x, z] of [[18, 5], [44, 5], [18, 50], [44, 50]]) m.fill(x, G, z, x, G + 3, z, B.CHISEL);
    return m;
  }
  function buildLab() {
    const m = new VMap(64, 26, 64), r = rng(131);
    ground(m, B.CONCRETE, B.STONE);
    border(m, B.METAL, 6, B.CONCRETE, 8);
    house(m, { x: 38, z: 3, w: 18, d: 14, h: 5, wall: B.PANEL, corner: B.METAL, floor: B.GRATE, roof: B.METAL, doors: ['s', 'w'], doorW: 4, doorH: 3, win: false });
    house(m, { x: 38, z: 47, w: 18, d: 14, h: 5, wall: B.PANEL, corner: B.METAL, floor: B.GRATE, roof: B.METAL, doors: ['n', 'w'], doorW: 4, doorH: 3, win: false });
    m.fill(55, G, 8, 55, G + 2, 11, 0); m.fill(55, G, 52, 55, G + 2, 55, 0);
    for (const [x, z] of [[41, 6], [50, 12], [44, 11], [52, 5]]) m.fill(x, G, z, x + 1, G + 1, z + 1, B.CRATE);
    for (const [x, z] of [[41, 56], [50, 50], [44, 51], [52, 57]]) m.fill(x, G, z, x + 1, G + 1, z + 1, B.CRATE);
    m.fill(46, G, 7, 47, G, 8, B.GLOWC); m.fill(46, G, 55, 47, G, 56, B.GLOWC);
    // 중앙 연구동
    house(m, { x: 20, z: 23, w: 18, d: 18, h: 5, wall: B.CONCRETE, corner: B.PANEL, floor: B.PANEL, roof: B.CONCRETE, doors: ['n', 's', 'w', 'e'], doorW: 3 });
    m.fill(24, G, 27, 26, G, 28, B.GLOWC); m.fill(31, G, 35, 33, G, 36, B.GLOWC); m.fill(31, G, 27, 32, G + 1, 27, B.CRATE); m.fill(25, G, 35, 25, G + 1, 36, B.CRATE);
    // 레인 구분벽
    m.fill(12, G, 20, 36, G + 3, 20, B.CONCRETE); m.fill(24, G, 20, 26, G + 2, 20, 0);
    m.fill(12, G, 43, 36, G + 3, 43, B.CONCRETE); m.fill(30, G, 43, 32, G + 2, 43, 0);
    // 컨테이너 / 상자
    const cont = (x, z, alongX, b) => { const x1 = alongX ? x + 5 : x + 2, z1 = alongX ? z + 2 : z + 5; m.fill(x, G, z, x1, G + 2, z1, b); };
    cont(16, 8, true, B.CRED); cont(26, 13, true, B.CBLUE); cont(16, 51, true, B.CGREEN); cont(27, 55, true, B.CYELLOW);
    cont(44, 25, false, B.CBLUE); cont(48, 33, false, B.CRED);
    for (const [x, z] of [[12, 15], [33, 6], [12, 49], [34, 58], [42, 21], [42, 41], [14, 30], [14, 36]]) m.fill(x, G, z, x + 1, G + (r() < 0.5 ? 1 : 0), z, B.CRATE);
    for (const [lx, lz] of [[10, 24], [10, 39], [52, 22], [52, 42]]) { m.fill(lx, G, lz, lx, G + 3, lz, B.METAL); m.set(lx, G + 4, lz, B.LAMP); }
    return m;
  }
  function buildRange() {
    const m = new VMap(64, 24, 56), r = rng(141);
    ground(m, B.CONCRETE, B.STONE);
    border(m, B.CONCRETE, 6, B.METAL, 7);
    m.fill(1, G, 1, 41, G + 5, 1, B.WOOL_W);
    m.fill(3, G, 40, 40, G, 40, B.DARKWOOD);
    for (const x of [12, 22, 32]) m.fill(x, G, 4, x, G + 2, 39, B.CONCRETE);
    for (const z of [30, 20, 7]) m.fill(3, 3, z, 40, 3, z, B.HAZARD);
    m.fill(42, G, 1, 42, G + 3, 33, B.CONCRETE);
    for (const [x, z] of [[47, 8], [55, 12], [50, 20], [57, 27], [46, 30], [53, 34]]) m.fill(x, G, z, x + 1, G + 1, z, B.CRATE);
    // 파쿠르 코스
    for (let i = 0; i < 6; i++) m.fill(45 + i * 2, G, 44 + (i % 2) * 3, 45 + i * 2, G + i, 45 + (i % 2) * 3, B.GLOWC);
    m.fill(57, G, 50, 60, G + 5, 53, B.METAL); m.set(58, G + 6, 51, B.GOLD);
    void r;
    return m;
  }

  const MAPS = {
    village: { name: '블록 마을', build: buildVillage, sky: [0x8ec9ff, 0xd6efff], fog: 0xbfe2ff, sun: 1.0 },
    desert: { name: '사막 유적', build: buildDesert, sky: [0xf2b56b, 0xffe6b0], fog: 0xf6d7a3, sun: 1.1 },
    factory: { name: '공장 지대', build: buildFactory, sky: [0x6e8fb3, 0xc4d3e2], fog: 0xaebdcc, sun: 0.9 },
    snow: { name: '설원 기지', build: buildSnow, sky: [0x9fb8d0, 0xe8f0f8], fog: 0xdde7f0, sun: 0.9, snow: true, fogNear: 30, fogFar: 110 },
    castle: { name: '성채', build: buildCastle, sky: [0x7fb4f0, 0xd8ecff], fog: 0xc6e0fa, sun: 1 },
    jungle: { name: '정글 사원', build: buildJungle, sky: [0x7fc08a, 0xd8f0c8], fog: 0xa8d0a0, sun: 0.95, fogNear: 28, fogFar: 105 },
    city: { name: '도심', build: buildCity, sky: [0x8aa8d0, 0xf0d8c0], fog: 0xd8d0c8, sun: 1 },
    quarry: { name: '채석장', build: buildQuarry, sky: [0xa8c0d8, 0xf0e0c8], fog: 0xe0d8c8, sun: 1 },
    moon: { name: '달 기지', build: buildMoon, sky: [0x020308, 0x10131c], fog: 0x0a0c14, sun: 1.2, grav: 0.5, stars: true, noClouds: true, fogNear: 60, fogFar: 190, desc: '중력 절반!' },
    oasis: { name: '오아시스', kind: 'spike', build: buildOasis, sky: [0xf2b56b, 0xffe6b0], fog: 0xf6d7a3, sun: 1.1, desc: '스파이크 전용',
      spike: { atk: [24, 51, 39, 60], def: [24, 2, 39, 9], A: [3, 13, 19, 27], B: [44, 13, 60, 27] } },
    lab: { name: '연구소', kind: 'spike', build: buildLab, sky: [0x6e8fb3, 0xc4d3e2], fog: 0xaebdcc, sun: 0.9, desc: '스파이크 전용',
      spike: { atk: [3, 26, 9, 37], def: [57, 24, 61, 39], A: [39, 4, 54, 15], B: [39, 48, 54, 59] } },
    range: { name: '사격 연습장', kind: 'practice', build: buildRange, sky: [0x8ec9ff, 0xd6efff], fog: 0xbfe2ff, sun: 1, fogFar: 200,
      range: { spawn: [4, 43, 40, 53], dummy: [44, 4, 61, 38], targets: [[7, 30], [17, 30], [27, 30], [36.5, 30], [7, 20], [17, 20], [27, 20], [36.5, 20], [7, 7], [17, 7], [27, 7], [36.5, 7]] } },
    arena: { name: '픽셀 아레나', build: buildArena, sky: [0x2a1a4a, 0x8a5ac0], fog: 0x5a3a8a, sun: 1, stars: true, noClouds: true, fogNear: 50, fogFar: 150 },
  };
  const mapCache = {};
  function getMap(id) {
    if (!MAPS[id]) id = 'village';
    if (!mapCache[id]) {
      const m = MAPS[id].build(); m.id = id; m.grav = MAPS[id].grav || 1; m.spawns = computeSpawns(m, id);
      // 팀 기지 (깃발 위치): 서쪽 = 레드, 동쪽 = 블루, 가운데 줄에 가까운 열린 자리
      const cz = m.D / 2, sc = (s, t) => (t ? m.W - s[0] : s[0]) + Math.abs(s[2] - cz) * 0.6;
      m.bases = [0, 1].map(t => m.spawns.slice().sort((a, b) => sc(a, t) - sc(b, t))[0]);
      m.teamSpawns = [0, 1].map(t => {
        let l = m.spawns.filter(s => t ? s[0] > m.W * 0.55 : s[0] < m.W * 0.45);
        if (l.length < 3) l = m.spawns.filter(s => t ? s[0] >= m.W / 2 : s[0] < m.W / 2);
        return l;
      });
      // 상점 자판기: 가운데 1개 + 서로 먼 곳 2개
      const cx = m.W / 2, cz2 = m.D / 2, ds = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
      const sp = m.spawns.slice().sort((a, b) => Math.hypot(a[0] - cx, a[2] - cz2) - Math.hypot(b[0] - cx, b[2] - cz2));
      const shops = [sp[0]];
      while (shops.length < 3) {
        let best = null, bd = -1;
        for (const c of m.spawns) { const d = Math.min(...shops.map(o => ds(o, c)), ...m.bases.map(o => ds(o, c) * 1.6)); if (d > bd) { bd = d; best = c; } }
        shops.push(best);
      }
      // 스폰 칸 옆(+1)에 세워서 스폰 지점을 막지 않게
      m.shops = []; void shops; // 자판기는 없앰
      m.pickups = computePickups(m, id);
      const def = MAPS[id];
      if (def.spike) {
        const sp = def.spike;
        m.spike = { atk: cellsIn(m, sp.atk), def: cellsIn(m, sp.def), sites: {} };
        for (const k of ['A', 'B']) { const rc = sp[k], cx = (rc[0] + rc[2]) / 2 + 0.5, cz = (rc[1] + rc[3]) / 2 + 0.5; const cells = cellsIn(m, rc).sort((p, q) => Math.hypot(p[0] - cx, p[2] - cz) - Math.hypot(q[0] - cx, q[2] - cz)); m.spike.sites[k] = { rect: rc, c: cells[0] || [cx, G, cz] }; }
        m.shops = [];
      }
      if (def.range) m.range = { spawn: cellsIn(m, def.range.spawn), dummy: cellsIn(m, def.range.dummy), targets: def.range.targets };
      mapCache[id] = m;
    }
    return mapCache[id];
  }

  /* ---------- 커스텀 맵 (맵 에디터) ---------- */
  function toB64(u8) {
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
    let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return btoa(s);
  }
  function fromB64(str) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u;
  }
  // RLE: [값, 개수(2바이트)] 반복
  function encodeMap(m) {
    const out = []; const d = m.d;
    for (let i = 0; i < d.length;) { const v = d[i]; let n = 1; while (i + n < d.length && d[i + n] === v && n < 65535) n++; out.push(v, n & 255, n >> 8); i += n; }
    return { W: m.W, H: m.H, D: m.D, data: toB64(new Uint8Array(out)) };
  }
  const MAXB = 47;
  function mapFromData(o) {
    const W = o.W | 0, H = o.H | 0, D = o.D | 0;
    if (W < 16 || D < 16 || W > 96 || D > 96 || H < 12 || H > 32 || typeof o.data !== 'string' || o.data.length > 400000) return null;
    const m = new VMap(W, H, D), raw = fromB64(o.data);
    let p = 0;
    for (let i = 0; i + 2 < raw.length && p < m.d.length; i += 3) { const v = raw[i] <= MAXB ? raw[i] : 0, n = raw[i + 1] | (raw[i + 2] << 8); m.d.fill(v, p, Math.min(m.d.length, p + n)); p += n; }
    m.id = 'custom'; m.grav = 1; m.theme = MAPS[o.theme] && (MAPS[o.theme].kind || 'normal') === 'normal' ? o.theme : 'village';
    m.spawns = computeSpawns(m, 'custom' + W + D);
    if (m.spawns.length < 2) return m; // 호출한 쪽에서 스폰 부족 처리
    const cz = m.D / 2, sc = (s, t) => (t ? m.W - s[0] : s[0]) + Math.abs(s[2] - cz) * 0.6;
    m.bases = [0, 1].map(t => m.spawns.slice().sort((a, b) => sc(a, t) - sc(b, t))[0]);
    m.teamSpawns = [0, 1].map(t => { let l = m.spawns.filter(s => t ? s[0] > m.W * 0.55 : s[0] < m.W * 0.45); if (l.length < 2) l = m.spawns.filter(s => t ? s[0] >= m.W / 2 : s[0] < m.W / 2); if (!l.length) l = m.spawns; return l; });
    m.shops = []; m.pickups = computePickups(m, 'custom');
    return m;
  }
  function blankMap(W, D, theme) {
    const m = new VMap(W || 64, 26, D || 64);
    if (theme === 'desert') { ground(m, B.SAND, B.SAND); border(m, B.SANDSTONE, 3, B.CHISEL, 8); }
    else if (theme === 'snow') { ground(m, B.SNOW, B.DIRT); border(m, B.STONEBRICK, 3, B.DARKWOOD, 8); }
    else if (theme === 'moon') { ground(m, B.REGOLITH, B.MOONROCK); border(m, B.MOONROCK, 3); }
    else if (theme === 'factory') { ground(m, B.CONCRETE, B.STONE); border(m, B.METAL, 4, B.CONCRETE, 8); }
    else { ground(m, B.GRASS, B.DIRT); border(m, B.COBBLE, 3, B.LOG, 6); }
    return m;
  }

  function walkable(m, x, y, z) { return m.solid(x, y - 1, z) && !m.solid(x, y, z) && !m.solid(x, y + 1, z); }
  function openSky(m, x, y, z) { for (let yy = y; yy < m.H; yy++) if (m.solid(x, yy, z)) return false; return true; }

  // 힐팩 / 갑옷 상자 고정 위치 (스폰 근처는 피하고 서로 멀리)
  const PICKUP = { hpS: { heal: 50, respawn: 10000 }, hpL: { heal: 999, respawn: 20000 }, armor: { armor: 50, respawn: 25000 } };
  function computePickups(m, id) {
    const c = [];
    for (let z = 3; z < m.D - 3; z++) for (let x = 3; x < m.W - 3; x++) {
      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1 && ok; dx++) if (!walkable(m, x + dx, G, z + dz) || m.solid(x + dx, G + 2, z + dz)) ok = false;
      if (!ok) continue;
      if (m.spawns.some(s => Math.hypot(s[0] - x - 0.5, s[2] - z - 0.5) < 5)) continue;
      c.push([x + 0.5, G, z + 0.5]);
    }
    if (!c.length) return [];
    const r = rng(id.length * 131 + 17), out = [];
    // 첫 점은 맵 가운데에 가장 가까운 곳
    c.sort((a, b) => Math.hypot(a[0] - m.W / 2, a[2] - m.D / 2) - Math.hypot(b[0] - m.W / 2, b[2] - m.D / 2));
    out.push(c[Math.floor(r() * Math.min(5, c.length))]);
    while (out.length < 9 && out.length < c.length) {
      let best = null, bd = -1;
      for (let i = 0; i < c.length; i += 2) { let md = 1e9; for (const o of out) md = Math.min(md, Math.hypot(o[0] - c[i][0], o[2] - c[i][2])); if (md > bd) { bd = md; best = c[i]; } }
      out.push(best);
    }
    const kinds = ['hpL', 'armor', 'hpS', 'hpS', 'armor', 'hpL', 'hpS', 'hpS', 'armor'];
    return out.map((p, i) => ({ id: 'k' + i, kind: kinds[i], x: p[0], y: p[1], z: p[2] }));
  }

  function computeSpawns(m, id) {
    const c = [];
    for (let z = 3; z < m.D - 3; z++) for (let x = 3; x < m.W - 3; x++) {
      const y = G;
      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1 && ok; dx++) if (!walkable(m, x + dx, y, z + dz) || m.solid(x + dx, y + 2, z + dz)) ok = false;
      if (ok && openSky(m, x, y, z)) c.push([x + 0.5, y, z + 0.5]);
    }
    const r = rng(id.length * 97 + 5), out = [];
    if (!c.length) return [[m.W / 2, G + 2, m.D / 2]];
    out.push(c[Math.floor(r() * c.length)]);
    while (out.length < 18 && out.length < c.length) {
      let best = null, bd = -1;
      for (let i = 0; i < c.length; i += 3) {
        let md = 1e9;
        for (const o of out) { const d = (o[0] - c[i][0]) ** 2 + (o[2] - c[i][2]) ** 2; if (d < md) md = d; }
        if (md > bd) { bd = md; best = c[i]; }
      }
      out.push(best);
    }
    return out;
  }

  /* ================= 물리 ================= */
  const P = {
    HW: 0.3, H: 1.8, HC: 1.3, EYE: 1.62, EYEC: 1.16,
    GRAV: 25, JUMP: 8.2, JUMP2: 7.6, WALK: 5.4, RUN: 7.6, CROUCH: 2.8, SLIDE: 11.5,
  };
  function hitsBox(m, x0, y0, z0, x1, y1, z1) {
    const ax = Math.floor(x0), bx = Math.floor(x1), ay = Math.floor(y0), by = Math.floor(y1), az = Math.floor(z0), bz = Math.floor(z1);
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) if (m.solid(x, y, z)) return true;
    return false;
  }
  function bodyHits(m, x, y, z, h) { return hitsBox(m, x - P.HW, y, z - P.HW, x + P.HW, y + h - 0.001, z + P.HW); }

  // b: {x,y,z,vx,vy,vz,h,ground}  → 1블록 자동 오르기 (b.stepDy 누적)
  function moveBody(m, b, dt) {
    const wasGround = b.ground;
    b.ground = false;
    const sp = Math.max(Math.abs(b.vx), Math.abs(b.vy), Math.abs(b.vz)) * dt;
    const steps = Math.max(1, Math.ceil(sp / 0.3)), sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      let ny = b.y + b.vy * sdt;
      if (bodyHits(m, b.x, ny, b.z, b.h)) {
        if (b.vy < 0) { ny = Math.floor(ny) + 1; b.ground = true; }
        else ny = Math.floor(ny + b.h) - b.h - 0.001;
        if (bodyHits(m, b.x, ny, b.z, b.h)) ny = b.y;
        b.vy = 0;
      }
      b.y = ny;
      const g = wasGround || b.ground;
      moveH(m, b, b.vx * sdt, 0, g);
      moveH(m, b, 0, b.vz * sdt, g);
    }
  }
  function moveH(m, b, dx, dz, g) {
    if (!dx && !dz) return;
    const nx = b.x + dx, nz = b.z + dz;
    if (!bodyHits(m, nx, b.y, nz, b.h)) { b.x = nx; b.z = nz; return; }
    if (g && b.vy <= 0.01) {
      const ty = Math.floor(b.y + 0.001) + 1;
      if (ty - b.y <= 1.01 && !bodyHits(m, b.x, ty, b.z, b.h) && !bodyHits(m, nx, ty, nz, b.h)) {
        b.stepDy = (b.stepDy || 0) + (ty - b.y); b.y = ty; b.x = nx; b.z = nz; return;
      }
    }
    if (dx) { b.x = dx > 0 ? Math.floor(nx + P.HW) - P.HW - 0.001 : Math.floor(nx - P.HW) + 1 + P.HW + 0.001; if (bodyHits(m, b.x, b.y, b.z, b.h)) b.x -= dx; b.vx = 0; }
    if (dz) { b.z = dz > 0 ? Math.floor(nz + P.HW) - P.HW - 0.001 : Math.floor(nz - P.HW) + 1 + P.HW + 0.001; if (bodyHits(m, b.x, b.y, b.z, b.h)) b.z -= dz; b.vz = 0; }
  }

  // 복셀 레이캐스트 (DDA)
  function raycast(m, ox, oy, oz, dx, dy, dz, maxD) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    if (m.solid(x, y, z)) return { t: 0, x, y, z, nx: 0, ny: 0, nz: 0, b: m.get(x, y, z) };
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    let tmx = dx > 0 ? (x + 1 - ox) / dx : dx < 0 ? (ox - x) / -dx : Infinity;
    let tmy = dy > 0 ? (y + 1 - oy) / dy : dy < 0 ? (oy - y) / -dy : Infinity;
    let tmz = dz > 0 ? (z + 1 - oz) / dz : dz < 0 ? (oz - z) / -dz : Infinity;
    let t = 0, nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < 1000; i++) {
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
      if (t > maxD) return null;
      if (y >= m.H && dy > 0) return null;
      if (m.solid(x, y, z)) return { t, x, y, z, nx, ny, nz, b: m.get(x, y, z) };
    }
    return null;
  }
  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    let tmin = 0, tmax = Infinity;
    const o = [ox, oy, oz], d = [dx, dy, dz];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < b[i] || o[i] > b[i + 3]) return -1; continue; }
      let t1 = (b[i] - o[i]) / d[i], t2 = (b[i + 3] - o[i]) / d[i];
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
    return tmin;
  }
  // 판정 박스: 머리/몸/다리 [minx,miny,minz,maxx,maxy,maxz]
  function hitboxes(x, y, z, crouch) {
    const H = crouch ? P.HC : P.H, hy = y + H;
    return [
      { part: 'head', b: [x - 0.27, hy - 0.5, z - 0.27, x + 0.27, hy + 0.02, z + 0.27] },
      { part: 'body', b: [x - 0.32, y + H * 0.4, z - 0.22 - 0.06, x + 0.32, hy - 0.5, z + 0.28] },
      { part: 'legs', b: [x - 0.28, y, z - 0.2, x + 0.28, y + H * 0.4, z + 0.2] },
    ];
  }
  const PART_MUL = { head: 2.2, body: 1, legs: 0.75 };

  // 폭발로 블록 파괴. protect(x,y,z) → true 면 보호. 반환: 지운 블록 [[x,y,z],...]
  function blast(m, x, y, z, r, protect) {
    const out = [];
    const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.max(2, Math.floor(y - r)), y1 = Math.floor(y + r), z0 = Math.floor(z - r), z1 = Math.floor(z + r);
    for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
      if (xx < 1 || zz < 1 || xx > m.W - 2 || zz > m.D - 2 || yy >= m.H) continue;
      const b = m.get(xx, yy, zz);
      if (!b || b === B.BEDROCK) continue;
      const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y, zz + 0.5 - z);
      if (d > r) continue;
      if (protect && protect(xx, yy, zz)) continue;
      m.set(xx, yy, zz, 0); out.push([xx, yy, zz]);
    }
    return out;
  }

  /* ================= 모드 ================= */
  const MODES = { ffa: { name: '개인전' }, tdm: { name: '팀 데스매치' }, ctf: { name: '깃발 뺏기' }, spike: { name: '스파이크' }, zombie: { name: '좀비 감염' }, gungame: { name: '건게임' }, br: { name: '배틀로얄' }, boss: { name: '보스전' }, practice: { name: '연습장', hidden: true } };
  const GG_LADDER = ['pistol', 'magnum', 'smg', 'shotgun', 'rifle', 'carbine', 'lmg', 'sniper', 'minigun', 'rocket', 'knife'];
  const ZB = { PREP: 20000, HP: 600, FIRST_HP: 1000, SPEED: 1.22 };
  const BOSS = { HP: 3000, PER: 1800, SPEED: 3.6, SPEED2: 5.2 };
  function bossHitboxes(x, y, z) { return [{ part: 'head', b: [x - 0.8, y + 4.0, z - 0.8, x + 0.8, y + 5.3, z + 0.8] }, { part: 'body', b: [x - 1.2, y, z - 1.0, x + 1.2, y + 4.0, z + 1.0] }]; }
  const SPK = { START: 800, MAX: 9000, BUY: 15000, ROUND: 100000, PLANT: 4000, DEFUSE: 7000, FUSE: 40000, WIN: 3000, LOSE: 1900, LOSE_BONUS: 500, KILL: 200, PLANT_MONEY: 300, END: 5500, WINS: 5, HALF: 4 };
  const inRect = (rc, x, z) => x >= rc[0] && x <= rc[2] + 1 && z >= rc[1] && z <= rc[3] + 1;
  const TEAMS = [{ name: '레드', color: 0xe2483a, css: '#ff6a5a' }, { name: '블루', color: 0x3d8bf0, css: '#6ab0ff' }];
  const DIFFS = { easy: { name: '쉬움', skill: [0.15, 0.35] }, normal: { name: '보통', skill: [0.4, 0.62] }, hard: { name: '어려움', skill: [0.72, 0.92] } };
  function targetOf(cfg) {
    if (cfg.mode === 'spike') return SPK.WINS;
    if (cfg.mode === 'practice') return 99999;
    if (cfg.mode === 'gungame') return GG_LADDER.length;
    if (cfg.mode === 'zombie' || cfg.mode === 'br' || cfg.mode === 'boss') return 1;
    if (cfg.mode === 'tdm') return cfg.kills * 2;
    if (cfg.mode === 'ctf') return { 15: 3, 25: 5, 40: 7 }[cfg.kills] || 3;
    return cfg.kills;
  }

  /* ================= 무기 ================= */
  // dmg: 1발 피해, rpm: 분당 발사, range [감쇠 시작, 끝, 최소배율], spread: 라디안
  const WEAPONS = {
    claw: { name: '좀비 손톱', slot: 'melee', price: 0, dmg: 65, rpm: 110, melee: 2.7, reward: 300, speed: 1.0, cat: 'melee' },
    knife: { name: '전투 칼', slot: 'melee', price: 0, dmg: 55, rpm: 110, melee: 2.3, reward: 1500, speed: 1.08, cat: 'melee' },
    pistol: { name: 'P9 권총', slot: 'secondary', price: 0, dmg: 24, rpm: 400, mag: 15, res: 60, reload: 1.5, spread: 0.012, mspread: 0.03, recoil: 1.5, range: [12, 35, 0.6], reward: 300, speed: 1.0, zoom: 1.2, cat: 'pistol' },
    magnum: { name: '매그넘', slot: 'secondary', price: 700, dmg: 58, rpm: 140, mag: 6, res: 30, reload: 2.3, spread: 0.008, mspread: 0.04, recoil: 5.5, range: [20, 50, 0.7], reward: 300, speed: 1.0, zoom: 1.3, cat: 'pistol' },
    smg: { name: 'MP-블록', slot: 'primary', price: 1250, dmg: 18, rpm: 860, mag: 30, res: 120, reload: 2.0, spread: 0.03, mspread: 0.025, recoil: 0.9, auto: true, range: [8, 26, 0.55], reward: 600, speed: 1.04, zoom: 1.25, cat: 'smg' },
    shotgun: { name: '펌프 샷건', slot: 'primary', price: 1600, dmg: 15, pellets: 9, rpm: 68, mag: 6, res: 30, reload: 0.45, shell: true, spread: 0.085, mspread: 0.02, recoil: 6, range: [6, 18, 0.3], reward: 900, speed: 0.98, zoom: 1.15, cat: 'smg' },
    rifle: { name: 'AK-블록', slot: 'primary', price: 2700, dmg: 32, rpm: 600, mag: 30, res: 90, reload: 2.5, spread: 0.018, mspread: 0.06, recoil: 2.1, auto: true, range: [25, 60, 0.75], reward: 300, speed: 0.95, zoom: 1.5, cat: 'rifle' },
    carbine: { name: 'M4-블록', slot: 'primary', price: 3100, dmg: 29, rpm: 680, mag: 30, res: 90, reload: 2.2, spread: 0.014, mspread: 0.05, recoil: 1.6, auto: true, range: [25, 60, 0.75], reward: 300, speed: 0.96, zoom: 1.7, cat: 'rifle' },
    lmg: { name: '블록 기관총', slot: 'primary', price: 4200, dmg: 30, rpm: 720, mag: 100, res: 200, reload: 5.2, spread: 0.034, mspread: 0.05, recoil: 1.7, auto: true, range: [25, 60, 0.75], reward: 300, speed: 0.85, zoom: 1.3, cat: 'heavy' },
    sniper: { name: 'AWB 저격총', slot: 'primary', price: 4750, dmg: 120, rpm: 42, mag: 5, res: 20, reload: 3.4, spread: 0.12, adsSpread: 0.0, mspread: 0.15, recoil: 9, range: [80, 120, 0.9], reward: 100, speed: 0.88, zoom: 4.2, scope: true, partMul: { head: 2, body: 1, legs: 0.75 }, cat: 'rifle' },
    rocket: { name: '로켓 런처', slot: 'primary', price: 5500, dmg: 130, radius: 4.5, proj: 'rocket', rpm: 50, mag: 1, res: 5, reload: 2.6, spread: 0.0, mspread: 0.0, recoil: 7, reward: 300, speed: 0.82, zoom: 1.2, cat: 'heavy' },
    minigun: { name: '미니건', slot: 'primary', price: 6200, dmg: 16, rpm: 1400, mag: 200, res: 200, reload: 6, spread: 0.045, mspread: 0.03, recoil: 0.6, auto: true, spin: 0.55, range: [20, 50, 0.7], reward: 300, speed: 0.72, zoom: 1.1, cat: 'heavy' },
  };
  const ITEMS = {
    armor: { name: '방탄조끼', price: 650, desc: '피해 50% 흡수 (100)' },
    helmet: { name: '헬멧', price: 350, desc: '헤드샷 피해 35% 감소' },
    nade: { name: '수류탄', price: 300, desc: '폭발 피해 110, 최대 2개', dmg: 110, radius: 5, fuse: 2.2, max: 2, blast: 2.0 },
    medkit: { name: '체력팩', price: 400, desc: '체력을 바로 가득 채워요' },
    ammo: { name: '탄약 보충', price: 200, desc: '모든 총의 예비 탄약 가득' },
    perk_speed: { name: '날쌘 발', price: 1500, desc: '이동속도 +12%', perk: true },
    perk_hp: { name: '강철 체력', price: 2000, desc: '최대 체력 125', perk: true },
    perk_reload: { name: '빠른 손', price: 1200, desc: '재장전 30% 빠름', perk: true },
    uav: { name: '레이더', price: 1000, desc: '20초간 적 위치 표시 (팀 공유)' },
    turret: { name: '자동 포탑', price: 2500, desc: 'Z키로 설치 · 40초간 자동 사격', max: 1, hp: 150, life: 40, dmg: 9 },
    air: { name: '공습', price: 4000, desc: 'X키로 조준한 곳에 폭격 6발', max: 1, dmg: 120, radius: 4.5, blast: 1.9 },
  };
  ITEMS.rock = { dmg: 45, radius: 3.6, blast: 1.6 };
  ITEMS.spike = { dmg: 500, radius: 11, blast: 3 };
  ITEMS.rocket = { dmg: WEAPONS.rocket.dmg, radius: WEAPONS.rocket.radius, blast: 2.3 };
  function maxShotDamage(w) {
    const W = WEAPONS[w]; if (!W) return 0;
    if (W.melee) return W.dmg * 3;
    return W.dmg * (W.pellets || 1) * 2.2 + 1;
  }
  function falloff(W, dist) {
    if (!W.range) return 1;
    const [a, b, mn] = W.range;
    if (dist <= a) return 1; if (dist >= b) return mn;
    return 1 - (1 - mn) * (dist - a) / (b - a);
  }

  const ECON = { START: 800, MAX: 16000, DEATH: 200, HEADSHOT: 100, BUY_TIME: 8000, SHOP_DIST: 3, RESPAWN: 4500, PROTECT: 2000 };

  // 투사체 1스텝 (서버). 반환: 폭발 위치 or null
  function stepProjectile(m, pr, dt) {
    if (pr.kind === 'rocket' || pr.kind === 'rock') {
      if (pr.kind === 'rock') pr.vy -= 9 * dt * (m.grav || 1);
      const len = Math.hypot(pr.vx, pr.vy, pr.vz), d = len * dt;
      const h = raycast(m, pr.x, pr.y, pr.z, pr.vx / len, pr.vy / len, pr.vz / len, d);
      if (h) { const t = Math.max(0, h.t - 0.05); return { x: pr.x + pr.vx / len * t, y: pr.y + pr.vy / len * t, z: pr.z + pr.vz / len * t }; }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
      return null;
    }
    // 수류탄: 튕김
    pr.vy -= 20 * dt * (m.grav || 1);
    const sub = 4, s = dt / sub;
    for (let i = 0; i < sub; i++) {
      for (const ax of ['x', 'y', 'z']) {
        const v = 'v' + ax, n = pr[ax] + pr[v] * s;
        const tx = ax === 'x' ? n : pr.x, ty = ax === 'y' ? n : pr.y, tz = ax === 'z' ? n : pr.z;
        if (m.solid(Math.floor(tx), Math.floor(ty), Math.floor(tz))) {
          pr[v] *= -0.38;
          if (ax === 'y') { pr.vx *= 0.7; pr.vz *= 0.7; }
        } else pr[ax] = n;
      }
    }
    pr.fuse -= dt;
    if (pr.fuse <= 0) return { x: pr.x, y: pr.y + 0.2, z: pr.z };
    return null;
  }

  return { encodeMap, mapFromData, blankMap, GG_LADDER, ZB, BOSS, bossHitboxes, PICKUP, SPK, inRect, blast, MODES, TEAMS, DIFFS, targetOf, B, VMap, MAPS, getMap, G, P, rng, walkable, moveBody, bodyHits, raycast, rayBox, hitboxes, PART_MUL, WEAPONS, ITEMS, maxShotDamage, falloff, ECON, stepProjectile };
});
