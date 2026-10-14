// 시즌 패스: 한 달마다 새 시즌 · 50단계 · 무료/프리미엄 보상
// 경험치(BP)는 매치 끝날 때와 일일 미션 완료 때 들어와요
import { profile, saveProfile, ownedList, GACHA_COST, rollGacha } from './cosmetics.js';
import { CHAR_SKINS } from './skins/charSkins.js';
import { GUN_SKINS } from './skins/gunSkins.js';
import { TITLES } from './titles.js';

export const TIERS = 50, TIER_XP = 500, PREMIUM_GOLD = 3000;
const EPOCH = { y: 2026, m: 9 }; // 2026년 10월 = 시즌 1 (월은 0부터)
const NAMES = ['픽셀 개막', '불꽃 전선', '얼음 왕국', '네온 시티', '사막의 폭풍', '심해 작전'];

export function currentSeason(now) {
  const d = now ? new Date(now) : new Date();
  const n = (d.getFullYear() - EPOCH.y) * 12 + d.getMonth() - EPOCH.m + 1;
  const start = new Date(EPOCH.y, EPOCH.m + n - 1, 1), end = new Date(EPOCH.y, EPOCH.m + n, 1);
  return { n: Math.max(1, n), name: NAMES[(Math.max(1, n) - 1) % NAMES.length], start: +start, end: +end };
}

// 보상: { type: coins|gold|skin|gskin|title|gacha, v }
// 시즌 전용 아이템은 시즌 1 것만 있어요 (다음 시즌엔 코인·골드·뽑기로 대체)
const SPECIAL = {
  1: {
    free: { 10: { type: 'gskin', v: 's1_stripe' }, 20: { type: 'title', v: 's1_pioneer' }, 30: { type: 'skin', v: 's1_agent' }, 40: { type: 'gold', v: 50 }, 50: { type: 'title', v: 's1_champ' } },
    prem: { 1: { type: 'gskin', v: 's1_neon' }, 10: { type: 'skin', v: 's1_ranger' }, 20: { type: 'gacha', v: 3 }, 30: { type: 'gskin', v: 's1_crown' }, 40: { type: 'gold', v: 100 }, 50: { type: 'skin', v: 's1_lord' } },
  },
};
export function reward(season, tier, track) {
  const sp = SPECIAL[season] && SPECIAL[season][track][tier];
  if (sp) return sp;
  if (track === 'free') return tier % 5 === 0 ? { type: 'gold', v: 10 } : { type: 'coins', v: 150 };
  if (tier % 10 === 0) return { type: 'gacha', v: 2 };
  return tier % 5 === 0 ? { type: 'gold', v: 20 } : { type: 'coins', v: 300 };
}
export function rewardName(rw) {
  switch (rw.type) {
    case 'coins': return `${rw.v} 코인`;
    case 'gold': return `${rw.v} 골드`;
    case 'gacha': return `골드 뽑기 ${rw.v}번`;
    case 'skin': return (CHAR_SKINS[rw.v] || {}).name || rw.v;
    case 'gskin': return (GUN_SKINS[rw.v] || {}).name || rw.v;
    case 'title': return `칭호 [${(TITLES[rw.v] || {}).name || rw.v}]`;
  }
  return '';
}

export function bp() {
  const s = currentSeason();
  if (!profile.bp || profile.bp.s !== s.n) profile.bp = { s: s.n, xp: 0, prem: false, got: { free: [], prem: [] } };
  return profile.bp;
}
export const bpTier = () => Math.min(TIERS, Math.floor(bp().xp / TIER_XP));
// 매치 보상 BP
export function grantBpMatch({ kills, win, ranked }) {
  const xp = 120 + kills * 12 + (win ? 80 : 0) + (ranked ? 60 : 0);
  return addBp(xp);
}
export function addBp(xp) {
  const b = bp(), before = bpTier();
  b.xp += xp; saveProfile();
  return { xp, before, after: bpTier() };
}
export function buyPremium() {
  const b = bp();
  if (b.prem) return 'have';
  if (profile.gold < PREMIUM_GOLD) return 'gold';
  profile.gold -= PREMIUM_GOLD; b.prem = true; saveProfile();
  return 'ok';
}
// 보상 받기 → 받은 보상 설명 목록
export function claim(tier, track) {
  const b = bp();
  if (tier > bpTier() || (track === 'prem' && !b.prem) || b.got[track].includes(tier)) return null;
  b.got[track].push(tier);
  const rw = reward(b.s, tier, track), out = [rewardName(rw)];
  if (rw.type === 'coins') profile.coins += rw.v;
  else if (rw.type === 'gold') profile.gold += rw.v;
  else if (rw.type === 'skin' || rw.type === 'gskin') { const own = ownedList(rw.type); if (!own.includes(rw.v)) own.push(rw.v); }
  else if (rw.type === 'title') { if (!Array.isArray(profile.titles)) profile.titles = []; if (!profile.titles.includes(rw.v)) profile.titles.push(rw.v); }
  else if (rw.type === 'gacha') { out.length = 0; for (let i = 0; i < rw.v; i++) { profile.gold += GACHA_COST; const g = rollGacha(); if (g && g.it) out.push(g.it.name + (g.dup ? ' (중복 → 코인)' : '')); } }
  saveProfile();
  return out;
}
export function claimAll() {
  const b = bp(), out = [];
  for (let t = 1; t <= bpTier(); t++) for (const tr of ['free', 'prem']) { const r = claim(t, tr); if (r) out.push(...r); }
  void b;
  return out;
}
export function unclaimed() {
  const b = bp(); let n = 0;
  for (let t = 1; t <= bpTier(); t++) { if (!b.got.free.includes(t)) n++; if (b.prem && !b.got.prem.includes(t)) n++; }
  return n;
}
