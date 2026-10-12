// 발로란트식 킬 배너: 화면 아래 가운데 엠블럼, 연속 킬 수만큼 원 둘레에 날개 장식이 붙어요
const NS = 'http://www.w3.org/2000/svg';
let host = null, hideT = 0;

// 연속 킬 단계별 색 (스킨이 theme 으로 덮어쓸 수 있어요)
const TIERS = [
  { min: 1, main: '#f4f1e6', accent: '#9aa3bf', glow: 'rgba(255,255,255,0.35)' },
  { min: 3, main: '#6af0ff', accent: '#2a8fd0', glow: 'rgba(106,240,255,0.45)' },
  { min: 5, main: '#d68aff', accent: '#8a3ad0', glow: 'rgba(214,138,255,0.5)' },
  { min: 7, main: '#ffd84a', accent: '#d08a10', glow: 'rgba(255,216,74,0.6)' },
];
const tierOf = (n) => TIERS.reduce((t, x) => (n >= x.min ? x : t), TIERS[0]);

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// 원 둘레 장식: n개의 칼날이 위쪽부터 좌우 대칭으로 채워짐 (최대 10개)
const SLOTS = [0, -36, 36, -72, 72, -108, 108, -144, 144, 180];
function blade(g, ang, i, col, big) {
  const b = el('g', { class: 'kb-blade', style: `animation-delay:${0.05 + i * 0.045}s` }, el('g', { transform: `rotate(${ang} 60 60)` }, g));
  const tip = big ? 1 : 5;
  el('path', { d: `M60 ${tip} L68 17 L60 29 L52 17 Z`, fill: col.main, stroke: '#0b0d14', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, b);
  el('path', { d: `M60 ${tip + 2} L60 28 L52 17 Z`, fill: col.accent, opacity: 0.85 }, b);
}

function emblem(svg, col, hs) {
  // 바깥 링
  el('circle', { cx: 60, cy: 60, r: 33, fill: 'rgba(10,12,20,0.78)', stroke: col.main, 'stroke-width': 3 }, svg);
  el('circle', { cx: 60, cy: 60, r: 28, fill: 'none', stroke: col.accent, 'stroke-width': 1.5, 'stroke-dasharray': '4 3', class: 'kb-spin' }, svg);
  // 가운데 픽셀 해골
  const px = [
    '..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', 'XX..X..XX', 'XX..X..XX', 'XXXXXXXXX', '.XXX.XXX.', '..X.X.X..', '..XXXXX..',
  ];
  const g = el('g', { transform: 'translate(48.75 48.75)' }, svg);
  px.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') el('rect', { x: x * 2.5, y: y * 2.5, width: 2.5, height: 2.5, fill: hs ? '#ff5a4a' : col.main }, g); }));
}

export function showKillBanner({ streak, hs, theme }) {
  if (!host) host = document.getElementById('killBanner');
  if (!host) return;
  const n = Math.max(1, streak | 0), col = Object.assign({}, tierOf(n), theme || {});
  host.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'kb-wrap';
  wrap.style.setProperty('--kb-glow', col.glow);
  const svg = el('svg', { viewBox: '0 0 120 120', width: 140, height: 140, class: 'kb-svg' });
  const blades = el('g', {}, svg);
  for (let i = 0; i < Math.min(n, SLOTS.length); i++) blade(blades, SLOTS[i], i, col, n >= 5);
  emblem(svg, col, hs);
  wrap.appendChild(svg);
  const lbl = document.createElement('div'); lbl.className = 'kb-lbl';
  lbl.innerHTML = `${hs ? '<span class="kb-hs">헤드샷</span> ' : ''}${n >= 2 ? `<b>${n}</b> 연속 처치` : '처치'}`;
  lbl.style.color = col.main;
  wrap.appendChild(lbl);
  host.appendChild(wrap);
  clearTimeout(hideT);
  hideT = setTimeout(() => wrap.classList.add('out'), 2200);
}
export function clearKillBanner() { if (host) host.innerHTML = ''; clearTimeout(hideT); }
