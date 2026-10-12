// 조준선 (발로란트 스타일): 색 · 외곽선 · 중앙 점 · 안쪽/바깥쪽 선 · 이동/사격 오차
import { profile, saveProfile } from '../cosmetics.js';

export const CROSS_COLORS = [
  ['흰색', '#ffffff'], ['초록', '#00ff00'], ['연두', '#7fff00'], ['노랑-초록', '#dfff00'],
  ['노랑', '#ffff00'], ['하늘', '#00ffff'], ['분홍', '#ff00ff'], ['빨강', '#ff0000'],
];

const LINE = (on, len, thick, off, opacity, move, fire) => ({ on, len, thick, off, opacity, move, moveMul: 1, fire, fireMul: 1 });
export const CROSS_DEFAULT = {
  color: '#ffffff', outline: true, outlineOpacity: 0.5, outlineThick: 1,
  dot: false, dotOpacity: 1, dotThick: 2,
  inner: LINE(true, 6, 2, 3, 0.8, true, true),
  outer: LINE(true, 2, 2, 10, 0.35, true, true),
};

export const CROSS_PRESETS = [
  ['기본', CROSS_DEFAULT],
  ['깔끔한 십자', { color: '#00ffff', outline: true, outlineOpacity: 0.6, outlineThick: 1, dot: false, dotOpacity: 1, dotThick: 2, inner: LINE(true, 4, 2, 2, 1, false, false), outer: LINE(false, 2, 2, 10, 0.35, false, false) }],
  ['점만', { color: '#00ff00', outline: true, outlineOpacity: 0.8, outlineThick: 1, dot: true, dotOpacity: 1, dotThick: 4, inner: LINE(false, 4, 2, 2, 1, false, false), outer: LINE(false, 2, 2, 10, 0.35, false, false) }],
  ['작은 점 + 십자', { color: '#ffff00', outline: true, outlineOpacity: 0.5, outlineThick: 1, dot: true, dotOpacity: 1, dotThick: 2, inner: LINE(true, 3, 1, 3, 1, false, true), outer: LINE(false, 2, 2, 10, 0.35, false, false) }],
  ['큰 십자', { color: '#ff00ff', outline: true, outlineOpacity: 0.5, outlineThick: 1, dot: false, dotOpacity: 1, dotThick: 2, inner: LINE(true, 10, 3, 5, 1, true, true), outer: LINE(false, 2, 2, 10, 0.35, false, false) }],
  ['원거리용', { color: '#7fff00', outline: false, outlineOpacity: 0.5, outlineThick: 1, dot: true, dotOpacity: 1, dotThick: 2, inner: LINE(true, 2, 2, 4, 1, false, false), outer: LINE(true, 4, 2, 12, 0.6, true, true) }],
];

const clone = (o) => JSON.parse(JSON.stringify(o));
function sanitize(c) {
  const d = clone(CROSS_DEFAULT), o = Object.assign(d, c || {});
  o.inner = Object.assign(clone(CROSS_DEFAULT.inner), (c && c.inner) || {});
  o.outer = Object.assign(clone(CROSS_DEFAULT.outer), (c && c.outer) || {});
  if (!/^#[0-9a-f]{6}$/i.test(o.color)) o.color = '#ffffff';
  return o;
}
export function getCross() {
  if (!profile.settings) profile.settings = {};
  return sanitize(profile.settings.cross);
}
export function setCross(c) {
  if (!profile.settings) profile.settings = {};
  profile.settings.cross = sanitize(c); saveProfile();
}

// 공유 코드 (친구한테 복사해서 주기)
export function crossCode(c) { return 'PX1-' + btoa(unescape(encodeURIComponent(JSON.stringify(sanitize(c))))); }
export function parseCrossCode(s) {
  s = String(s || '').trim();
  if (!s.startsWith('PX1-')) return null;
  try { return sanitize(JSON.parse(decodeURIComponent(escape(atob(s.slice(4)))))); } catch (e) { return null; }
}

function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

// 캔버스에 그리기. err = { move: 이동 오차(px), fire: 사격 오차(px) }
export function drawCross(cv, c, err, scale) {
  const k = scale || 1, dpr = window.devicePixelRatio || 1;
  const css = cv.clientWidth || cv.width / dpr;
  if (cv.width !== Math.round(css * dpr)) { cv.width = cv.height = Math.round(css * dpr); }
  const x = cv.getContext('2d'), s = dpr * k, cx = Math.floor(cv.width / 2), cy = Math.floor(cv.height / 2);
  x.clearRect(0, 0, cv.width, cv.height);
  const ot = Math.max(1, Math.round(c.outlineThick * s)), rects = [];
  const rect = (x0, y0, w, h, a) => rects.push([Math.round(x0), Math.round(y0), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), a]);
  const lines = (L) => {
    if (!L.on || L.opacity <= 0 || L.len <= 0) return;
    const e = err || { move: 0, fire: 0 };
    const off = (L.off + (L.move ? e.move * L.moveMul : 0) + (L.fire ? e.fire * L.fireMul : 0)) * s;
    const len = L.len * s, t = Math.max(1, Math.round(L.thick * s)), h = Math.floor(t / 2);
    rect(cx + off, cy - h, len, t, L.opacity); rect(cx - off - len, cy - h, len, t, L.opacity);
    rect(cx - h, cy + off, t, len, L.opacity); rect(cx - h, cy - off - len, t, len, L.opacity);
  };
  lines(c.inner); lines(c.outer);
  if (c.dot && c.dotOpacity > 0) { const t = Math.max(1, Math.round(c.dotThick * s)); rect(cx - Math.floor(t / 2), cy - Math.floor(t / 2), t, t, c.dotOpacity); }
  if (c.outline && c.outlineOpacity > 0) for (const [x0, y0, w, h, a] of rects) { x.fillStyle = rgba('#000000', c.outlineOpacity * a); x.fillRect(x0 - ot, y0 - ot, w + ot * 2, h + ot * 2); }
  for (const [x0, y0, w, h, a] of rects) { x.clearRect(x0, y0, w, h); x.fillStyle = rgba(c.color, a); x.fillRect(x0, y0, w, h); }
}

/* ---------- 설정 UI ---------- */
const row = (label, html) => `<div class="xrow"><span>${label}</span>${html}</div>`;
const slider = (key, min, max, step) => `<input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}"><b data-v="${key}"></b>`;
const check = (key) => `<label class="xchk"><input type="checkbox" data-k="${key}"><i></i></label>`;
function lineUI(p, name) {
  return `<div class="xsec"><div class="xsec-t">${name} ${check(p + '.on')}</div>
    ${row('투명도', slider(p + '.opacity', 0, 1, 0.05))}${row('길이', slider(p + '.len', 0, 20, 1))}${row('두께', slider(p + '.thick', 1, 10, 1))}${row('간격', slider(p + '.off', 0, 20, 1))}
    ${row('이동 오차', check(p + '.move') + slider(p + '.moveMul', 0, 3, 0.1))}${row('사격 오차', check(p + '.fire') + slider(p + '.fireMul', 0, 3, 0.1))}</div>`;
}
const getK = (o, k) => k.split('.').reduce((a, b) => a[b], o);
const setK = (o, k, v) => { const p = k.split('.'), l = p.pop(); p.reduce((a, b) => a[b], o)[l] = v; };

export function buildCrossEditor(box, toast) {
  let c = getCross(), demoT = 0, raf = 0;
  box.innerHTML = `
    <div class="xedit">
      <div class="xprev-col">
        <div class="xprev" id="xPrev"><canvas id="xPrevCv"></canvas></div>
        <div class="xbg"><button data-bg="sky" class="on">하늘</button><button data-bg="wall">벽</button><button data-bg="dark">어두움</button></div>
        <label class="xchk dim"><input type="checkbox" id="xDemo"><i></i> 이동·사격 미리보기</label>
        <div class="xpresets">${CROSS_PRESETS.map((p, i) => `<button class="btn tiny" data-p="${i}">${p[0]}</button>`).join('')}</div>
        <div class="row"><button class="btn tiny blue" id="xCopy">코드 복사</button><button class="btn tiny" id="xPaste">코드 붙여넣기</button><button class="btn tiny red" id="xReset">초기화</button></div>
      </div>
      <div class="xopts">
        <div class="xsec"><div class="xsec-t">색깔</div>
          <div class="xcolors">${CROSS_COLORS.map(([n, h]) => `<button title="${n}" data-c="${h}" style="background:${h}"></button>`).join('')}<input type="color" id="xColor"></div>
          ${row('외곽선', check('outline'))}${row('외곽선 투명도', slider('outlineOpacity', 0, 1, 0.05))}${row('외곽선 두께', slider('outlineThick', 1, 6, 1))}
          ${row('중앙 점', check('dot'))}${row('점 투명도', slider('dotOpacity', 0, 1, 0.05))}${row('점 두께', slider('dotThick', 1, 10, 1))}
        </div>
        ${lineUI('inner', '안쪽 선')}${lineUI('outer', '바깥쪽 선')}
      </div>
    </div>`;
  const cv = box.querySelector('#xPrevCv');
  const sync = () => {
    box.querySelectorAll('[data-k]').forEach(el => { const v = getK(c, el.dataset.k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; });
    box.querySelectorAll('[data-v]').forEach(el => { const v = getK(c, el.dataset.v); el.textContent = Number.isInteger(v) ? v : Number(v).toFixed(2); });
    box.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === c.color.toLowerCase()));
    box.querySelector('#xColor').value = c.color;
  };
  const commit = () => { setCross(c); c = getCross(); sync(); };
  box.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => { setK(c, el.dataset.k, el.type === 'checkbox' ? el.checked : Number(el.value)); commit(); }));
  box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { c.color = b.dataset.c; commit(); });
  box.querySelector('#xColor').oninput = (e) => { c.color = e.target.value; commit(); };
  box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { c = clone(CROSS_PRESETS[+b.dataset.p][1]); commit(); });
  box.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => { box.querySelector('#xPrev').className = 'xprev bg-' + b.dataset.bg; box.querySelectorAll('[data-bg]').forEach(o => o.classList.toggle('on', o === b)); });
  box.querySelector('#xReset').onclick = () => { c = clone(CROSS_DEFAULT); commit(); };
  box.querySelector('#xCopy').onclick = () => { const code = crossCode(c); (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('조준선 코드를 복사했어요'), () => prompt('조준선 코드', code)); };
  box.querySelector('#xPaste').onclick = () => { const p = parseCrossCode(prompt('조준선 코드를 붙여넣어 주세요')); if (!p) { toast('코드가 올바르지 않아요'); return; } c = p; commit(); toast('조준선을 불러왔어요'); };
  sync();
  const tick = () => {
    if (!box.isConnected || box.closest('.hidden')) { raf = 0; return; }
    demoT += 1 / 60;
    const demo = box.querySelector('#xDemo').checked, w = (Math.sin(demoT * 2) + 1) / 2;
    drawCross(cv, c, demo ? { move: w * 8, fire: Math.max(0, Math.sin(demoT * 5)) * 6 } : null, 3);
    raf = requestAnimationFrame(tick);
  };
  return { start() { c = getCross(); sync(); if (!raf) tick(); } };
}
