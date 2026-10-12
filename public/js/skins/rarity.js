// 스킨 등급: 일반(외형) / 레어(+소리·효과) / 영웅(+빛나는 재질·처치 효과) / 전설(+흐르는 재질·오라·전용 킬 배너·전용 처치 연출)
export const RARITY = [
  { id: 'common', name: '일반', color: '#c9ced9', w: 55, dup: 100 },
  { id: 'rare', name: '레어', color: '#3d8bf0', w: 28, dup: 400 },
  { id: 'epic', name: '영웅', color: '#b05ae8', w: 13, dup: 1000 },
  { id: 'legend', name: '전설', color: '#f4c22b', w: 4, dup: 2500 },
];
export const RARITY_BY = Object.fromEntries(RARITY.map(r => [r.id, r]));
export const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legend: 3 };
// 등급별 혜택 설명 (총 스킨 / 캐릭터 스킨)
export const RARITY_PERKS = {
  gskin: {
    common: '외형',
    rare: '외형 · 전용 사격음 · 탄 궤적·총구 섬광·타격 효과',
    epic: '레어 + 빛나는 재질 · 처치 효과 · 처치음',
    legend: '영웅 + 흐르는 재질 · 오라 · 전용 킬 배너 · 처치 피니셔 · 장착 연출',
  },
  skin: {
    common: '외형',
    rare: '외형 · 전용 발소리 · 발자국 효과',
    epic: '레어 + 몸 주변 오라',
    legend: '영웅 + 머리 위 빛 고리 · 쓰러짐 연출 · 전용 킬 배너',
  },
};
export function rarityOf(it) { return (it && it.r) || 'common'; }
