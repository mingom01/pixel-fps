// 맵 에디터 ↔ 내가 만든 블록
// - 블록 고르기 창 위쪽에 '내 블록' 칸 (+ 새 블록 만들기, ✎ 고치기)
// - 내 블록을 고르면 지금 맵에 번호(200~255)를 붙여 등록 (같이 만들기 중이면 서버가 번호를 정해서 모두에게 알림)
// - 맵을 저장할 때 실제로 놓인 블록 정의만 맵 데이터(cb)에 넣음
import { installCustomBlocks, faceCanvas } from '../blocks/customBlocks.js';
import { myBlocks, saveBlock, deleteBlock, MAX_BLOCKS } from '../blocks/blockStore.js';
import { openBlockEditor } from '../blocks/blockEditor.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// deps = { SH, ED, atlas, send, isOnline(), myId(), names (BLOCK_NAMES), forgetIcon(id), renderPalette(), closePicker(), reopenPicker(), toast }
let D = null, pending = null; // pending: 같이 만들기에서 서버가 번호를 정해 주길 기다리는 { lib, slot }

export function initMyBlocks(deps) { D = deps; }

// 맵의 블록 정의를 아틀라스에 그려 넣기 (에디터·게임 공용)
export function installCb(cb) {
  for (const id of installCustomBlocks(D.atlas, cb)) { D.forgetIcon(id); D.names[id] = cb[id].n; }
}

const frontIcon = (f) => faceCanvas(f[2], 2).toDataURL();
// 블록 고르기 창 위에 붙는 '내 블록' 칸
export function myBlocksHtml() {
  const lib = myBlocks(), libIds = new Set(lib.map(b => b.id));
  const inMap = Object.entries(D.ED.cb || {}).filter(([, d]) => !libIds.has(d.lib)); // 친구 블록·복사해 온 맵의 블록
  return `<div class="bp-sec">내 블록 <span class="dim">(${lib.length}/${MAX_BLOCKS}) · 직접 그린 블록, 계정에 저장돼요</span></div>
    <div class="bp-mine">
      <div class="bpi bp-new" id="bpNewBlock"><b>+</b><span>새 블록 만들기</span></div>
      ${lib.map(b => `<div class="bpi" data-lib="${esc(b.id)}" title="${esc(b.name)}"><img src="${frontIcon(b.f)}"><span>${esc(b.name)}</span><i class="bp-edit" data-edit="${esc(b.id)}">✎</i></div>`).join('')}
      ${inMap.map(([id, d]) => `<div class="bpi" data-b="${id}" title="${esc(d.n)}"><img src="${frontIcon(d.f)}"><span>${esc(d.n)}</span><em class="dim">이 맵</em></div>`).join('')}
    </div>
    <div class="bp-sec">기본 블록</div>`;
}
export function bindMyBlocks(box) {
  const nb = box.querySelector('#bpNewBlock'); if (nb) nb.onclick = () => editBlock(null);
  box.querySelectorAll('[data-lib]').forEach(d => d.onclick = (e) => {
    if (e.target.dataset.edit) { editBlock(myBlocks().find(b => b.id === e.target.dataset.edit)); return; }
    const b = myBlocks().find(x => x.id === d.dataset.lib); if (b) useLibBlock(b);
  });
}

// 블록 만들기 창 열기 (null = 새 블록)
function editBlock(blk) {
  D.closePicker(true);
  openBlockEditor({
    blk,
    onSave: (b) => {
      const saved = saveBlock(b);
      if (!saved) { D.toast(`내 블록은 ${MAX_BLOCKS}개까지 저장돼요`); return false; }
      D.toast(`'${saved.name}' 블록을 저장했어요`);
      // 새로 만들었으면 지금 칸에 바로 쥐어 주고, 고친 블록이 맵에 있으면 그림도 바꿈
      if (!blk || Object.values(D.ED.cb || {}).some(d => d.lib === saved.id)) useLibBlock(saved, !!blk);
      return true;
    },
    onDelete: (id) => { deleteBlock(id); D.toast('내 블록에서 지웠어요 (맵에 놓은 블록은 그대로)'); },
  });
}

// 내 블록을 이 맵에 등록하고 지금 칸에 쥐기 (keepSlot: 그림만 갱신)
function useLibBlock(b, keepSlot) {
  const def = { n: b.name, f: b.f, lib: b.id };
  if (D.isOnline()) { pending = keepSlot ? null : { lib: b.id, slot: D.ED.slot }; D.send({ t: 'edcb', def }); return; }
  const cb = D.ED.cb || (D.ED.cb = {});
  let id = Object.keys(cb).map(Number).find(k => cb[k].lib === b.id);
  if (id == null) for (let k = D.SH.CB_MIN; k <= D.SH.CB_MAX; k++) if (!cb[k]) { id = k; break; }
  if (id == null) { D.toast(`한 맵에는 내가 만든 블록을 ${D.SH.CB_MAX - D.SH.CB_MIN + 1}종까지 쓸 수 있어요`); return; }
  cb[id] = def; installCb({ [id]: def });
  if (!keepSlot) { D.ED.pal[D.ED.slot] = id; D.renderPalette(); }
}

// 같이 만들기: 서버가 번호를 정해서 알려줌
export function onEdCb(m) {
  const cb = D.ED.cb || (D.ED.cb = {});
  cb[m.id] = m.def; installCb({ [m.id]: m.def });
  if (pending && m.by === D.myId() && m.def.lib === pending.lib) { D.ED.pal[pending.slot] = m.id; pending = null; D.renderPalette(); }
}

// 저장할 때: 맵에 실제로 놓인 블록 정의만
export function usedCb(map, cb) {
  const out = {}; if (!cb || !Object.keys(cb).length) return out;
  const seen = new Set(); const d = map.d;
  for (let i = 0; i < d.length; i++) if (d[i] >= D.SH.CB_MIN) seen.add(d[i]);
  for (const id of seen) if (cb[id]) out[id] = cb[id];
  return out;
}
