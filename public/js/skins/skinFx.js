// 스킨 효과: 오라 입자(영웅·전설), 머리 위 빛 고리(전설 캐릭터), 처치 효과·피니셔, 탄 궤적 색
import * as THREE from '../../lib/three.module.min.js';

const dot = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d'), g = x.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 16, 16);
  return new THREE.CanvasTexture(c);
})();
const _c = new THREE.Color();
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const auras = [];

// spec: { kind, colors }, o: { count, r(반경), h(높이), y0(바닥), size, scale(전체 크기 배율) }
export function makeAura(spec, o) {
  const n = o.count || 24, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const smoke = spec.kind === 'smoke';
  const mat = new THREE.PointsMaterial({ size: o.size || 0.08, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: smoke ? 0.55 : 1 });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 5;
  const st = { spec, o, P: [], t: Math.random() * 10, lost: 0 };
  for (let i = 0; i < n; i++) { st.P.push({}); reset(st, i, true); }
  pts.userData.aura = st;
  auras.push(pts);
  update(pts, 0);
  return pts;
}

function reset(st, i, initial) {
  const { spec, o } = st, p = st.P[i], R = o.r || 0.5, H = o.h || 1.8, y0 = o.y0 || 0;
  const a = Math.random() * Math.PI * 2, rr = R * Math.sqrt(Math.random());
  p.c = pick(spec.colors); p.max = 1; p.life = 1;
  switch (spec.kind) {
    case 'ember': p.x = Math.cos(a) * rr; p.z = Math.sin(a) * rr; p.y = y0 + rnd(0, H * 0.3); p.vx = rnd(-0.1, 0.1) * R; p.vz = rnd(-0.1, 0.1) * R; p.vy = rnd(0.5, 1.1) * H; p.max = rnd(0.7, 1.4); break;
    case 'smoke': p.x = Math.cos(a) * rr; p.z = Math.sin(a) * rr; p.y = y0 + rnd(0, H * 0.4); p.vx = rnd(-0.05, 0.05); p.vz = rnd(-0.05, 0.05); p.vy = rnd(0.25, 0.5) * H; p.max = rnd(1.2, 2.2); break;
    case 'snow': p.x = Math.cos(a) * rr * 1.3; p.z = Math.sin(a) * rr * 1.3; p.y = y0 + H * rnd(0.6, 1.1); p.vx = 0; p.vz = 0; p.vy = -rnd(0.15, 0.35) * H; p.max = rnd(1.8, 3); p.ph = Math.random() * 6; break;
    case 'petal': p.x = Math.cos(a) * rr * 1.4; p.z = Math.sin(a) * rr * 1.4; p.y = y0 + H * rnd(0.7, 1.2); p.vx = rnd(0.1, 0.3) * R; p.vz = rnd(-0.1, 0.1) * R; p.vy = -rnd(0.2, 0.4) * H; p.max = rnd(1.8, 2.6); p.ph = Math.random() * 6; break;
    case 'spark': { p.x = Math.cos(a) * rr; p.z = Math.sin(a) * rr; p.y = y0 + rnd(0.1, 0.9) * H; const s = rnd(0.6, 1.4) * R * 2; p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = rnd(-0.3, 0.6) * H; p.max = rnd(0.25, 0.5); break; }
    case 'arcane': case 'prism': case 'halo': p.a = Math.random() * Math.PI * 2; p.sp = rnd(1.2, 2.2) * (Math.random() < 0.5 ? 1 : -1); p.y = spec.kind === 'halo' ? y0 + H : y0 + rnd(0, H); p.vy = spec.kind === 'arcane' ? rnd(0.2, 0.45) * H : 0; p.rr = spec.kind === 'halo' ? R * 0.55 : R * rnd(0.8, 1.15); p.max = spec.kind === 'arcane' ? rnd(1.6, 2.6) : 1e9; break;
    default: /* star */ p.x = Math.cos(a) * rr * 1.2; p.z = Math.sin(a) * rr * 1.2; p.y = y0 + rnd(0, H); p.vx = rnd(-0.03, 0.03); p.vz = rnd(-0.03, 0.03); p.vy = rnd(0.02, 0.08) * H; p.max = rnd(1.2, 2.4); p.ph = Math.random() * 6;
  }
  p.life = initial ? Math.random() * p.max : p.max;
}

function update(pts, dt) {
  const st = pts.userData.aura, { spec } = st, P = st.P;
  const pos = pts.geometry.attributes.position.array, col = pts.geometry.attributes.color.array;
  st.t += dt;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    p.life -= dt;
    if (p.life <= 0) reset(st, i, false);
    const k = Math.max(0, p.life / p.max); // 1 → 0
    let x, y, z, b = 1;
    if (spec.kind === 'arcane' || spec.kind === 'prism' || spec.kind === 'halo') {
      p.a += p.sp * dt; p.y += p.vy * dt;
      x = Math.cos(p.a) * p.rr; z = Math.sin(p.a) * p.rr; y = p.y + (spec.kind === 'prism' ? Math.sin(p.a * 2 + st.t) * 0.15 * (st.o.h || 1) : 0);
      if (spec.kind === 'arcane') b = Math.sin(k * Math.PI);
      if (spec.kind === 'halo') b = 0.6 + 0.4 * Math.sin(st.t * 4 + p.a * 3);
    } else {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (spec.kind === 'snow' || spec.kind === 'petal') { p.x += Math.sin(st.t * 2 + p.ph) * dt * 0.15; }
      x = p.x; y = p.y; z = p.z;
      b = spec.kind === 'ember' || spec.kind === 'spark' ? k : spec.kind === 'smoke' ? 1 : Math.sin(k * Math.PI);
      if (spec.kind === 'star') b *= 0.5 + 0.5 * Math.sin(st.t * 6 + p.ph * 3);
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    if (spec.kind === 'prism') _c.setHSL((st.t * 0.3 + p.a / (Math.PI * 2)) % 1, 1, 0.6); else _c.setHex(p.c);
    col[i * 3] = _c.r * b; col[i * 3 + 1] = _c.g * b; col[i * 3 + 2] = _c.b * b;
  }
  pts.geometry.attributes.position.needsUpdate = true;
  pts.geometry.attributes.color.needsUpdate = true;
}

function attached(o) { while (o.parent) o = o.parent; return o.isScene; }
export function tickAuras(dt) {
  for (let i = auras.length - 1; i >= 0; i--) {
    const p = auras[i];
    if (!attached(p)) { if (++p.userData.aura.lost > 120) { auras.splice(i, 1); p.geometry.dispose(); p.material.dispose(); } continue; }
    p.userData.aura.lost = 0;
    if (p.visible) update(p, dt);
  }
}

// 캐릭터용 오라 + 전설 빛 고리
export function decorateChar(root, spec) {
  if (!spec) return;
  if (spec.aura) root.add(makeAura(spec.aura, { count: spec.r === 'legend' ? 36 : 22, r: 0.45, h: 1.9, y0: 0.05, size: spec.r === 'legend' ? 0.13 : 0.1 }));
  if (spec.halo) root.add(makeAura({ kind: 'halo', colors: [spec.halo, 0xffffff] }, { count: 18, r: 0.55, h: 2.05, y0: 0, size: 0.09 }));
}
// 총용 오라 (전설 총 스킨). len = 총 길이(월드 단위)
export function decorateGun(grp, spec, len, few) {
  if (!spec || !spec.aura) return;
  const a = makeAura(spec.aura, { count: few ? 10 : 26, r: len * 0.18, h: len * 0.45, y0: -len * 0.1, size: len * (few ? 0.06 : 0.05) });
  a.position.z = -len * 0.45;
  grp.add(a);
}

// 전설 캐릭터 스킨: 오라 종류별 피니셔
export const AURA_FINISHER = { ember: 'eruption', smoke: 'blackhole', star: 'supernova', petal: 'bloom', arcane: 'vortex', spark: 'thunderstrike', snow: 'frostbloom', prism: 'refract' };
// 탄 궤적·파편 색 ('rainbow' 이면 쏠 때마다 다른 색)
export function fxColor(c) { if (c === 'rainbow') return _c.setHSL(Math.random(), 1, 0.6).getHex(); return c; }

// 처치 효과. spawn(x,y,z,vx,vy,vz,color,life,size,grav), flash(pos,size)
export function killEffect(spawn, p, colors, finisher, flash) {
  const C = () => pick(colors);
  const y = p.y + 1;
  if (!finisher) { // 영웅: 색 파편 폭발
    for (let i = 0; i < 36; i++) { const a = Math.random() * Math.PI * 2, e = rnd(-0.6, 1), s = rnd(2, 5); spawn(p.x, y, p.z, Math.cos(a) * s, e * s, Math.sin(a) * s, C(), rnd(0.5, 0.9), 0.09, 6); }
    return;
  }
  if (flash) flash(new THREE.Vector3(p.x, y, p.z), finisher === 'ascend' ? 1.2 : 2.2);
  if (finisher === 'ascend') { // 영웅: 바닥 고리 + 나선으로 솟는 빛기둥
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; spawn(p.x + Math.cos(a) * 0.9, p.y + 0.1, p.z + Math.sin(a) * 0.9, Math.cos(a) * 1.5, 0.3, Math.sin(a) * 1.5, C(), 0.7, 0.1, 0); }
    for (let i = 0; i < 46; i++) { const a = i * 0.55, rr = 0.55; spawn(p.x + Math.cos(a) * rr, p.y + 0.2 + i * 0.03, p.z + Math.sin(a) * rr, -Math.sin(a) * 1.2, 3.2 + i * 0.03, Math.cos(a) * 1.2, C(), rnd(0.6, 0.9), 0.09, 0); }
  } else if (finisher === 'eruption') {
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = rnd(0.5, 2.2); spawn(p.x, p.y + 0.2, p.z, Math.cos(a) * s, rnd(6, 12), Math.sin(a) * s, C(), rnd(0.8, 1.4), 0.12, 9); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; spawn(p.x, p.y + 0.2, p.z, Math.cos(a) * 5, 0.5, Math.sin(a) * 5, C(), 0.6, 0.1, 0); }
  } else if (finisher === 'supernova') {
    for (const [s, n] of [[2, 24], [4.5, 32], [7.5, 40]]) for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u); spawn(p.x, y, p.z, Math.cos(a) * q * s, u * s, Math.sin(a) * q * s, C(), rnd(0.7, 1.2), 0.1, 0); }
  } else if (finisher === 'refract') {
    for (let ring = 0; ring < 5; ring++) for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, s = 2 + ring * 1.2; spawn(p.x, y - 0.4 + ring * 0.25, p.z, Math.cos(a) * s, 0.4, Math.sin(a) * s, colors[ring % colors.length], 0.9, 0.1, 0); }
  } else if (finisher === 'dragonfire') {
    for (let i = 0; i < 80; i++) { const a = i * 0.45, s = 1.5 + i * 0.06; spawn(p.x, p.y + 0.2, p.z, Math.cos(a) * s, 2 + i * 0.09, Math.sin(a) * s, C(), rnd(0.8, 1.3), 0.12, 3); }
  } else if (finisher === 'vortex') { // 소용돌이가 위로 감겨 올라감
    for (let i = 0; i < 90; i++) { const a = i * 0.35, rr = 2.5 - i * 0.02; spawn(p.x + Math.cos(a) * rr, p.y + 0.2 + i * 0.03, p.z + Math.sin(a) * rr, -Math.sin(a) * 4, 3, Math.cos(a) * 4, C(), rnd(0.7, 1.1), 0.1, 0); }
  } else if (finisher === 'shatter') { // 유리처럼 깨져 흩어짐
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, s = rnd(3, 9); spawn(p.x, y, p.z, Math.cos(a) * s, rnd(-2, 6), Math.sin(a) * s, C(), rnd(0.5, 1), rnd(0.08, 0.16), 14); }
  } else if (finisher === 'thunderstrike') { // 하늘에서 번개 기둥
    for (let i = 0; i < 60; i++) spawn(p.x + rnd(-0.3, 0.3), p.y + i * 0.3, p.z + rnd(-0.3, 0.3), rnd(-0.5, 0.5), -2, rnd(-0.5, 0.5), C(), rnd(0.3, 0.6), 0.14, 0);
    for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; spawn(p.x, p.y + 0.1, p.z, Math.cos(a) * 7, 0.5, Math.sin(a) * 7, C(), 0.5, 0.1, 0); }
  } else if (finisher === 'bloom') { // 꽃잎이 피어남
    for (let k = 0; k < 6; k++) for (let i = 0; i < 12; i++) { const a = k / 6 * Math.PI * 2 + i * 0.05, s = 1 + i * 0.35; spawn(p.x, y, p.z, Math.cos(a) * s, 1.5 + i * 0.1, Math.sin(a) * s, C(), rnd(1, 1.6), 0.12, 2); }
  } else if (finisher === 'blackhole') { // 빨려 들어감
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, rr = rnd(2.5, 4); spawn(p.x + Math.cos(a) * rr, y + rnd(-1, 1.5), p.z + Math.sin(a) * rr, -Math.cos(a) * rr * 1.6, rnd(-0.5, 0.5), -Math.sin(a) * rr * 1.6, C(), 0.6, 0.11, 0); }
  } else if (finisher === 'heartburst') { // 하트 모양으로 터짐
    for (let i = 0; i < 60; i++) { const t = i / 60 * Math.PI * 2, hx = 16 * Math.sin(t) ** 3, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); spawn(p.x, y + 0.5, p.z, hx * 0.3, hy * 0.3, 0, C(), 1, 0.12, 0); }
  } else if (finisher === 'frostbloom') {
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; spawn(p.x, p.y + 0.1, p.z, Math.cos(a) * 6, 0.2, Math.sin(a) * 6, C(), 0.8, 0.11, 0); }
    for (let i = 0; i < 40; i++) spawn(p.x + rnd(-1.5, 1.5), p.y + rnd(2, 3.5), p.z + rnd(-1.5, 1.5), rnd(-0.3, 0.3), -rnd(0.5, 1.2), rnd(-0.3, 0.3), C(), rnd(1.5, 2.2), 0.08, 0);
  }
}
