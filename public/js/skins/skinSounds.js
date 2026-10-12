// 스킨 전용 효과음: 사격음 레이어(레어+), 처치음(영웅+), 장착음·피니셔(전설), 발소리(캐릭터 레어+)
import { actx, aNoise as N, aTone as T, aOut as O } from '../audio.js';

// 사격음 위에 덧입히는 소리 (기본 총소리는 그대로 + 스킨 개성)
const SHOT = {
  chime: (t) => [T(t, 0.18, 2637, 2637, 0.18, 'triangle'), T(t + 0.02, 0.22, 3951, 3951, 0.1, 'sine')],
  ember: (t) => [N(t, 0.25, 3000, 600, 0.8, 0.5, 'bandpass'), N(t + 0.05, 0.15, 6000, 2000, 2, 0.25, 'highpass')],
  frost: (t) => [T(t, 0.2, 4200, 3000, 0.1, 'sine'), N(t, 0.12, 9000, 5000, 3, 0.35, 'highpass'), T(t + 0.03, 0.15, 5274, 5274, 0.06, 'triangle')],
  bubble: (t) => [T(t, 0.1, 400, 900, 0.18, 'sine'), T(t + 0.06, 0.1, 500, 1100, 0.12, 'sine')],
  splash: (t) => [N(t, 0.25, 1800, 400, 1.2, 0.5, 'bandpass'), T(t, 0.12, 700, 300, 0.12, 'sine')],
  bone: (t) => [N(t, 0.06, 2500, 1800, 6, 0.6, 'bandpass'), N(t + 0.05, 0.05, 1800, 1200, 6, 0.4, 'bandpass')],
  laser: (t) => [T(t, 0.16, 1800, 300, 0.22, 'sawtooth'), T(t, 0.1, 3600, 900, 0.08, 'square')],
  synth: (t) => [T(t, 0.14, 880, 220, 0.2, 'square'), T(t, 0.14, 1320, 330, 0.12, 'sawtooth')],
  crystal: (t) => [T(t, 0.3, 3136, 3136, 0.12, 'triangle'), T(t + 0.03, 0.3, 4186, 4186, 0.08, 'sine'), T(t + 0.06, 0.3, 5274, 5274, 0.05, 'sine')],
  void: (t) => [T(t, 0.35, 160, 40, 0.35, 'sine'), N(t, 0.25, 800, 100, 1, 0.4, 'lowpass'), T(t, 0.2, 1200, 2400, 0.05, 'sine')],
  thunder: (t) => [N(t, 0.08, 8000, 3000, 0.5, 0.8, 'highpass'), N(t + 0.02, 0.4, 600, 60, 0.6, 0.7, 'lowpass')],
  magma: (t) => [T(t, 0.3, 110, 40, 0.35, 'sawtooth'), N(t, 0.3, 2400, 300, 0.7, 0.5, 'bandpass'), N(t + 0.08, 0.2, 7000, 3000, 1, 0.2, 'highpass')],
  cosmic: (t) => [T(t, 0.4, 1046, 2093, 0.12, 'sine'), T(t + 0.05, 0.35, 1568, 3136, 0.08, 'triangle'), T(t, 0.25, 260, 90, 0.2, 'sine')],
  prism: (t) => [523, 659, 784, 1046].map((f, i) => T(t + i * 0.025, 0.18, f * 2, f * 2, 0.08, 'triangle')),
  dragon: (t) => [T(t, 0.35, 140, 55, 0.4, 'sawtooth'), N(t, 0.4, 1600, 200, 0.6, 0.6, 'bandpass'), T(t + 0.05, 0.2, 700, 350, 0.1, 'square')],
  aurora: (t) => [T(t, 0.45, 784, 1175, 0.1, 'sine'), T(t + 0.04, 0.45, 1175, 1568, 0.07, 'sine'), N(t, 0.3, 7000, 4000, 2, 0.15, 'highpass')],
};
export function sfxSkinShot(snd, vol, pan) {
  const ctx = actx(); if (!ctx || !SHOT[snd]) return;
  O(SHOT[snd](ctx.currentTime), vol * 0.45, pan);
}

// 처치음 (영웅·전설)
export function sfxSkinKill(snd) {
  const ctx = actx(); if (!ctx || !SHOT[snd]) return; const t = ctx.currentTime;
  O([T(t, 0.12, 880, 880, 0.25, 'triangle'), T(t + 0.1, 0.25, 1760, 1760, 0.2, 'triangle')], 0.25);
  O(SHOT[snd](t + 0.05), 0.4);
}

// 전설 피니셔 / 장착
export function sfxFinisher(kind) {
  const ctx = actx(); if (!ctx) return; const t = ctx.currentTime;
  const seq = { eruption: [196, 247, 294, 392], supernova: [523, 784, 1046, 1568], refract: [523, 659, 784, 988, 1175], dragonfire: [147, 196, 220, 294], frostbloom: [659, 880, 1175, 1568] }[kind] || [440, 660, 880];
  seq.forEach((f, i) => O([T(t + i * 0.07, 0.35, f, f, 0.18, 'triangle'), T(t + i * 0.07, 0.25, f * 2, f * 2, 0.06, 'sine')], 0.3));
  O([N(t + 0.25, 0.8, 5000, 300, 0.6, 0.5, 'bandpass'), T(t + 0.25, 0.7, 90, 40, 0.3, 'sine')], 0.35);
}
export function sfxEquip(snd) {
  const ctx = actx(); if (!ctx) return; const t = ctx.currentTime;
  O([N(t, 0.4, 600, 6000, 1, 0.25, 'bandpass'), T(t + 0.15, 0.4, 523, 1046, 0.12, 'sine')], 0.3);
  if (SHOT[snd]) O(SHOT[snd](t + 0.3), 0.25);
}

// 캐릭터 발소리 레이어
const STEP = {
  soft: (t) => [N(t, 0.05, 500, 200, 1, 0.3)],
  metal: (t) => [T(t, 0.06, 900, 700, 0.12, 'square'), N(t, 0.04, 4000, 2000, 4, 0.3, 'bandpass')],
  bone: (t) => [N(t, 0.04, 2600, 2000, 6, 0.5, 'bandpass')],
  jingle: (t) => [T(t, 0.12, 2637, 2637, 0.08, 'triangle'), T(t + 0.03, 0.12, 3136, 3136, 0.06, 'triangle')],
  squeak: (t) => [T(t, 0.08, 1200, 1800, 0.12, 'sine')],
  magic: (t) => [T(t, 0.15, 1568, 2093, 0.06, 'sine'), N(t, 0.1, 8000, 5000, 3, 0.12, 'highpass')],
  gold: (t) => [T(t, 0.1, 2093, 2093, 0.08, 'triangle'), N(t, 0.05, 6000, 3000, 3, 0.2, 'bandpass')],
};
export function sfxSkinStep(snd, vol) {
  const ctx = actx(); if (!ctx || !STEP[snd]) return;
  O(STEP[snd](ctx.currentTime), 0.18 * vol);
}
