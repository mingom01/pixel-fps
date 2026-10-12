// 복셀 맵 → 메시 (면 컬링 + 정점 AO)
import * as THREE from '../lib/three.module.min.js';
import { FACES, GLOW, ATLAS_COLS, ATLAS_ROWS } from './tex.js';

// 면: 법선, 4개 정점(블록 내 좌표), uv 방향, 밝기
const DIRS = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.78, k: 1 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.78, k: 1 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, k: 0 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, k: 2 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.9, k: 1 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.68, k: 1 },
];
const AO = [0.5, 0.68, 0.84, 1];

function buildChunkGeom(map, X0, Z0) {
  const pos = [], uv = [], col = [], idx = [];
  const tw = 1 / ATLAS_COLS, th = 1 / ATLAS_ROWS, eps = 0.0008;
  const S = (x, y, z) => map.get(x, y, z) !== 0 ? 1 : 0;
  let vi = 0;
  for (let y = 0; y < map.H; y++) for (let z = Z0; z < Math.min(map.D, Z0 + CH); z++) for (let x = X0; x < Math.min(map.W, X0 + CH); x++) {
    const b = map.get(x, y, z);
    if (!b) continue;
    const fc = FACES[b] || FACES[3];
    const glow = GLOW.has(b);
    for (const d of DIRS) {
      const nx = x + d.n[0], ny = y + d.n[1], nz = z + d.n[2];
      if (map.get(nx, ny, nz) !== 0) continue;
      if (ny < 0) continue;
      // 바깥 경계(맵 밖)를 향한 면은 생략
      if (nx < 0 || nz < 0 || nx >= map.W || nz >= map.D) continue;
      const ti = fc[d.k], u0 = (ti % ATLAS_COLS) * tw + eps, v1 = 1 - Math.floor(ti / ATLAS_COLS) * th - eps, u1 = u0 + tw - eps * 2, v0 = v1 - th + eps * 2;
      const ao = [];
      for (const c of d.v) {
        // 면 앞 레이어에서 정점 주변 3칸
        const ax = [], ox = c[0] * 2 - 1, oy = c[1] * 2 - 1, oz = c[2] * 2 - 1;
        let s1, s2, cc;
        if (d.n[0]) { s1 = S(nx, y + oy, z); s2 = S(nx, y, z + oz); cc = S(nx, y + oy, z + oz); }
        else if (d.n[1]) { s1 = S(x + ox, ny, z); s2 = S(x, ny, z + oz); cc = S(x + ox, ny, z + oz); }
        else { s1 = S(x + ox, y, nz); s2 = S(x, y + oy, nz); cc = S(x + ox, y + oy, nz); }
        ao.push(s1 && s2 ? 0 : 3 - (s1 + s2 + cc));
        void ax;
      }
      const uvs = d.k === 1 ? [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      for (let i = 0; i < 4; i++) {
        const c = d.v[i];
        pos.push(x + c[0], y + c[1], z + c[2]);
        uv.push(uvs[i][0], uvs[i][1]);
        const l = glow ? 1.25 : Math.pow(d.s * AO[ao[i]], 2.0);
        col.push(l, l, l);
      }
      if (ao[0] + ao[2] < ao[1] + ao[3]) idx.push(vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi);
      else idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const CH = 16;
// 청크(16x16 기둥) 단위 메시 그룹. 블록이 부서지면 해당 청크만 다시 만듦
export function buildWorld(map, atlasTex) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true });
  grp.userData = { map, mat, chunks: new Map() };
  for (let cz = 0; cz < map.D; cz += CH) for (let cx = 0; cx < map.W; cx += CH) setChunk(grp, cx, cz);
  return grp;
}
function setChunk(grp, cx, cz) {
  const u = grp.userData, k = cx + "," + cz, old = u.chunks.get(k);
  if (old) { grp.remove(old); old.geometry.dispose(); }
  const mesh = new THREE.Mesh(buildChunkGeom(u.map, cx, cz), u.mat);
  mesh.matrixAutoUpdate = false;
  u.chunks.set(k, mesh); grp.add(mesh);
}
// 바뀐 블록 목록 → 영향받는 청크(경계면이면 이웃까지) 재생성
export function rebuildBlocks(grp, list) {
  const set = new Set();
  for (const [x, , z] of list) for (const dx of [-1, 0, 1]) for (const dz of [-1, 0, 1]) {
    const cx = Math.floor((x + dx) / CH) * CH, cz = Math.floor((z + dz) / CH) * CH;
    if (cx >= 0 && cz >= 0 && cx < grp.userData.map.W && cz < grp.userData.map.D) set.add(cx + "," + cz);
  }
  for (const k of set) { const [cx, cz] = k.split(",").map(Number); setChunk(grp, cx, cz); }
}
export function disposeWorld(grp) { for (const m of grp.userData.chunks.values()) m.geometry.dispose(); }

// 하늘: 그라데이션 돔 + 픽셀 구름 + 해
export function buildSky(def) {
  const grp = new THREE.Group();
  const geo = new THREE.SphereGeometry(400, 16, 12);
  const top = new THREE.Color(def.sky[0]), hor = new THREE.Color(def.sky[1]);
  const cols = [];
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, p.getY(i) / 400); const c = hor.clone().lerp(top, Math.pow(t, 0.6)); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff6c8, fog: false })); sun.scale.set(36, 36, 1);
  sun.position.set(-180, 260, -160); grp.add(sun);
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
  const clouds = new THREE.Group();
  let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    const n = 2 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(10 + r() * 16, 3, 8 + r() * 10), cm); m.position.set(k * 8 - n * 4, 0, (r() - 0.5) * 8); c.add(m); }
    c.position.set((r() - 0.5) * 500, 70 + r() * 20, (r() - 0.5) * 500);
    clouds.add(c);
  }
  grp.add(clouds); grp.userData.clouds = clouds;
  clouds.visible = !def.noClouds;
  if (def.stars) {
    const pos = [];
    for (let i = 0; i < 700; i++) { const u = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); if (u < -0.05) continue; pos.push(Math.cos(t) * s * 380, u * 380, Math.sin(t) * s * 380); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    grp.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
  }
  if (def.grav && def.grav < 1) {
    // 하늘에 뜬 지구
    const cv = document.createElement('canvas'); cv.width = cv.height = 16; const x = cv.getContext('2d');
    for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) { const d = Math.hypot(xx - 7.5, yy - 7.5); if (d < 7.5) { x.fillStyle = d > 6.6 ? '#9fd0ff' : (Math.sin(xx * 1.3) + Math.cos(yy * 1.1) > 0.6 ? '#3aa04a' : '#2f6fd8'); x.fillRect(xx, yy, 1, 1); } }
    const tx = new THREE.CanvasTexture(cv); tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
    const earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, fog: false, transparent: true })); earth.scale.set(70, 70, 1); earth.position.set(150, 160, -260); grp.add(earth);
  }
  grp.renderOrder = -1;
  return grp;
}
