// 맵 기믹 (서버): 위험 바닥 피해(용암·전기·추락) + 시간 이벤트(분화·감전·정전·눈보라·모래폭풍·불꽃놀이)
const SH = require('../public/js/shared.js');
const { B } = SH;

let X = null; // server.js 에서 받은 함수들: { broadcast, explode, damage, topY }
function init(fns) { X = fns; }

// 매치 시작 때 이벤트 시계 준비
function start(r) {
  const g = r.map && r.map.gim;
  r.gimS = null;
  if (!g) return;
  const now = Date.now();
  r.gimS = { zap: false, meteors: [], ev: (g.events || []).map((d, i) => ({ d, ph: 'idle', next: now + d.every * (0.5 + 0.15 * i), until: 0 })) };
}

function send(r, ev, ph, extra) { X.broadcast(r, Object.assign({ t: 'gim', ev, ph }, extra || {})); }

function eventOn(r, e, now) {
  const kind = e.d.kind;
  if (kind === 'zap') r.gimS.zap = true;
  if (kind === 'eruption') {
    // 스폰 지점 근처로 운석 10개 (1초 동안 떨어지는 모습 → 폭발)
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const s = r.map.spawns[Math.floor(Math.random() * r.map.spawns.length)];
      const x = Math.max(2, Math.min(r.map.W - 3, s[0] + (Math.random() - 0.5) * 10)), z = Math.max(2, Math.min(r.map.D - 3, s[2] + (Math.random() - 0.5) * 10));
      const delay = i * 380;
      pts.push([+x.toFixed(1), +z.toFixed(1), delay]);
      r.gimS.meteors.push({ x, z, at: now + delay + 1000 });
    }
    e.until = now + 5500;
    send(r, kind, 'on', { pts });
    return;
  }
  e.until = now + (e.d.dur || 3000);
  send(r, kind, 'on', { until: e.until });
}

function tick(r, now, dt) {
  const S = r.gimS, m = r.map; if (!S) return;
  const g = m.gim;
  for (const e of S.ev) {
    if (e.ph === 'idle' && now >= e.next - (e.d.warn || 0)) { e.ph = 'warn'; if (e.d.warn) send(r, e.d.kind, 'warn', { at: e.next }); }
    if (e.ph === 'warn' && now >= e.next) { e.ph = 'on'; eventOn(r, e, now); }
    if (e.ph === 'on' && now >= e.until) {
      e.ph = 'idle'; e.next = now + e.d.every;
      if (e.d.kind === 'zap') S.zap = false;
      send(r, e.d.kind, 'off');
    }
  }
  for (let i = S.meteors.length - 1; i >= 0; i--) {
    const mt = S.meteors[i];
    if (now < mt.at) continue;
    S.meteors.splice(i, 1);
    X.explode(r, mt.x, X.topY(m, mt.x, mt.z) + 0.3, mt.z, null, 'air');
    if (r.state !== 'play') return;
  }
  // 위험 바닥
  for (const e of r.ents.values()) {
    if (!e.alive || e.boss) continue;
    if (g.voidY && e.y < g.voidY) { X.damage(r, e, null, 999, 'void', 'body', true); continue; }
    const fl = SH.floorAt(m, e);
    if (fl === B.LAVA && g.lava) X.damage(r, e, null, g.lava * dt, 'lava', 'body', true);
    else if (fl === B.ELECTRIC && S.zap) X.damage(r, e, null, (g.zap || 40) * dt, 'zap', 'body', true);
  }
}

// 중간에 들어온 사람용 현재 상태
function snapshot(r) {
  if (!r.gimS) return null;
  return r.gimS.ev.filter(e => e.ph === 'on').map(e => ({ ev: e.d.kind, until: e.until }));
}

module.exports = { init, start, tick, snapshot };
