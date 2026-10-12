// 설정 창: 조준선 / 조작키 / 감도·화면 (메인 메뉴와 일시정지 메뉴에서 열기)
import { buildCrossEditor } from './crosshair.js';
import { buildKeyEditor } from './keybinds.js';

const $ = (id) => document.getElementById(id);
let tab = 'cross', cross = null, keyEd = null, gen = null, onClose = null;

function renderGeneral() {
  const c = gen.cfg;
  $('setBody').querySelector('#setGen').innerHTML = `
    <label class="lbl">마우스 감도 <b id="gSensV"></b></label><input type="range" id="gSens" min="0.2" max="3" step="0.05" value="${c.sens}">
    <label class="lbl">시야(FOV) <b id="gFovV"></b></label><input type="range" id="gFov" min="60" max="110" step="1" value="${c.fov}">
    <label class="lbl">볼륨 <b id="gVolV"></b></label><input type="range" id="gVol" min="0" max="1" step="0.05" value="${c.vol}">
    <label class="chk"><input type="checkbox" id="gKc" ${c.killcam !== false ? 'checked' : ''}> 죽으면 킬캠 보기</label>`;
  const lbl = () => { $('gSensV').textContent = Number(c.sens).toFixed(2); $('gFovV').textContent = c.fov; $('gVolV').textContent = Math.round(c.vol * 100) + '%'; };
  $('gSens').oninput = (e) => { c.sens = Number(e.target.value); gen.save(); lbl(); };
  $('gFov').oninput = (e) => { c.fov = Number(e.target.value); gen.save(); lbl(); };
  $('gVol').oninput = (e) => { c.vol = Number(e.target.value); gen.setVolume(c.vol); gen.save(); lbl(); };
  $('gKc').onchange = (e) => { c.killcam = e.target.checked; gen.save(); };
  lbl();
}

function show() {
  $('setTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  for (const [id, t] of [['setCross', 'cross'], ['setKeys', 'keys'], ['setGen', 'gen']]) $(id).classList.toggle('hidden', t !== tab);
  if (tab === 'cross') cross.start();
  if (tab === 'keys') keyEd.start();
  if (tab === 'gen') renderGeneral();
}

// general = { cfg, save, setVolume }
export function initSettings(general, toast) {
  gen = general;
  cross = buildCrossEditor($('setCross'), toast);
  keyEd = buildKeyEditor($('setKeys'), toast);
  $('setTabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.tab; show(); });
}
export function openSettings(cb) { onClose = cb || null; $('settings').classList.remove('hidden'); show(); }
export function closeSettings() { $('settings').classList.add('hidden'); const f = onClose; onClose = null; if (f) f(); }
export const settingsOpen = () => !$('settings').classList.contains('hidden');
