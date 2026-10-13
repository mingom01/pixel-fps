// 발로란트식 킬 배너: 화면 아래 가운데 엠블럼, 연속 킬 수만큼 원 둘레에 날개 장식이 붙어요
// 일반·레어 스킨은 기본 배너, 영웅은 방패+날개+반짝임, 전설은 광선+왕관+큰 날개+별가루
const NS = 'http://www.w3.org/2000/svg';
let host = null, hideT = 0, uid = 0;

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

// 가운데 픽셀 해골
const SKULL = ['..XXXXX..', '.XXXXXXX.', 'XXXXXXXXX', 'XX..X..XX', 'XX..X..XX', 'XXXXXXXXX', '.XXX.XXX.', '..X.X.X..', '..XXXXX..'];
function skull(svg, fill) {
  const g = el('g', { transform: 'translate(48.75 48.75)' }, svg);
  SKULL.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') el('rect', { x: x * 2.5, y: y * 2.5, width: 2.5, height: 2.5, fill }, g); }));
}
function emblem(svg, col, hs) {
  el('circle', { cx: 60, cy: 60, r: 33, fill: 'rgba(10,12,20,0.78)', stroke: col.main, 'stroke-width': 3 }, svg);
  el('circle', { cx: 60, cy: 60, r: 28, fill: 'none', stroke: col.accent, 'stroke-width': 1.5, 'stroke-dasharray': '4 3', class: 'kb-spin' }, svg);
  skull(svg, hs ? '#ff5a4a' : col.main);
}

// 날개: 왼쪽 깃털 n개 (오른쪽은 좌우 반전)
function wings(svg, col, n, span) {
  for (const side of [-1, 1]) {
    const g = el('g', { class: 'kb-wing', style: `transform-origin:${side < 0 ? 38 : 82}px 60px` }, svg);
    const w = el('g', side > 0 ? { transform: 'translate(120 0) scale(-1 1)' } : {}, g);
    for (let k = n - 1; k >= 0; k--) {
      const ry = 50 + k * 7, tx = 22 - span + k * 5, ty = 34 + k * 13;
      el('path', { d: `M40 ${ry - 4} L${tx} ${ty} L${tx + 7} ${ty + 6} L40 ${ry + 4} Z`, fill: k % 2 ? col.accent : col.main, stroke: '#0b0d14', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, w);
      el('path', { d: `M40 ${ry - 1} L${tx + 3} ${ty + 3} L40 ${ry + 3} Z`, fill: '#ffffff', opacity: 0.25 }, w);
    }
  }
}
// 영웅: 육각 방패 + 반짝이는 띠
function epicEmblem(svg, col, hs) {
  const id = 'kbc' + (++uid);
  const hex = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 6 + i * Math.PI / 3; return `${(60 + Math.cos(a) * 35).toFixed(1)},${(60 + Math.sin(a) * 35).toFixed(1)}`; }).join(' ');
  const defs = el('defs', {}, svg);
  const cp = el('clipPath', { id }, defs); el('polygon', { points: hex }, cp);
  const gr = el('linearGradient', { id: id + 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: '0', 'stop-color': col.accent, 'stop-opacity': 0.9 }, gr); el('stop', { offset: '1', 'stop-color': '#0a0c14', 'stop-opacity': 0.92 }, gr);
  el('polygon', { points: hex, fill: `url(#${id}g)`, stroke: col.main, 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);
  el('polygon', { points: hex, fill: 'none', stroke: '#0b0d14', 'stroke-width': 1, transform: 'translate(60 60) scale(0.82) translate(-60 -60)' }, svg);
  el('rect', { x: -40, y: 10, width: 18, height: 100, fill: '#ffffff', opacity: 0.35, class: 'kb-sheen', 'clip-path': `url(#${id})` }, svg);
  skull(svg, hs ? '#ff5a4a' : '#ffffff');
}
// 전설: 회전 광선 + 원형 문장 + 왕관 + 별가루
function legendEmblem(svg, col, hs) {
  const id = 'kbl' + (++uid);
  const defs = el('defs', {}, svg);
  const rg = el('radialGradient', { id }, defs);
  el('stop', { offset: '0', 'stop-color': col.main, 'stop-opacity': 0.55 }, rg); el('stop', { offset: '0.55', 'stop-color': col.accent, 'stop-opacity': 0.9 }, rg); el('stop', { offset: '1', 'stop-color': '#0a0812', 'stop-opacity': 0.95 }, rg);
  el('circle', { cx: 60, cy: 60, r: 35, fill: `url(#${id})`, stroke: col.main, 'stroke-width': 3.5 }, svg);
  el('circle', { cx: 60, cy: 60, r: 30, fill: 'none', stroke: '#ffffff', 'stroke-width': 1, opacity: 0.6, 'stroke-dasharray': '2 4', class: 'kb-spin' }, svg);
  // 왕관
  el('path', { d: 'M45 27 L44 15 L52 21 L60 10 L68 21 L76 15 L75 27 Z', fill: col.main, stroke: '#0b0d14', 'stroke-width': 1.5, 'stroke-linejoin': 'round', class: 'kb-crown' }, svg);
  for (const x of [52, 60, 68]) el('rect', { x: x - 1.5, y: 22, width: 3, height: 3, fill: x === 60 ? '#ff4a5a' : '#ffffff', class: 'kb-crown' }, svg);
  skull(svg, hs ? '#ff5a4a' : '#ffffff');
  // 별가루
  const sp = el('g', { class: 'kb-spark-ring' }, svg);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = 60 + Math.cos(a) * 50, y = 60 + Math.sin(a) * 50, s = i % 2 ? 3 : 4.5;
    el('path', { d: `M${x} ${y - s} L${x + s * 0.35} ${y} L${x} ${y + s} L${x - s * 0.35} ${y} Z M${x - s} ${y} L${x} ${y - s * 0.35} L${x + s} ${y} L${x} ${y + s * 0.35} Z`, fill: '#ffffff', class: 'kb-twinkle', style: `animation-delay:${(i * 0.17).toFixed(2)}s` }, sp);
  }
}

// tier: 'epic' | 'legend' | 없음, name: 스킨 이름
export function showKillBanner({ streak, hs, theme, tier, name }) {
  if (!host) host = document.getElementById('killBanner');
  if (!host) return;
  const n = Math.max(1, streak | 0), col = Object.assign({}, tierOf(n), theme || {});
  host.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'kb-wrap' + (tier ? ' kb-' + tier : '');
  wrap.style.setProperty('--kb-glow', col.glow);
  wrap.style.setProperty('--kb-main', col.main);
  wrap.style.setProperty('--kb-accent', col.accent);
  const big = tier === 'legend', size = big ? 190 : tier === 'epic' ? 160 : 140;
  const svg = el('svg', { viewBox: big ? '-20 -12 160 150' : tier === 'epic' ? '-10 -4 140 132' : '0 0 120 120', width: size, height: size * (big ? 150 / 160 : tier === 'epic' ? 132 / 140 : 1), class: 'kb-svg' });
  if (tier === 'legend') { legendWingsAndBlades(svg, col, n); legendEmblem(svg, col, hs); }
  else if (tier === 'epic') { wings(svg, col, 3, 26); bladesAll(svg, col, n); epicEmblem(svg, col, hs); }
  else { bladesAll(svg, col, n); emblem(svg, col, hs); }
  wrap.appendChild(svg);
  const lbl = document.createElement('div'); lbl.className = 'kb-lbl';
  lbl.innerHTML = `${hs ? '<span class="kb-hs">헤드샷</span> ' : ''}${n >= 2 ? `<b>${n}</b> 연속 처치` : '처치'}`;
  lbl.style.color = col.main;
  wrap.appendChild(lbl);
  if (tier && name) {
    const nm = document.createElement('div'); nm.className = 'kb-name';
    nm.textContent = (tier === 'legend' ? '전설 · ' : '영웅 · ') + name;
    wrap.appendChild(nm);
  }
  host.appendChild(wrap);
  if (big) { // 화면 가장자리 빛
    const fl = document.createElement('div'); fl.className = 'kb-edge'; fl.style.boxShadow = `inset 0 0 140px 24px ${col.glow}`; document.body.appendChild(fl);
    setTimeout(() => fl.remove(), 900);
  }
  clearTimeout(hideT);
  hideT = setTimeout(() => wrap.classList.add('out'), big ? 2800 : 2200);
}
function bladesAll(svg, col, n) {
  const blades = el('g', {}, svg);
  for (let i = 0; i < Math.min(n, SLOTS.length); i++) blade(blades, SLOTS[i], i, col, n >= 5);
}
function legendWingsAndBlades(svg, col, n) {
  const rays = el('g', { class: 'kb-rays' }, svg); // 뒤에서 도는 광선
  for (let i = 0; i < 16; i++) el('path', { d: 'M57 60 L60 -4 L63 60 Z', fill: col.main, opacity: i % 2 ? 0.16 : 0.34, transform: `rotate(${i * 22.5} 60 60)` }, rays);
  wings(svg, col, 4, 36);
  bladesAll(svg, col, n);
}
export function clearKillBanner() { if (host) host.innerHTML = ''; clearTimeout(hideT); }
