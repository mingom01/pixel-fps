// 캐릭터 스킨 카탈로그 (외형 그림은 tex.js 의 skinSpec)
//  fx (레어+): step 발소리 · dust 발자국 먼지 색
//  aura (영웅+): kind / colors — 몸 주변을 떠도는 입자
//  halo (전설): 머리 위를 도는 빛 고리 · death: 쓰러질 때 터지는 색 · banner: 전용 킬 배너
export const CHAR_SKINS = {
  default: { name: '기본', r: 'common', price: 0, lv: 1 },

  /* ---------- 일반 ---------- */
  soldier: { name: '군인', r: 'common', price: 300, lv: 1 },
  police: { name: '경찰', r: 'common', price: 350, lv: 1 },
  pirate: { name: '해적', r: 'common', price: 400, lv: 2 },
  firefighter: { name: '소방관', r: 'common', price: 400, lv: 2 },
  zombie: { name: '좀비', r: 'common', price: 450, lv: 3 },
  cowboy: { name: '카우보이', r: 'common', price: 450, lv: 3 },
  panda: { name: '판다', r: 'common', price: 500, lv: 4 },

  /* ---------- 레어: 외형 + 발소리 + 발자국 효과 ---------- */
  ninja: { name: '닌자', r: 'rare', price: 1200, lv: 4, fx: { step: 'soft', dust: 0x2a2a3a } },
  pumpkin: { name: '호박머리', r: 'rare', price: 1300, lv: 5, fx: { step: 'squeak', dust: 0xff8a20 } },
  clown: { name: '광대', r: 'rare', price: 1300, lv: 5, fx: { step: 'squeak', dust: 0xff6af0 } },
  santa: { name: '산타', r: 'rare', price: 1500, lv: 5, fx: { step: 'jingle', dust: 0xffffff } },
  skeleton: { name: '해골', r: 'rare', price: 1600, lv: 6, fx: { step: 'bone', dust: 0xe8e0c8 } },
  knight: { name: '기사', r: 'rare', price: 1800, lv: 6, fx: { step: 'metal', dust: 0xa8b0b8 } },

  /* ---------- 영웅: 레어 + 오라 ---------- */
  robot: { name: '로봇', r: 'epic', price: 3500, lv: 7, fx: { step: 'metal', dust: 0x3af0ff }, aura: { kind: 'spark', colors: [0x3af0ff, 0xffffff] } },
  astro: { name: '우주인', r: 'epic', price: 4000, lv: 8, fx: { step: 'soft', dust: 0xc8d8ff }, aura: { kind: 'star', colors: [0xffffff, 0x8ad8ff] } },
  wizard: { name: '마법사', r: 'epic', price: 4200, lv: 8, fx: { step: 'magic', dust: 0xb08aff }, aura: { kind: 'arcane', colors: [0xb08aff, 0x5ac8ff, 0xffffff] } },
  alien: { name: '외계인', r: 'epic', price: 4500, lv: 9, fx: { step: 'squeak', dust: 0x7aff5a }, aura: { kind: 'spark', colors: [0x7aff5a, 0xd0ff40] } },
  samurai: { name: '사무라이', r: 'epic', price: 4800, lv: 10, fx: { step: 'soft', dust: 0xffb8d8 }, aura: { kind: 'petal', colors: [0xffb8d8, 0xff8ab8, 0xffffff] } },
  king: { name: '임금님', r: 'epic', price: 5000, lv: 11, fx: { step: 'gold', dust: 0xffd84a }, aura: { kind: 'star', colors: [0xffd84a, 0xfff2b0] } },
  hero: { name: '슈퍼히어로', r: 'epic', price: 5000, lv: 12, fx: { step: 'metal', dust: 0xe2483a }, aura: { kind: 'spark', colors: [0xe2483a, 0x3d8bf0, 0xffd84a] } },

  /* ---------- 전설: 영웅 + 빛 고리 + 쓰러짐 연출 + 전용 킬 배너 ---------- */
  shadow: { name: '그림자 암살자', r: 'legend', gold: 150, lv: 1, fx: { step: 'soft', dust: 0x3a1a5a },
    aura: { kind: 'smoke', colors: [0x2a1040, 0x6a3ad0, 0x120818] }, halo: 0x8a5aff, death: [0x8a5aff, 0x2a1040, 0x000000],
    banner: { main: '#c8a8ff', accent: '#5a2a9a', glow: 'rgba(120,60,220,0.7)' } },
  dragon: { name: '드래곤 전사', r: 'legend', gold: 250, lv: 1, fx: { step: 'metal', dust: 0xff7a20 },
    aura: { kind: 'ember', colors: [0xff5a10, 0xffb020, 0xffe060] }, halo: 0xff8a20, death: [0xff5a10, 0xffd040, 0x3a1408],
    banner: { main: '#ff9a30', accent: '#a01818', glow: 'rgba(255,110,30,0.7)' } },
  golden: { name: '황금 전사', r: 'legend', gold: 300, lv: 1, fx: { step: 'gold', dust: 0xffd84a },
    aura: { kind: 'star', colors: [0xffd84a, 0xffffff, 0xfff2b0] }, halo: 0xffe680, death: [0xffd84a, 0xffffff, 0xd4a520],
    banner: { main: '#ffe680', accent: '#d4a520', glow: 'rgba(255,215,90,0.75)' } },
};
