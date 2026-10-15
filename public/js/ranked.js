// 경쟁전: 티어 엠블럼(픽셀) · 내 점수 · 결과 표시
// 브론즈 → 실버 → 골드 → 플래티넘 → 다이아 → 왕 → 신
import { profile, saveProfile } from './cosmetics.js';
const { RANKED } = window.SH;

export function myRanked() {
  if (!profile.ranked || typeof profile.ranked !== 'object') profile.ranked = { rp: 0, games: 0, wins: 0, best: 0 };
  return profile.ranked;
}
export const rankInfo = (rp) => RANKED.info(rp);

/* ---------- 티어 보상 ----------
   한 단계(III → II 등) 오를 때마다: 300 코인 + 10 골드
   새 티어에 처음 오르면: 티어 총 스킨 + 티어 총기 장식 + 골드 (브론즈는 장식만) */
export const TIER_SKIN = { silver: 'rk_silver', gold: 'rk_gold', plat: 'rk_plat', diamond: 'rk_diamond', king: 'rk_king', god: 'rk_god' };
export const TIER_GOLD = { silver: 30, gold: 50, plat: 80, diamond: 120, king: 200, god: 400 };
const divIndex = (rp) => { const i = RANKED.info(rp); return i.tier.id === 'god' ? i.ti * 3 : i.ti * 3 + (2 - i.div); };
// 지금까지 받은 보상보다 높은 단계에 오르면 지급 → 받은 보상 설명 목록
export function grantRankRewards() {
  const R = myRanked(), got = [];
  const now = divIndex(R.best || R.rp);
  if (R.claimed == null) R.claimed = 0;
  if (!Array.isArray(profile.charms)) profile.charms = [];
  if (!profile.charms.includes('c_bronze')) { profile.charms.push('c_bronze'); if (!profile.charm) profile.charm = 'c_bronze'; got.push('브론즈 장식'); }
  for (let i = R.claimed + 1; i <= now; i++) {
    const ti = Math.floor(i / 3), first = i % 3 === 0, T = RANKED.TIERS[ti];
    profile.coins += 300; profile.gold += 10;
    if (first) {
      const sk = TIER_SKIN[T.id], ch = 'c_' + T.id;
      if (sk && !profile.gskins.includes(sk)) profile.gskins.push(sk);
      if (!profile.charms.includes(ch)) profile.charms.push(ch);
      profile.gold += TIER_GOLD[T.id] || 0;
      got.push(`${T.name} 달성! 총 스킨 [랭크 ${T.name}] · ${T.name} 장식 · 골드 ${(TIER_GOLD[T.id] || 0) + 10}`);
    } else got.push(`${RANKED.info(i * 100).name} 승급 · 300 코인 + 10 골드`);
  }
  R.claimed = Math.max(R.claimed, now);
  saveProfile();
  return got;
}

// 결과 적용 (서버가 계산한 점수 변화)
export function applyRanked(r) {
  const R = myRanked(), before = R.rp;
  R.rp = Math.max(0, R.rp + r.d); R.games++; if (r.win) R.wins++;
  R.best = Math.max(R.best || 0, R.rp);
  saveProfile();
  return { before, after: R.rp, up: RANKED.info(R.rp).ti > RANKED.info(before).ti || (RANKED.info(R.rp).ti === RANKED.info(before).ti && RANKED.info(R.rp).div < RANKED.info(before).div) };
}
// 경쟁전 도중 나가면 감점
export function leavePenalty() { const R = myRanked(); R.rp = Math.max(0, R.rp - 15); R.games++; saveProfile(); }

/* ---------- 엠블럼 (16x16 픽셀) ---------- */
const SHAPES = {
  bronze: ['................', '....XXXXXXXX....', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '....XXXXXXXX....', '....XXXXXXXX....', '.....XXXXXX.....', '......XXXX......', '.......XX.......', '................', '................', '................'],
  silver: ['................', '...X.XXXXXX.X...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '....XXXXXXXX....', '....XXXXXXXX....', '.....XXXXXX.....', '......XXXX......', '.......XX.......', '................', '................', '................'],
  gold: ['.......XX.......', '..X..XXXXXX..X..', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '...XXXXXXXXXX...', '....XXXXXXXX....', '....XXXXXXXX....', '.....XXXXXX.....', '......XXXX......', '.......XX.......', '................', '................', '................'],
  plat: ['.......XX.......', '......XXXX......', '.....XXXXXX.....', '....XXXXXXXX....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '.XXXXXXXXXXXXXX.', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...', '....XXXXXXXX....', '.....XXXXXX.....', '......XXXX......', '.......XX.......', '................', '................', '................'],
  diamond: ['....XXXXXXXX....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '.XXXXXXXXXXXXXX.', 'XXXXXXXXXXXXXXXX', '.XXXXXXXXXXXXXX.', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...', '....XXXXXXXX....', '.....XXXXXX.....', '......XXXX......', '.......XX.......', '................', '................', '................', '................'],
  king: ['X..X..XXXX..X..X', 'XX.XX.XXXX.XX.XX', 'XXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXX', '.XXXXXXXXXXXXXX.', '.XXXXXXXXXXXXXX.', '..XXXXXXXXXXXX..', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...', '....XXXXXXXX....', '.....XXXXXX.....', '......XXXX......', '.......XX.......', '................', '................', '................'],
  god: ['.....XXXXXX.....', '....X......X....', '.....XXXXXX.....', 'XX....XXXX....XX', 'XXX..XXXXXX..XXX', 'XXXXXXXXXXXXXXXX', '.XXXXXXXXXXXXXX.', '..XXXXXXXXXXXX..', '...XXXXXXXXXX...', '....XXXXXXXX....', '.....XXXXXX.....', '......XXXX......', '.......XX.......', '................', '................', '................'],
};
const cache = {};
export function rankIcon(rp, px) {
  px = px || 3;
  const inf = RANKED.info(rp), id = inf.tier.id, key = id + inf.div + px;
  if (cache[key]) return cache[key];
  const rows = SHAPES[id], c = document.createElement('canvas'); c.width = c.height = 18 * px;
  const x = c.getContext('2d');
  const at = (xx, yy) => rows[yy] && rows[yy][xx] === 'X';
  // 외곽선
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) if (at(xx, yy)) { x.fillStyle = '#0b0c0e'; x.fillRect(xx * px, yy * px, px * 3, px * 3); }
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) {
    if (!at(xx, yy)) continue;
    const edge = !at(xx - 1, yy) || !at(xx + 1, yy) || !at(xx, yy - 1) || !at(xx, yy + 1);
    const hi = yy < 5 && xx < 9;
    x.fillStyle = edge ? inf.tier.dark : hi ? '#ffffff' : inf.tier.color;
    if (hi && !edge) x.globalAlpha = 0.55;
    x.fillRect((xx + 1) * px, (yy + 1) * px, px, px);
    x.globalAlpha = 1;
    if (hi && !edge) { x.fillStyle = inf.tier.color; x.globalAlpha = 0.6; x.fillRect((xx + 1) * px, (yy + 1) * px, px, px); x.globalAlpha = 1; }
  }
  // 단계 표시 (III → 줄 3개, I → 1개)
  if (inf.tier.id !== 'god') {
    const n = 3 - inf.div;
    for (let i = 0; i < n; i++) { x.fillStyle = '#0b0c0e'; x.fillRect((6 + i * 2.2) * px, 8 * px, px * 1.6, px * 2.4); x.fillStyle = '#ffffff'; x.fillRect((6.2 + i * 2.2) * px, 8.2 * px, px * 1.2, px * 2); }
  } else { x.fillStyle = '#ffd84a'; x.fillRect(7 * px, 7 * px, px * 4, px * 3); }
  return (cache[key] = c.toDataURL());
}
export function rankBadge(rp, small) {
  if (rp == null) return '';
  const inf = RANKED.info(rp);
  return `<span class="rkb ${small ? 'sm' : ''}" style="color:${inf.tier.color}"><img src="${rankIcon(rp, small ? 1 : 2)}">${inf.name}</span>`;
}
// 메뉴 카드
export function rankCardHtml() {
  const R = myRanked(), inf = RANKED.info(R.rp);
  const bar = inf.need ? `<div class="rk-bar"><i style="width:${inf.pt}%;background:${inf.tier.color}"></i></div><div class="dim">${inf.pt} / 100 RP</div>` : `<div class="dim">${R.rp} RP · 최고 티어</div>`;
  return `<img class="rk-ico" src="${rankIcon(R.rp, 3)}"><div class="rk-t"><b style="color:${inf.tier.color}">${inf.name}</b>${bar}<div class="dim">${R.games}판 · ${R.wins}승</div></div>`;
}
