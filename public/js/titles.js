// 칭호: 레벨·업적으로 얻거나 코인/골드로 구매. 이름 옆(대기실·점수판·결과·처치 화면)에 표시
import { profile, saveProfile, myLevel } from './cosmetics.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// r: common 일반 / rare 레어 / epic 영웅 / legend 전설
export const TITLES = {
  rookie: { name: '신병', r: 'common', req: {} },
  lv5: { name: '견습 총잡이', r: 'common', req: { lv: 5 } },
  lv10: { name: '베테랑', r: 'rare', req: { lv: 10 } },
  lv20: { name: '엘리트', r: 'epic', req: { lv: 20 } },
  lv30: { name: '전설의 용병', r: 'legend', req: { lv: 30 } },
  k1: { name: '첫 사냥꾼', r: 'common', req: { ach: 'k1' } },
  w1: { name: '승리의 맛', r: 'common', req: { ach: 'w1' } },
  k100: { name: '백전노장', r: 'rare', req: { ach: 'k100' } },
  hs50: { name: '명사수', r: 'rare', req: { ach: 'hs50' } },
  crate20: { name: '보급왕', r: 'rare', req: { ach: 'crate20' } },
  def5: { name: '해체반장', r: 'rare', req: { ach: 'def5' } },
  plant10: { name: '폭파 전문가', r: 'rare', req: { ach: 'plant10' } },
  k500: { name: '학살자', r: 'epic', req: { ach: 'k500' } },
  hs200: { name: '저격의 신', r: 'epic', req: { ach: 'hs200' } },
  penta: { name: '펜타킬러', r: 'epic', req: { ach: 'penta' } },
  st10: { name: '멈출 수 없는 자', r: 'epic', req: { ach: 'st10' } },
  allmodes: { name: '만능 플레이어', r: 'epic', req: { ach: 'allmodes' } },
  k1000: { name: '전설의 총잡이', r: 'legend', req: { ach: 'k1000' } },
  w100: { name: '챔피언', r: 'legend', req: { ach: 'w100' } },
  pixel: { name: '픽셀 장인', r: 'common', req: { coins: 600 } },
  camper: { name: '프로 캠퍼', r: 'common', req: { coins: 600 } },
  hunter: { name: '헤드헌터', r: 'rare', req: { coins: 1800 } },
  shadow: { name: '그림자', r: 'rare', req: { coins: 2200 } },
  storm: { name: '폭풍의 눈', r: 'epic', req: { coins: 4500 } },
  reaper: { name: '사신', r: 'epic', req: { coins: 5000 } },
  immortal: { name: '불멸자', r: 'legend', req: { gold: 150 } },
  godhand: { name: '신의 손', r: 'legend', req: { gold: 250 } },
  king: { name: '픽셀의 왕', r: 'legend', req: { gold: 400 } },
  // 시즌 패스 보상
  s1_pioneer: { name: 'S1 개척자', r: 'rare', req: { bp: 1 } },
  s1_champ: { name: 'S1 정복자', r: 'legend', req: { bp: 1 } },
  // 경쟁전 최고 티어
  rk_gold: { name: '골드 랭커', r: 'rare', req: { rp: 600 } },
  rk_diamond: { name: '다이아 랭커', r: 'epic', req: { rp: 1200 } },
  rk_god: { name: '신', r: 'legend', req: { rp: 1800 } },
};

function list() { if (!Array.isArray(profile.titles)) profile.titles = []; return profile.titles; }
export function titleOwned(id) {
  const t = TITLES[id]; if (!t) return false;
  const q = t.req;
  if (q.lv) return myLevel() >= q.lv;
  if (q.ach) return !!(profile.ach && profile.ach[q.ach]);
  if (q.coins || q.gold || q.bp) return list().includes(id);
  if (q.rp) return ((profile.ranked && profile.ranked.best) || 0) >= q.rp;
  return true;
}
export function titleHow(id) {
  const q = TITLES[id].req;
  if (q.lv) return `Lv.${q.lv} 달성`;
  if (q.ach) return '업적 달성 시 획득';
  if (q.coins) return `${q.coins} 코인`;
  if (q.gold) return `${q.gold} 골드`;
  if (q.bp) return `시즌 ${q.bp} 패스 보상`;
  if (q.rp) return `경쟁전 최고 ${window.SH.RANKED.info(q.rp).name} 달성`;
  return '기본 칭호';
}
export function buyTitle(id) {
  const t = TITLES[id]; if (!t) return 'bad';
  if (titleOwned(id)) return 'have';
  const q = t.req;
  if (q.coins) { if (profile.coins < q.coins) return 'coins'; profile.coins -= q.coins; }
  else if (q.gold) { if (profile.gold < q.gold) return 'gold'; profile.gold -= q.gold; }
  else return 'locked';
  list().push(id); saveProfile();
  return 'ok';
}
export function equipTitle(id) { if (titleOwned(id)) { profile.title = id; saveProfile(); return true; } return false; }
export function myTitle() { return TITLES[profile.title] && titleOwned(profile.title) ? profile.title : 'rookie'; }

// 이름 옆에 붙이는 칭호 배지
export function titleHtml(id) {
  const t = TITLES[id]; if (!t) return '';
  return `<span class="ttl r-${t.r}">${esc(t.name)}</span>`;
}
