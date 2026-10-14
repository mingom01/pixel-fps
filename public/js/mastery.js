// 무기 숙련도: 무기마다 처치 수로 레벨이 오르고, 레벨마다 코인·골드 + 그 무기 전용 위장
import { profile, saveProfile, stats } from './cosmetics.js';

export const LEVELS = [
  { kills: 0, name: '없음', color: '#7a8090' },
  { kills: 25, name: '브론즈', color: '#c8834a', camo: 'm_bronze', coins: 200 },
  { kills: 75, name: '실버', color: '#c8d0dc', camo: 'm_silver', coins: 400 },
  { kills: 150, name: '골드', color: '#f4c22b', camo: 'm_gold', coins: 600, gold: 10 },
  { kills: 300, name: '다이아', color: '#8ab8ff', camo: 'm_diamond', coins: 900, gold: 25 },
  { kills: 600, name: '암흑 물질', color: '#c08aff', camo: 'm_dark', coins: 1500, gold: 50 },
];
// 숙련도가 있는 무기 (총만)
export const MASTERY_WEAPONS = ['pistol', 'magnum', 'uzi', 'smg', 'shotgun', 'dbarrel', 'rifle', 'carbine', 'burst', 'dmr', 'scout', 'sniper', 'lmg', 'minigun', 'rail', 'rocket', 'knife'];

export function masteryOf(w) {
  const k = (stats.weapons && stats.weapons[w]) || 0;
  let lv = 0; for (let i = 0; i < LEVELS.length; i++) if (k >= LEVELS[i].kills) lv = i;
  const next = LEVELS[lv + 1];
  return { w, kills: k, lv, L: LEVELS[lv], next, pct: next ? (k - LEVELS[lv].kills) / (next.kills - LEVELS[lv].kills) : 1 };
}
function seen() { if (!profile.mastery || typeof profile.mastery !== 'object') profile.mastery = {}; return profile.mastery; }
// 처치 후 호출: 새로 오른 레벨이 있으면 보상 지급하고 알려줌
export function checkMastery(w) {
  if (!MASTERY_WEAPONS.includes(w)) return null;
  const m = masteryOf(w), got = seen(), had = got[w] || 0;
  if (m.lv <= had) return null;
  got[w] = m.lv;
  let coins = 0, gold = 0;
  for (let i = had + 1; i <= m.lv; i++) { coins += LEVELS[i].coins || 0; gold += LEVELS[i].gold || 0; }
  profile.coins += coins; profile.gold += gold;
  saveProfile();
  return { w, lv: m.lv, name: LEVELS[m.lv].name, coins, gold };
}
// 무기별 위장 장착 (profile.wcamo[w] = 'm_gold' ...). null 이면 해제 → 원래 총 스킨
export function wcamo() { if (!profile.wcamo || typeof profile.wcamo !== 'object') profile.wcamo = {}; return profile.wcamo; }
export function setCamo(w, camo) {
  const m = masteryOf(w), c = wcamo();
  if (camo && !LEVELS.some((L, i) => L.camo === camo && i <= m.lv)) return false;
  if (camo) c[w] = camo; else delete c[w];
  saveProfile();
  return true;
}
// 이 무기에 실제로 보일 총 스킨
export function gskinFor(w, base) { const c = profile.wcamo && profile.wcamo[w]; return c || base; }
