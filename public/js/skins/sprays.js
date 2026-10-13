// 스프레이 카탈로그 (픽셀 그림). free 는 처음부터 가짐, 나머지는 골드 뽑기에서 획득
export const SPRAYS = [
  /* ---------- 일반 ---------- */
  { id: 'heart', name: '하트', r: 'common', free: true, rows: ['..RR..RR..', '.RRRRRRRR.', 'RRWRRRRRRR', 'RRRRRRRRRR', 'RRRRRRRRRR', '.RRRRRRRR.', '..RRRRRR..', '...RRRR...', '....RR....'], col: { R: '#e2483a', W: '#ffc0b8' } },
  { id: 'smile', name: '스마일', r: 'common', free: true, rows: ['..YYYYYY..', '.YYYYYYYY.', 'YYKYYYYKYY', 'YYKYYYYKYY', 'YYYYYYYYYY', 'YKYYYYYYKY', 'YYKKKKKKYY', '.YYYYYYYY.', '..YYYYYY..'], col: { Y: '#f4c22b', K: '#3a2400' } },
  { id: 'gg', name: 'GG', r: 'common', rows: ['.GGGG..GGGG.', 'GG....GG....', 'GG.GG.GG.GG.', 'GG..G.GG..G.', '.GGGG..GGGG.'], col: { G: '#7df07d' } },
  { id: 'star', name: '별', r: 'common', rows: ['....Y....', '....Y....', '...YYY...', 'YYYYYYYYY', '.YYYYYYY.', '..YYYYY..', '.YYY.YYY.', 'YY.....YY'], col: { Y: '#ffd84a' } },
  { id: 'cat', name: '고양이', r: 'common', rows: ['K......K', 'KK....KK', 'KKKKKKKK', 'KGKKKKGK', 'KKKKKKKK', 'KKKPPKKK', '.KKKKKK.'], col: { K: '#3a3f4a', G: '#7df07d', P: '#ff9ac0' } },
  { id: 'thumbs', name: '따봉', r: 'common', rows: ['...SS....', '...SS....', '..SSS....', 'SSSSSSSS.', 'BSSSSSSSS', 'BSSSSSSS.', 'BSSSSSSSS', 'BSSSSSSS.', '.SSSSSS..'], col: { S: '#f2c9a0', B: '#3d8bf0' } },
  { id: 'music', name: '음표', r: 'common', rows: ['...KKKKK', '...KKKKK', '...K...K', '...K...K', '...K...K', '.KKK.KKK', 'KKKKKKKK', '.KK..KK.'], col: { K: '#8a5ae0' } },
  { id: 'mushroom', name: '버섯', r: 'common', rows: ['..RRRRR..', '.RWRRRWR.', 'RRRRRRRRR', 'RWRRWRRWR', 'RRRRRRRRR', '...WWW...', '...WKW...', '...WWW...'], col: { R: '#e2483a', W: '#f4f1e6', K: '#3a2400' } },
  { id: 'pizza', name: '피자', r: 'common', rows: ['OOOOOOOOO', 'YYYYYYYYY', '.YRYYYRY.', '.YYYYYYY.', '..YYRYY..', '..YYYYY..', '...YRY...', '...YYY...', '....Y....'], col: { O: '#c8752a', Y: '#f4c22b', R: '#e2483a' } },
  { id: 'moon', name: '초승달', r: 'common', rows: ['..YYYY...', '.YYY.....', 'YYY......', 'YYY......', 'YYY......', 'YYY......', '.YYY.....', '..YYYY...'], col: { Y: '#fff2a0' } },
  /* ---------- 레어 ---------- */
  { id: 'skull', name: '해골', r: 'rare', rows: ['..WWWWWW..', '.WWWWWWWW.', 'WWWWWWWWWW', 'WKKWWWWKKW', 'WKKWWWWKKW', 'WWWWKKWWWW', '.WWWWWWWW.', '..WKWKWK..', '..WWWWWW..'], col: { W: '#f0ead8', K: '#111111' } },
  { id: 'crown', name: '왕관', r: 'rare', rows: ['Y...Y...Y', 'YY.YYY.YY', 'YYYYYYYYY', 'YRYYBYYRY', 'YYYYYYYYY', 'YYYYYYYYY'], col: { Y: '#f4c22b', R: '#e2483a', B: '#3d8bf0' } },
  { id: 'flame', name: '불꽃', r: 'rare', rows: ['....R.....', '...RR..R..', '..RRR.RR..', '.RROR.RRR.', '.ROOORROR.', 'RROOYOOORR', 'ROOYYYOOOR', 'ROOYYYYOOR', '.ROOYYOOR.'], col: { R: '#e2483a', O: '#ff8a20', Y: '#ffd84a' } },
  { id: 'ghost', name: '유령', r: 'rare', rows: ['..WWWWW..', '.WWWWWWW.', 'WWKKWKKWW', 'WWKKWKKWW', 'WWWWWWWWW', 'WWWWWWWWW', 'WWWWWWWWW', 'W.WW.WW.W'], col: { W: '#e8f0ff', K: '#2a2a4a' } },
  { id: 'sword', name: '검', r: 'rare', rows: ['.......LL', '......LWL', '.....LWL.', '....LWL..', '.Y.LWL...', '..YWL....', '..BY.....', '.B..Y....', 'B........'], col: { L: '#9aa1ab', W: '#e8eef4', Y: '#f4c22b', B: '#6b4220' } },
  { id: 'shield', name: '방패', r: 'rare', rows: ['YYYYYYYYY', 'YBBBYRRRY', 'YBBBYRRRY', 'YYYYYYYYY', 'YRRRYBBBY', '.YRRYBBY.', '..YRYBY..', '...YYY...', '....Y....'], col: { Y: '#f4c22b', B: '#3d8bf0', R: '#e2483a' } },
  { id: 'bomb', name: '폭탄', r: 'rare', rows: ['......OY.', '.....K...', '...KKKK..', '..KKKKKK.', '.KKWKKKKK', '.KWKKKKKK', '.KKKKKKKK', '..KKKKKK.', '...KKKK..'], col: { K: '#22252a', W: '#9aa1ab', O: '#ff8a20', Y: '#ffd84a' } },
  { id: 'bolt', name: '번개', r: 'rare', rows: ['....YYY', '...YYY.', '..YYY..', '.YYYYYY', '....YY.', '...YY..', '..YY...', '.YY....', 'Y......'], col: { Y: '#ffe84a' } },
  { id: 'sun', name: '태양', r: 'rare', rows: ['Y...Y...Y', '.Y..Y..Y.', '..OOOOO..', 'YOOYOYOOY', '..OOOOO..', '.YOKKKOY.', '..OOOOO..', '.Y..Y..Y.', 'Y...Y...Y'], col: { Y: '#ffd84a', O: '#ff9a2a', K: '#8a3a00' } },
  { id: 'frog', name: '개구리', r: 'rare', rows: ['.WW...WW.', 'WKWG.GWKW', 'GWWGGGWWG', 'GGGGGGGGG', 'GRRRRRRRG', 'GGGGGGGGG', '.GGGGGGG.', 'GG.....GG'], col: { G: '#4cbf4c', W: '#ffffff', K: '#111111', R: '#c03a3a' } },
  /* ---------- 영웅 ---------- */
  { id: 'gem', name: '다이아몬드', r: 'epic', rows: ['..CCCCC..', '.CWCCCWC.', 'CCCCCCCCC', '.CCCCCCC.', '..CCDCC..', '...CDC...', '....C....'], col: { C: '#5fe3ff', W: '#ffffff', D: '#2a9ab8' } },
  { id: 'rocket', name: '로켓', r: 'epic', rows: ['....R....', '...WWW...', '...WBW...', '...WWW...', '...WWW...', '..RWWWR..', '.RR.W.RR.', '...OYO...', '....O....'], col: { R: '#e2483a', W: '#f0f0f0', B: '#3d8bf0', O: '#ff8a20', Y: '#ffd84a' } },
  { id: 'alien', name: '외계인', r: 'epic', rows: ['..GGGGG..', '.GGGGGGG.', 'GKKGGGKKG', 'GKKKGKKKG', 'GGKGGGKGG', '.GGGGGGG.', '..GGKGG..', '...GGG...'], col: { G: '#7ae05a', K: '#111111' } },
  { id: 'rainbow', name: '무지개', r: 'epic', rows: ['..RRRRR..', '.ROOOOOR.', 'ROYYYYYOR', 'OYGGGGGYO', 'YGB...BGY', 'GB.....BG', 'B.......B'], col: { R: '#e2483a', O: '#ff8a20', Y: '#ffd84a', G: '#4cbf4c', B: '#3d8bf0' } },
  { id: 'panda', name: '판다', r: 'epic', rows: ['KK.....KK', 'KWWWWWWWK', 'WWWWWWWWW', 'WKKWWWKKW', 'WKWWWWWKW', 'WWWWKWWWW', 'WWWWWWWWW', '.WWWWWWW.'], col: { K: '#1a1a1a', W: '#f4f4f4' } },
  { id: 'eyes', name: '눈빛', r: 'epic', rows: ['.WWW.WWW.', 'WWKKWWKKW', 'WWKKWWKKW', '.WWW.WWW.'], col: { W: '#ffffff', K: '#111111' } },
  { id: 'trophy', name: '트로피', r: 'epic', rows: ['YYYYYYYYY', 'Y.YYYYY.Y', 'Y.YYWYY.Y', '.YYYYYYY.', '..YYYYY..', '...YYY...', '....Y....', '..YYYYY..', '.KKKKKKK.'], col: { Y: '#f4c22b', W: '#fff6c8', K: '#5a3a1a' } },
  /* ---------- 전설 ---------- */
  { id: 'dragon', name: '용', r: 'legend', rows: ['R.......R..', 'RR.....RR..', 'RRR...RRRR.', '.RRRRRRYRRR', '..RRRRRRRRR', '..RRRRRRR..', '.RR.OOO.RR.', 'RR..OYO..RR', '....OYO....', '.....O.....'], col: { R: '#c81a1a', Y: '#ffd84a', O: '#ff8a20' } },
  { id: 'cosmos', name: '우주', r: 'legend', rows: ['W.....P...W', '..PPPPPPP..', '.PBBBBBBBP.', 'PBBYBBBWBBP', 'PBBBBBBBBBP', 'PBWBBYBBBBP', '.PBBBBBBBP.', '..PPPPPPP..', 'W...P.....W'], col: { P: '#b05ae8', B: '#1a1050', Y: '#ffd84a', W: '#ffffff' } },
  { id: 'kingcrown', name: '황금 왕관', r: 'legend', rows: ['Y..Y..Y..Y', 'YY.YYYY.YY', 'YYYYYYYYYY', 'YRYYBBYYRY', 'YYYYYYYYYY', 'GGGGGGGGGG', 'YWYWYWYWYW', 'YYYYYYYYYY'], col: { Y: '#ffd040', R: '#e2483a', B: '#3d8bf0', G: '#d4a520', W: '#ffffff' } },
];
export const SPRAY_BY = Object.fromEntries(SPRAYS.map(s => [s.id, s]));
export const FREE_SPRAYS = SPRAYS.filter(s => s.free).map(s => s.id);
// 예전 버전(번호로 저장)의 스프레이 → 새 id
export const OLD_SPRAY_IDS = ['heart', 'skull', 'smile', 'gg', 'crown', 'star', 'flame', 'cat'];

export function sprayCanvas(id, px) {
  const sp = SPRAY_BY[id] || SPRAYS[0], w = Math.max(...sp.rows.map(r => r.length)), h = sp.rows.length, n = Math.max(w, h) + 2;
  const c = document.createElement('canvas'); c.width = c.height = n * (px || 1); const x = c.getContext('2d');
  const ox = Math.floor((n - w) / 2), oy = Math.floor((n - h) / 2);
  sp.rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (sp.col[ch]) { x.fillStyle = sp.col[ch]; x.fillRect((xx + ox) * (px || 1), (yy + oy) * (px || 1), px || 1, px || 1); } }));
  return c;
}
