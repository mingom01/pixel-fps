// 총 스킨 카탈로그
//  metal: [어두운, 중간, 밝은] 금속 / body: [몸체, 몸체2] / camo: 위장 무늬 색 / acc: 강조 부품(빨강·노랑·청록) 색
//  fx (레어+): tracer 탄 궤적 · flash 총구 섬광 · impact 타격 파편 · snd 사격음 레이어
//  glow (영웅+): mode pulse(맥박) · flow(흐르는 띠) · rainbow(무지개) · stars(별빛), c1/c2 색
//  aura (전설): 총 주변 입자 · banner: 전용 킬 배너 색 · finisher: 처치 피니셔
export const GUN_SKINS = {
  default: { name: '기본', r: 'common', price: 0, lv: 1 },

  /* ---------- 일반: 외형만 ---------- */
  camo: { name: '정글 위장', r: 'common', price: 300, lv: 1, camo: [0x4b5320, 0x6b5a3a, 0x2f3a1e, 0x8a7a5a] },
  desert: { name: '사막 위장', r: 'common', price: 300, lv: 1, camo: [0xc2a878, 0x9a7a4a, 0xe0c890, 0x6b5a3a] },
  arctic: { name: '설원 위장', r: 'common', price: 350, lv: 1, camo: [0xe8eef4, 0xb8c4d0, 0x8a9aaa, 0xffffff] },
  urban: { name: '도심 위장', r: 'common', price: 350, lv: 2, camo: [0x5a5e66, 0x8a8e96, 0x3a3e46, 0xb4b8c0] },
  pink: { name: '핑크', r: 'common', price: 400, lv: 2, metal: [0xb04a82, 0xd45a9a, 0xffc4e0], body: [0xf28bc0, 0xe0609e] },
  choco: { name: '초콜릿', r: 'common', price: 400, lv: 2, metal: [0x3a2010, 0x5a3018, 0xf0e0c0], body: [0x6b3a1a, 0x8a5028] },
  mint: { name: '민트초코', r: 'common', price: 450, lv: 3, metal: [0x3a2414, 0x5a3a22, 0xd8fff0], body: [0x7ae8c8, 0x4ac8a4] },
  blood: { name: '블러드', r: 'common', price: 500, lv: 3, metal: [0x1a0a0a, 0x3a1010, 0xd02020], body: [0x8a1010, 0xb02020] },

  /* ---------- 레어: 외형 + 소리 + 효과 ---------- */
  gold: { name: '황금', r: 'rare', price: 1200, lv: 4, metal: [0x9a6e10, 0xd4a520, 0xffe27a], body: [0xc9971f, 0xe6b830], acc: 0xfff2b0,
    fx: { tracer: 0xffd84a, flash: 0xffe680, impact: 0xffd84a, snd: 'chime' } },
  fire: { name: '불꽃', r: 'rare', price: 1400, lv: 5, metal: [0x2a1a14, 0x5a2a14, 0xff8a20], body: [0xd2401a, 0xff8a20], acc: 0xffd040,
    fx: { tracer: 0xff7a1a, flash: 0xff6a10, impact: 0xff8a20, snd: 'ember' } },
  ice: { name: '얼음', r: 'rare', price: 1400, lv: 5, metal: [0x6aa8d8, 0x9fd0f0, 0xe8f8ff], body: [0xbfe6ff, 0x8ac6ef], acc: 0xffffff,
    fx: { tracer: 0xbff0ff, flash: 0xd8f8ff, impact: 0xe8f8ff, snd: 'frost' } },
  toxic: { name: '독성', r: 'rare', price: 1500, lv: 6, metal: [0x1a2a14, 0x2f4a1a, 0x9be03a], body: [0x6ac02a, 0x3a7a1a], acc: 0xd0ff40,
    fx: { tracer: 0x9be03a, flash: 0xb0ff50, impact: 0x7ad02a, snd: 'bubble' } },
  ocean: { name: '오션', r: 'rare', price: 1600, lv: 6, metal: [0x0a2a4a, 0x1a4a7a, 0x6af0ff], body: [0x2a7ac0, 0x1a5a9a], acc: 0x6af0ff,
    fx: { tracer: 0x6ad0ff, flash: 0x8ae0ff, impact: 0x4ab0ff, snd: 'splash' } },
  bone: { name: '해골', r: 'rare', price: 1800, lv: 7, metal: [0x2a2a2a, 0x3a3a3a, 0xe8e0c8], body: [0xe8e0c8, 0xc8c0a8], acc: 0x9a2020,
    fx: { tracer: 0xe8e0c8, flash: 0xfff4d8, impact: 0xe8e0c8, snd: 'bone' } },

  /* ---------- 영웅: 레어 + 빛나는 재질 + 처치 효과 ---------- */
  neon: { name: '네온 러시', r: 'epic', price: 3500, lv: 8, metal: [0x0c0f14, 0x161c26, 0x3af0ff], body: [0x10141c, 0x1a2230], acc: 0x22ff9a,
    fx: { tracer: 0x3af0ff, flash: 0x7affd8, impact: 0x22ff9a, snd: 'laser', kill: [0x3af0ff, 0x22ff9a, 0xffffff] },
    glow: { mode: 'pulse', c1: 0x3af0ff, c2: 0x22ff9a } },
  cyber: { name: '사이버펑크', r: 'epic', price: 4000, lv: 9, metal: [0x1a0a2a, 0x2a1a4a, 0xff3af0], body: [0x24124a, 0x3a1a6a], acc: 0x2af0ff,
    fx: { tracer: 0xff3af0, flash: 0xff8af8, impact: 0x2af0ff, snd: 'synth', kill: [0xff3af0, 0x2af0ff, 0x8a3aff] },
    glow: { mode: 'pulse', c1: 0xff3af0, c2: 0x2af0ff } },
  diamond: { name: '다이아몬드', r: 'epic', price: 4500, lv: 10, metal: [0x1f8fa8, 0x5fd3e8, 0xd8fbff], body: [0x3bbcd4, 0x86e6f5], acc: 0xffffff,
    fx: { tracer: 0xb0f4ff, flash: 0xe8fdff, impact: 0xb0f4ff, snd: 'crystal', kill: [0xb0f4ff, 0xffffff, 0x5fd3e8] },
    glow: { mode: 'stars', c1: 0xd8fbff, c2: 0x5fd3e8 } },
  void: { name: '보이드', r: 'epic', price: 4800, lv: 11, metal: [0x08060e, 0x150f24, 0x8a5aff], body: [0x120c20, 0x1e1434], acc: 0xc08aff,
    fx: { tracer: 0x8a5aff, flash: 0xb08aff, impact: 0x6a3ad0, snd: 'void', kill: [0x8a5aff, 0x2a1050, 0xe0c8ff] },
    glow: { mode: 'pulse', c1: 0x8a5aff, c2: 0xff5ae0 } },
  thunder: { name: '썬더볼트', r: 'epic', price: 5000, lv: 12, metal: [0x14182a, 0x24304a, 0xf0f4ff], body: [0x2a3a7a, 0x1a2a5a], acc: 0xffe84a,
    fx: { tracer: 0xf0f8ff, flash: 0xc8e0ff, impact: 0xffe84a, snd: 'thunder', kill: [0xffffff, 0x8ab8ff, 0xffe84a] },
    glow: { mode: 'flow', c1: 0x8ab8ff, c2: 0xffe84a, speed: 6 } },

  /* ---------- 전설: 영웅 + 흐르는 재질 + 오라 + 전용 킬 배너 + 피니셔 ---------- */
  lava: { name: '용암 심장', r: 'legend', gold: 150, lv: 1, metal: [0x140806, 0x2a120a, 0xffb020], body: [0x3a1408, 0x5a1a08], acc: 0xffe060,
    fx: { tracer: 0xff8a20, flash: 0xffb040, impact: 0xff6a10, snd: 'magma', kill: [0xff4a10, 0xffb020, 0xffe060, 0x3a1408] },
    glow: { mode: 'flow', c1: 0xff3a08, c2: 0xffc040, speed: 2.2 },
    aura: { kind: 'ember', colors: [0xff6a10, 0xffb020, 0xffe060] },
    banner: { main: '#ffb020', accent: '#ff4a10', glow: 'rgba(255,120,30,0.7)' }, finisher: 'eruption' },
  galaxy: { name: '은하수', r: 'legend', gold: 200, lv: 1, metal: [0x0a0618, 0x1a1040, 0xe0d0ff], body: [0x1a0a40, 0x2a1060], acc: 0xffffff,
    fx: { tracer: 0xc8a8ff, flash: 0xe0d0ff, impact: 0xa88aff, snd: 'cosmic', kill: [0x8a5ae0, 0xffffff, 0x5ac8ff, 0xff8ae0] },
    glow: { mode: 'stars', c1: 0x8a5ae0, c2: 0x5ac8ff, speed: 1.4 },
    aura: { kind: 'star', colors: [0xffffff, 0xc8a8ff, 0x8ad8ff] },
    banner: { main: '#d8c8ff', accent: '#8a5ae0', glow: 'rgba(160,120,255,0.75)' }, finisher: 'supernova' },
  prism: { name: '프리즘', r: 'legend', gold: 250, lv: 1, metal: [0x1a1a22, 0x2a2a36, 0xffffff], body: [0xf0f0f8, 0xd8d8e8], acc: 0xffffff,
    fx: { tracer: 'rainbow', flash: 0xffffff, impact: 'rainbow', snd: 'prism', kill: [0xe2483a, 0xf4c22b, 0x4cbf4c, 0x3d8bf0, 0x8b45c9] },
    glow: { mode: 'rainbow', c1: 0xffffff, c2: 0xffffff, speed: 1.6 },
    aura: { kind: 'prism', colors: [0xff5a5a, 0xffd84a, 0x5aff8a, 0x5ab8ff, 0xd85aff] },
    banner: { main: '#ffffff', accent: '#ff8ae0', glow: 'rgba(255,255,255,0.75)' }, finisher: 'refract' },
  dragon: { name: '황룡', r: 'legend', gold: 300, lv: 1, metal: [0x1a1206, 0x4a2a08, 0xffd040], body: [0xa01818, 0xc8a020], acc: 0xffe680,
    fx: { tracer: 0xffc020, flash: 0xffa020, impact: 0xff5020, snd: 'dragon', kill: [0xffd040, 0xff5020, 0xa01818, 0xffffff] },
    glow: { mode: 'flow', c1: 0xffd040, c2: 0xff3a10, speed: 3 },
    aura: { kind: 'ember', colors: [0xffd040, 0xff7a20, 0xffffff] },
    banner: { main: '#ffd040', accent: '#c81a1a', glow: 'rgba(255,190,40,0.75)' }, finisher: 'dragonfire' },
  aurora: { name: '오로라', r: 'legend', gold: 280, lv: 1, metal: [0x081420, 0x10283a, 0xc8fff0], body: [0x0e2a3a, 0x124050], acc: 0xc8fff0,
    fx: { tracer: 0x7affc8, flash: 0xb0ffe8, impact: 0x7affc8, snd: 'aurora', kill: [0x5affb0, 0x8a7aff, 0xc8fff0] },
    glow: { mode: 'flow', c1: 0x3affa0, c2: 0x9a6aff, speed: 1.5 },
    aura: { kind: 'snow', colors: [0xffffff, 0xb0ffe8, 0xc8b8ff] },
    banner: { main: '#a8ffe0', accent: '#8a6aff', glow: 'rgba(120,255,200,0.7)' }, finisher: 'frostbloom' },
};

export const gunFx = (id) => (GUN_SKINS[id] && GUN_SKINS[id].fx) || null;
