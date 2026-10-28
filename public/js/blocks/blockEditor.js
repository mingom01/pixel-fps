// 블록 만들기 화면: 16×16 픽셀로 6면을 그리고 '내 블록'에 저장
// - 펜 / 채우기 / 스포이드, 되돌리기
// - 이 면을 모든 면·옆면 4개에 복사, 다른 면에서 가져오기, 기존 블록 그림 가져오기
// - 오른쪽에 돌아가는 3D 미리보기
import { FACE_NAMES, faceToBytes, bytesToFace, solidFace, faceCanvas } from './customBlocks.js';

const T = 16, PX = 20;
const SWATCHES = ['#000000', '#3a3a3a', '#7a7a7a', '#b4b4b4', '#ffffff', '#5a3a22', '#8a5a36', '#c8a070', '#e2483a', '#ff8a20', '#f4c22b', '#fff2a0',
  '#4cbf4c', '#2a7a2a', '#5fe3ff', '#3d8bf0', '#1a3a8a', '#8b45c9', '#e25c9e', '#ffc0b8', '#c0342e', '#7ae05a', '#2fb8c4', '#d4a520'];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

// deps = { blockTexture(blockId) → 16×16 RGB Uint8Array, blockList() → [{ id, name }], toast }
let D = null;
const st = { faces: null, cur: 0, tool: 'pen', color: '#3d8bf0', recent: [], undo: [], drawing: false, opts: null, id: null };

export function initBlockEditor(deps) { D = deps; build(); }
export const blockEditorOpen = () => !$('blockEd').classList.contains('hidden');

function build() {
  const el = document.createElement('div');
  el.id = 'blockEd'; el.className = 'modal hidden';
  el.innerHTML = `<div class="panel be">
    <div class="ptitle">블록 만들기 <span class="dim be-sub">16×16 픽셀 · 6면</span><button id="beClose" class="btn tiny red right">닫기</button></div>
    <div class="be-body">
      <div class="be-left">
        <div id="beFaces" class="be-faces"></div>
        <canvas id="beCanvas" width="${T * PX}" height="${T * PX}"></canvas>
        <div class="be-tools">
          <button data-tool="pen" class="btn tiny">펜</button><button data-tool="fill" class="btn tiny">채우기</button><button data-tool="pick" class="btn tiny">스포이드</button>
          <button id="beUndo" class="btn tiny">되돌리기</button>
        </div>
      </div>
      <div class="be-right">
        <label class="lbl">블록 이름</label><input id="beName" maxlength="16" placeholder="내 블록">
        <label class="lbl">색깔</label>
        <div class="be-colorrow"><input type="color" id="beColor"><span id="beColorHex" class="dim"></span></div>
        <div id="beSwatches" class="be-sw"></div>
        <div class="dim be-small">최근 색</div><div id="beRecent" class="be-sw"></div>
        <label class="lbl">면 복사</label>
        <div class="be-copy">
          <button id="beToAll" class="btn tiny blue">이 면 → 모든 면</button>
          <button id="beToSides" class="btn tiny blue">이 면 → 옆면 4개</button>
        </div>
        <div class="be-copy"><select id="beFrom"></select><button id="beFromBtn" class="btn tiny">이 면으로 가져오기</button></div>
        <div class="be-copy"><select id="beTexFrom"></select><button id="beTexBtn" class="btn tiny">블록 그림 가져오기</button></div>
        <div class="be-copy"><button id="beClear" class="btn tiny">이 면 한 색으로 채우기</button></div>
        <div class="be-prev"><div id="beCube" class="be-cube"></div></div>
        <div class="be-actions"><button id="beSave" class="btn green">저장</button><button id="beDel" class="btn red">삭제</button></div>
      </div>
    </div></div>`;
  document.body.appendChild(el);
  $('beClose').onclick = close;
  $('beSwatches').innerHTML = SWATCHES.map(c => `<i style="background:${c}" data-c="${c}"></i>`).join('');
  $('beSwatches').onclick = (e) => { if (e.target.dataset.c) setColor(e.target.dataset.c); };
  $('beRecent').onclick = (e) => { if (e.target.dataset.c) setColor(e.target.dataset.c); };
  $('beColor').oninput = (e) => setColor(e.target.value, true);
  el.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { st.tool = b.dataset.tool; renderTools(); });
  $('beUndo').onclick = undo;
  $('beToAll').onclick = () => { pushUndo(); for (let i = 0; i < 6; i++) if (i !== st.cur) st.faces[i] = st.faces[st.cur].slice(); refresh(); };
  $('beToSides').onclick = () => { pushUndo(); for (const i of [2, 3, 4, 5]) if (i !== st.cur) st.faces[i] = st.faces[st.cur].slice(); refresh(); };
  $('beFromBtn').onclick = () => { const i = +$('beFrom').value; if (i === st.cur) return; pushUndo(); st.faces[st.cur] = st.faces[i].slice(); refresh(); };
  $('beTexBtn').onclick = () => { const u = D.blockTexture(+$('beTexFrom').value); if (!u) return; pushUndo(); st.faces[st.cur] = u; refresh(); };
  $('beClear').onclick = () => { pushUndo(); st.faces[st.cur] = faceToBytes(solidFace(hexToRgb(st.color))); refresh(); };
  $('beSave').onclick = save;
  $('beDel').onclick = () => { if (st.id && confirm('이 블록을 내 블록에서 지울까요? (이미 맵에 놓은 블록은 그대로 남아요)')) { st.opts.onDelete(st.id); close(); } };
  const cv = $('beCanvas');
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); st.drawing = true; if (st.tool === 'pen') pushUndo(); paintAt(e); });
  cv.addEventListener('pointermove', (e) => { if (st.drawing && st.tool === 'pen') paintAt(e); });
  cv.addEventListener('pointerup', () => { st.drawing = false; renderFaces(); renderCube(); });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
}

// opts = { blk: 고칠 블록(없으면 새로), onSave(blk), onDelete(id) }
export function openBlockEditor(opts) {
  st.opts = opts; st.id = opts.blk ? opts.blk.id : null; st.cur = 0; st.undo = [];
  st.faces = opts.blk ? opts.blk.f.map(faceToBytes) : [0, 1, 2, 3, 4, 5].map(() => faceToBytes(solidFace([180, 180, 180])));
  $('beName').value = opts.blk ? opts.blk.name : '';
  $('beDel').classList.toggle('hidden', !st.id);
  $('beFrom').innerHTML = FACE_NAMES.map((n, i) => `<option value="${i}">${n} 면에서</option>`).join('');
  $('beTexFrom').innerHTML = D.blockList().map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  if (document.pointerLockElement) document.exitPointerLock();
  $('blockEd').classList.remove('hidden');
  setColor(st.color); renderTools(); refresh();
}
function close() { $('blockEd').classList.add('hidden'); if (st.opts && st.opts.onClose) st.opts.onClose(); }

function save() {
  const name = ($('beName').value.trim() || '내 블록').slice(0, 16);
  const blk = { id: st.id, name, f: st.faces.map(bytesToFace) };
  const res = st.opts.onSave(blk);
  if (res === false) return;
  close();
}

function setColor(c, fromInput) {
  st.color = c; if (!fromInput) $('beColor').value = c; $('beColorHex').textContent = c;
  st.recent = [c, ...st.recent.filter(x => x !== c)].slice(0, 12);
  $('beRecent').innerHTML = st.recent.map(x => `<i style="background:${x}" data-c="${x}"></i>`).join('');
}
function pushUndo() { st.undo.push({ i: st.cur, f: st.faces.map(f => f.slice()) }); if (st.undo.length > 60) st.undo.shift(); }
function undo() { const u = st.undo.pop(); if (!u) return; st.faces = u.f; st.cur = u.i; refresh(); }

function cellOf(e) {
  const r = $('beCanvas').getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / r.width * T), Math.floor((e.clientY - r.top) / r.height * T)];
}
function paintAt(e) {
  const [x, y] = cellOf(e); if (x < 0 || y < 0 || x >= T || y >= T) return;
  const f = st.faces[st.cur], i = (y * T + x) * 3;
  if (st.tool === 'pick') { setColor(rgbToHex(f[i], f[i + 1], f[i + 2])); st.tool = 'pen'; renderTools(); return; }
  const [r, g, b] = hexToRgb(st.color);
  if (st.tool === 'fill') {
    pushUndo();
    const from = [f[i], f[i + 1], f[i + 2]]; if (from[0] === r && from[1] === g && from[2] === b) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop(); if (cx < 0 || cy < 0 || cx >= T || cy >= T) continue;
      const k = (cy * T + cx) * 3; if (f[k] !== from[0] || f[k + 1] !== from[1] || f[k + 2] !== from[2]) continue;
      f[k] = r; f[k + 1] = g; f[k + 2] = b;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    refresh(); return;
  }
  f[i] = r; f[i + 1] = g; f[i + 2] = b;
  drawCanvas();
}

function drawCanvas() {
  const x = $('beCanvas').getContext('2d'), f = st.faces[st.cur];
  for (let i = 0; i < T * T; i++) { x.fillStyle = `rgb(${f[i * 3]},${f[i * 3 + 1]},${f[i * 3 + 2]})`; x.fillRect((i % T) * PX, Math.floor(i / T) * PX, PX, PX); }
  x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1;
  for (let k = 1; k < T; k++) { x.beginPath(); x.moveTo(k * PX + 0.5, 0); x.lineTo(k * PX + 0.5, T * PX); x.moveTo(0, k * PX + 0.5); x.lineTo(T * PX, k * PX + 0.5); x.stroke(); }
}
function renderTools() { document.querySelectorAll('#blockEd [data-tool]').forEach(b => b.classList.toggle('yellow', b.dataset.tool === st.tool)); }
function renderFaces() {
  $('beFaces').innerHTML = FACE_NAMES.map((n, i) => `<div class="be-face ${i === st.cur ? 'on' : ''}" data-i="${i}"><img src="${faceCanvas(bytesToFace(st.faces[i]), 2).toDataURL()}"><span>${n}</span></div>`).join('');
  $('beFaces').querySelectorAll('.be-face').forEach(d => d.onclick = () => { st.cur = +d.dataset.i; refresh(); });
}
// CSS 3D 정육면체 미리보기 (앞·뒤·왼·오른·위·아래)
function renderCube() {
  const img = (i) => faceCanvas(bytesToFace(st.faces[i]), 4).toDataURL();
  const tf = ['rotateX(90deg)', 'rotateX(-90deg)', '', 'rotateY(180deg)', 'rotateY(-90deg)', 'rotateY(90deg)'];
  $('beCube').innerHTML = tf.map((t, i) => `<img style="transform:${t} translateZ(40px)" src="${img(i)}">`).join('');
}
function refresh() { drawCanvas(); renderFaces(); renderCube(); }
