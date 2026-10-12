// WebAudio 합성 효과음
let ctx = null, master = null, noiseBuf = null;
export const audio = { vol: 0.6 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = audio.vol; master.connect(ctx.destination);
  const len = ctx.sampleRate * 1.5;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { audio.vol = v; if (master) master.gain.value = v; }

function noise(t, dur, f0, f1, q, g, type) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const fl = ctx.createBiquadFilter(); fl.type = type || 'lowpass'; fl.Q.value = q || 1;
  fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const gn = ctx.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(fl); fl.connect(gn); return { s, out: gn, end: t + dur };
}
function tone(t, dur, f0, f1, g, type) {
  const o = ctx.createOscillator(); o.type = type || 'square';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gn = ctx.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gn); return { s: o, out: gn, end: t + dur };
}
function out(nodes, vol, pan) {
  const g = ctx.createGain(); g.gain.value = vol;
  let dst = g;
  if (pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); }
  else g.connect(master);
  for (const n of nodes) { n.out.connect(dst); n.s.start(); n.s.stop(n.end + 0.05); }
}

const GUNSND = {
  pistol: [2400, 0.12, 0.9, 180], magnum: [1600, 0.25, 1.2, 110], smg: [3000, 0.08, 0.7, 200], shotgun: [1300, 0.32, 1.4, 80],
  rifle: [2000, 0.14, 1.0, 130], carbine: [2600, 0.12, 0.9, 150], lmg: [1700, 0.15, 1.0, 120], sniper: [1200, 0.45, 1.5, 70],
  minigun: [3200, 0.06, 0.6, 220], rocket: [700, 0.5, 1.0, 60],
  burst: [2200, 0.11, 0.95, 140], dmr: [1500, 0.3, 1.25, 95], uzi: [3400, 0.07, 0.6, 230], dbarrel: [1100, 0.4, 1.6, 70], scout: [1350, 0.38, 1.35, 85],
};
// vol: 거리 감쇠 적용된 볼륨, pan: -1..1
export function sfxShot(w, vol, pan) {
  if (!ctx) return; const t = ctx.currentTime, p = GUNSND[w] || GUNSND.pistol;
  if (w === 'rail') { out([tone(t, 0.35, 2600, 180, 0.6, 'sawtooth'), tone(t, 0.25, 900, 60, 0.4, 'sine'), noise(t, 0.2, 5000, 800, 1, 0.8, 'bandpass')], vol * 0.6, pan); return; }
  if (w === 'rocket') { out([noise(t, 0.5, 1800, 200, 0.7, 0.9), tone(t, 0.3, 220, 60, 0.3, 'sawtooth')], vol * 0.8, pan); return; }
  out([noise(t, p[1], p[0], p[3] * 4, 0.8, p[2]), tone(t, Math.min(0.12, p[1]), p[3] * 2, p[3] * 0.5, 0.5 * p[2], 'square'), noise(t, 0.03, 7000, 3000, 0.5, 0.6, 'highpass')], vol * 0.55, pan);
}
export function sfxKnife() { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.12, 6000, 1500, 2, 0.5, 'bandpass')], 0.5); }
export function sfxHit(head) { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.06, head ? 1800 : 1200, head ? 1700 : 1000, 0.5, 'square')], 0.25); if (head) out([tone(t + 0.04, 0.12, 2400, 2300, 0.4, 'triangle')], 0.3); }
export function sfxKill() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.08, 880, 880, 0.4, 'square'), tone(t + 0.08, 0.16, 1320, 1320, 0.4, 'square')], 0.22); }
export function sfxHurt() { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.12, 900, 300, 1, 0.8), tone(t, 0.1, 180, 90, 0.3, 'sawtooth')], 0.35); }
export function sfxEmpty() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.03, 2200, 1800, 0.3, 'square')], 0.2); }
export function sfxReload(stage) { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.06, stage ? 4000 : 2500, 1200, 3, 0.6, 'bandpass'), tone(t, 0.04, stage ? 700 : 500, 300, 0.2)], 0.3); }
export function sfxStep(vol) { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.07, 900, 200, 1, 0.5)], 0.18 * vol); }
export function sfxJump() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.1, 300, 600, 0.15, 'square')], 0.15); }
export function sfxLand() { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.1, 600, 120, 1, 0.7)], 0.25); }
export function sfxBuy() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.07, 1046, 1046, 0.3), tone(t + 0.07, 0.07, 1318, 1318, 0.3), tone(t + 0.14, 0.12, 1568, 1568, 0.3)], 0.2); }
export function sfxDeny() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.15, 200, 150, 0.4, 'square')], 0.2); }
export function sfxBoom(vol, pan) { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.9, 1200, 60, 0.6, 1.4), tone(t, 0.5, 120, 30, 0.8, 'sawtooth')], vol, pan); }
export function sfxPick() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.05, 600, 900, 0.3), noise(t, 0.08, 3000, 1500, 2, 0.4, 'bandpass')], 0.3); }
export function sfxSwitch() { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.05, 3500, 1500, 3, 0.5, 'bandpass')], 0.25); }
export function sfxStreak() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.1, 523, 523, 0.3), tone(t + 0.1, 0.1, 659, 659, 0.3), tone(t + 0.2, 0.1, 784, 784, 0.3), tone(t + 0.3, 0.25, 1046, 1046, 0.3)], 0.22); }
export function sfxSpin(on) { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.3, on ? 120 : 400, on ? 400 : 100, 0.2, 'sawtooth')], 0.12); }
export function sfxSiren() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.6, 500, 900, 0.25, 'sawtooth'), tone(t + 0.6, 0.6, 900, 500, 0.25, 'sawtooth')], 0.18); }
export function sfxPlane(vol) { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 2.2, 400, 150, 0.8, 0.9), tone(t, 2.2, 90, 60, 0.3, 'sawtooth')], 0.35 * vol); }
export function sfxHeal() { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.1, 660, 660, 0.3, 'triangle'), tone(t + 0.1, 0.18, 990, 990, 0.3, 'triangle')], 0.25); }
export function sfxFanfare() { if (!ctx) return; const t = ctx.currentTime; const n = [523, 659, 784, 1046, 784, 1046, 1318]; n.forEach((f, i) => out([tone(t + i * 0.09, i === n.length - 1 ? 0.5 : 0.12, f, f, 0.35, 'square'), tone(t + i * 0.09, 0.1, f / 2, f / 2, 0.2, 'triangle')], 0.22)); out([noise(t + 0.6, 0.6, 8000, 3000, 0.5, 0.3, 'highpass')], 0.15); }
export function sfxBeep(f, vol) { if (!ctx) return; const t = ctx.currentTime; out([tone(t, 0.07, f, f, 0.4, 'square')], 0.25 * (vol == null ? 1 : vol)); }

export function sfxSpray(vol) { if (!ctx) return; const t = ctx.currentTime; out([noise(t, 0.45, 6000, 3000, 0.6, 0.5, 'highpass')], 0.3 * (vol == null ? 1 : vol)); }
