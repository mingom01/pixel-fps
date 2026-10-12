// 맵 기믹 (클라): 이벤트 연출(분화 운석·눈보라·모래폭풍·정전·감전·불꽃놀이), 기믹 바닥 주변 입자, 점프대·포탈 효과음
import * as THREE from '../lib/three.module.min.js';
import * as A from './audio.js';

const SH = window.SH, B = SH.B;
let D = null;        // main.js 에서 받은 도구 { scene, world(), camera, spawn, showBig, me }
let def = null, map = null, cells = [], on = {}, meteors = [], fx = 0, ambT = 0, fwT = 0, zapT = 0;
let fogBase = null;
const $ = (id) => document.getElementById(id);

const NAMES = {
  eruption: ['화산이 분화합니다! 운석 주의!', '#ff8a30'],
  zap: ['전기 바닥에 전류가 흐릅니다!', '#fff060'],
  blackout: ['정전! 시야가 어두워져요', '#9ab0d0'],
  blizzard: ['눈보라가 몰려와요!', '#d8f0ff'],
  sandstorm: ['모래폭풍이 불어와요!', '#f0c878'],
  fireworks: ['불꽃놀이 시작!', '#ff8ae0'],
};
// 환경 처치 사유 (킬피드)
export const ENV_KILL = { lava: '용암', zap: '감전', void: '추락', air: '운석' };

export function initGimmicks(deps) { D = deps; }

// 맵 시작: 기믹 칸 목록 + 진행 중 이벤트
export function startGimmicks(mapDef, vmap, snap) {
  def = mapDef || {}; map = vmap; on = {}; meteors = []; fx = 0;
  fogBase = null;
  cells = [];
  if (map && map.gim) {
    const want = new Set([B.LAVA, B.JUMPPAD, B.PORTAL, B.ELECTRIC, B.TRAMPOLINE]);
    for (let z = 0; z < map.D; z++) for (let x = 0; x < map.W; x++) for (let y = 1; y < map.H - 2; y++) {
      const b = map.get(x, y, z);
      if (want.has(b) && !map.get(x, y + 1, z)) cells.push([x, y, z, b]);
    }
  }
  for (const s of snap || []) on[s.ev] = { until: s.until };
  setTint();
}
export function setGimMap(vmap) { map = vmap; }
export function stopGimmicks() { on = {}; meteors = []; cells = []; map = null; setTint(); }

export function onGimMsg(m) {
  const nm = NAMES[m.ev];
  if (m.ph === 'warn') { if (nm) D.showBig(nm[0], nm[1], 2400); A.sfxSiren(); return; }
  if (m.ph === 'on') {
    on[m.ev] = { until: m.until || Date.now() + 6000 };
    if (m.ev === 'eruption') { if (nm) D.showBig(nm[0], nm[1], 2000); A.sfxBoom(0.5, 0); for (const [x, z, delay] of m.pts || []) meteors.push({ x, z, t0: performance.now() + delay, t1: performance.now() + delay + 1000 }); }
    if (m.ev === 'fireworks' && nm) D.showBig(nm[0], nm[1], 1600);
  }
  if (m.ph === 'off') delete on[m.ev];
  setTint();
}

// 화면 색 덮개 (정전·눈보라·모래폭풍)
function setTint() {
  const el = $('gimTint'); if (!el) return;
  el.className = on.blackout ? 'blackout' : on.blizzard ? 'blizzard' : on.sandstorm ? 'sandstorm' : '';
}

// 매 프레임
export function updateGimmicks(dt) {
  if (!map || !D) return;
  const scene = D.scene, cam = D.camera, me = D.me, spawn = D.spawn;
  // 안개: 눈보라·모래폭풍이면 확 줄임
  if (scene.fog) {
    if (!fogBase) fogBase = { near: scene.fog.near, far: scene.fog.far, color: scene.fog.color.getHex() };
    const storm = on.blizzard || on.sandstorm;
    fx += ((storm ? 1 : 0) - fx) * Math.min(1, dt * 1.5);
    scene.fog.near = fogBase.near + (3 - fogBase.near) * fx;
    scene.fog.far = fogBase.far + (24 - fogBase.far) * fx;
    scene.fog.color.setHex(fogBase.color).lerp(new THREE.Color(on.sandstorm ? 0xd8b070 : 0xe8f2ff), fx);
  }
  // 정전: 블록 밝기 낮춤
  const w = D.world(); if (w && w.userData.mat) { const k = on.blackout ? 0.35 : 1, c = w.userData.mat.color; c.setScalar(c.r + (k - c.r) * Math.min(1, dt * 3)); }
  // 폭풍 입자 (카메라 주변을 옆으로 휩쓸고 감)
  if (fx > 0.1) {
    const n = Math.round(fx * 10);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 10;
      spawn(cam.position.x + Math.cos(a) * r, cam.position.y + (Math.random() - 0.3) * 4, cam.position.z + Math.sin(a) * r, 9 + Math.random() * 5, -1 - Math.random() * 2, 3 * (Math.random() - 0.5), on.sandstorm ? 0xd8b070 : 0xffffff, 0.8, on.sandstorm ? 0.05 : 0.07, 0);
    }
  }
  // 운석: 하늘에서 떨어지는 불덩이 꼬리
  const now = performance.now();
  for (let i = meteors.length - 1; i >= 0; i--) {
    const mt = meteors[i];
    if (now < mt.t0) continue;
    const k = Math.min(1, (now - mt.t0) / (mt.t1 - mt.t0)), y = 42 - (42 - (SH.G + 1)) * k * k;
    const x = mt.x - (1 - k) * 6, z = mt.z - (1 - k) * 4;
    for (let j = 0; j < 4; j++) spawn(x + (Math.random() - 0.5) * 0.6, y + Math.random(), z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5, [0xffe060, 0xff8a1a, 0xd23a0a, 0x3a3030][j], 0.5 + Math.random() * 0.4, j === 0 ? 0.35 : 0.2, -2);
    if (k >= 1) meteors.splice(i, 1);
  }
  // 불꽃놀이
  if (on.fireworks) {
    fwT -= dt;
    if (fwT <= 0) {
      fwT = 0.35 + Math.random() * 0.4;
      const x = 8 + Math.random() * (map.W - 16), z = 8 + Math.random() * (map.D - 16), y = 18 + Math.random() * 8;
      const cols = [[0xff5a5a, 0xffd84a], [0x5ab8ff, 0xffffff], [0x7aff8a, 0xffff7a], [0xff8ae0, 0xd85aff]][Math.random() * 4 | 0];
      for (let i = 0; i < 46; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u), s = 6 + Math.random() * 2; spawn(x, y, z, Math.cos(a) * q * s, u * s, Math.sin(a) * q * s, cols[i % 2], 1.2 + Math.random() * 0.5, 0.18, 3); }
      const d = Math.hypot(x - me.x, z - me.z); A.sfxBoom(Math.max(0.05, 0.3 - d / 200), 0);
    }
  }
  // 감전 중: 전기 바닥 불꽃
  zapT -= dt;
  const zapping = !!on.zap;
  // 기믹 바닥 주변 입자 (가까운 칸만)
  ambT -= dt;
  if (ambT <= 0 && cells.length) {
    ambT = 0.06;
    for (let t = 0; t < 6; t++) {
      const c = cells[Math.random() * cells.length | 0];
      if (Math.abs(c[0] - me.x) > 22 || Math.abs(c[2] - me.z) > 22) continue;
      const x = c[0] + Math.random(), y = c[1] + 1.02, z = c[2] + Math.random();
      if (c[3] === B.LAVA) spawn(x, y, z, 0, 1.2 + Math.random() * 1.5, 0, Math.random() < 0.5 ? 0xff8a1a : 0xffe060, 0.6, 0.07, -1);
      else if (c[3] === B.JUMPPAD) spawn(x, y, z, 0, 3 + Math.random() * 2, 0, 0x8aff9a, 0.5, 0.06, 0);
      else if (c[3] === B.PORTAL) { const a = Math.random() * 6.28; spawn(c[0] + 0.5 + Math.cos(a) * 0.6, y, c[2] + 0.5 + Math.sin(a) * 0.6, -Math.cos(a) * 0.5, 2.5, -Math.sin(a) * 0.5, Math.random() < 0.5 ? 0xc08aff : 0xffffff, 0.8, 0.07, 0); }
      else if (c[3] === B.ELECTRIC && zapping) spawn(x, y, z, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, Math.random() < 0.6 ? 0xfff060 : 0x8ad8ff, 0.25, 0.06, 6);
      else if (c[3] === B.TRAMPOLINE && Math.random() < 0.3) spawn(x, y, z, 0, 1.5, 0, 0xffffff, 0.4, 0.05, 0);
    }
  }
  if (zapping && zapT <= 0) { zapT = 0.5; if (cells.some(c => c[3] === B.ELECTRIC && Math.abs(c[0] - me.x) < 12 && Math.abs(c[2] - me.z) < 12)) A.sfxBeep(90 + Math.random() * 40, 0.4); }
}

// 내 몸에 일어난 기믹 (moveBody 가 남긴 b.gimEv)
export function afterMove(me) {
  const ev = me.gimEv; if (!ev) return; me.gimEv = null;
  if (ev === 'pad') { A.sfxJump(); A.sfxSpin(true); for (let i = 0; i < 16; i++) D.spawn(me.x, me.y + 0.1, me.z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0x8aff9a, 0.5, 0.08, 6); }
  else if (ev === 'bounce') A.sfxJump();
  else if (ev === 'tp') { A.sfxSpin(false); A.sfxPick(); if (me.tpYaw != null) { me.yaw = me.tpYaw; me.tpYaw = null; } for (let i = 0; i < 24; i++) D.spawn(me.x, me.y + Math.random() * 1.8, me.z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0xc08aff, 0.6, 0.08, 0); }
}

// 얼음 바닥 미끄러짐 (지상 가속 배율)
export function groundAccMul(me) {
  if (!map || !map.gim || !map.gim.ice || !me.ground) return 1;
  return SH.floorAt(map, me) === B.ICE ? 0.1 : 1;
}
