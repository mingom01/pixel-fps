// 조작키 재지정. 게임 코드는 '기본 키 코드'로 동작하고, 여기서 실제 누른 키를 기본 코드로 바꿔 줘요.
import { profile, saveProfile } from '../cosmetics.js';

export const ACTIONS = [
  { id: 'fwd', name: '앞으로', def: 'KeyW', grp: '이동' },
  { id: 'back', name: '뒤로', def: 'KeyS', grp: '이동' },
  { id: 'left', name: '왼쪽', def: 'KeyA', grp: '이동' },
  { id: 'right', name: '오른쪽', def: 'KeyD', grp: '이동' },
  { id: 'jump', name: '점프', def: 'Space', grp: '이동' },
  { id: 'crouch', name: '앉기 / 슬라이딩', def: 'KeyC', grp: '이동' },
  { id: 'sprint', name: '달리기', def: 'ShiftLeft', grp: '이동' },
  { id: 'reload', name: '재장전', def: 'KeyR', grp: '무기' },
  { id: 'primary', name: '주무기', def: 'Digit1', grp: '무기' },
  { id: 'secondary', name: '보조무기', def: 'Digit2', grp: '무기' },
  { id: 'melee', name: '칼', def: 'Digit3', grp: '무기' },
  { id: 'melee2', name: '칼 (보조 키)', def: 'KeyV', grp: '무기' },
  { id: 'nade', name: '수류탄 들기', def: 'Digit4', grp: '무기' },
  { id: 'quickNade', name: '수류탄 바로 던지기', def: 'KeyG', grp: '무기' },
  { id: 'last', name: '이전 무기', def: 'KeyQ', grp: '무기' },
  { id: 'use', name: '줍기 / 해체 / 상자 열기', def: 'KeyE', grp: '행동' },
  { id: 'plant', name: '스파이크 설치', def: 'KeyF', grp: '행동' },
  { id: 'buy', name: '상점', def: 'KeyB', grp: '행동' },
  { id: 'turret', name: '포탑 설치', def: 'KeyZ', grp: '행동' },
  { id: 'air', name: '공습', def: 'KeyX', grp: '행동' },
  { id: 'emote', name: '감정표현', def: 'KeyY', grp: '행동' },
  { id: 'spray', name: '스프레이', def: 'KeyT', grp: '행동' },
  { id: 'score', name: '점수판', def: 'Tab', grp: '기타' },
  { id: 'chat', name: '채팅', def: 'Enter', grp: '기타' },
];
const DEFS = new Set(ACTIONS.map(a => a.def));
const RESERVED = new Set(['Escape']);

export function getBinds() {
  const b = (profile.settings && profile.settings.binds) || {};
  const out = {};
  for (const a of ACTIONS) out[a.id] = b[a.id] || a.def;
  return out;
}
let rev = null;
function buildRev() { rev = new Map(); const b = getBinds(); for (const a of ACTIONS) rev.set(b[a.id], a.def); }

// 실제 키 → 게임이 쓰는 기본 키 코드 (어떤 동작에도 안 쓰이는 기본 키는 무시)
export function toGame(code) {
  if (!rev) buildRev();
  if (rev.has(code)) return rev.get(code);
  return DEFS.has(code) ? null : code;
}
export function resetBindsCache() { rev = null; }

// 키 지정 (이미 쓰는 키면 서로 바꿈)
export function setBind(id, code) {
  if (RESERVED.has(code)) return false;
  if (!profile.settings) profile.settings = {};
  const b = getBinds(), old = b[id];
  for (const a of ACTIONS) if (a.id !== id && b[a.id] === code) b[a.id] = old;
  b[id] = code;
  profile.settings.binds = b; saveProfile(); rev = null;
  return true;
}
export function resetBinds() { if (!profile.settings) profile.settings = {}; profile.settings.binds = {}; saveProfile(); rev = null; }

export function keyLabel(code) {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return '넘패드 ' + code.slice(6);
  return { Space: '스페이스', ShiftLeft: '왼쪽 Shift', ShiftRight: '오른쪽 Shift', ControlLeft: '왼쪽 Ctrl', ControlRight: '오른쪽 Ctrl', AltLeft: '왼쪽 Alt', AltRight: '오른쪽 Alt', Tab: 'Tab', Enter: 'Enter', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] || code;
}
export const labelFor = (id) => keyLabel(getBinds()[id]);

/* ---------- 설정 UI ---------- */
export function buildKeyEditor(box, toast) {
  let waiting = null;
  const render = () => {
    const b = getBinds(), grps = [...new Set(ACTIONS.map(a => a.grp))];
    box.innerHTML = grps.map(g => `<div class="kgrp"><div class="xsec-t">${g}</div>${ACTIONS.filter(a => a.grp === g).map(a => `<div class="krow"><span>${a.name}</span><button class="kbtn ${waiting === a.id ? 'wait' : ''} ${b[a.id] !== a.def ? 'chg' : ''}" data-a="${a.id}">${waiting === a.id ? '키를 누르세요…' : keyLabel(b[a.id])}</button></div>`).join('')}</div>`).join('')
      + '<div class="krow"><span class="dim">좌클릭 사격 · 우클릭 조준 · 휠 무기 바꾸기 · Esc 메뉴는 고정이에요</span><button class="btn tiny red" id="kReset">기본값으로</button></div>';
    box.querySelectorAll('[data-a]').forEach(el => el.onclick = () => { waiting = el.dataset.a; render(); });
    box.querySelector('#kReset').onclick = () => { resetBinds(); waiting = null; render(); toast('조작키를 기본값으로 되돌렸어요'); };
  };
  // 캡처 단계에서 먼저 받아서 게임 키 처리로 안 넘어가게
  window.addEventListener('keydown', (e) => {
    if (!waiting || !box.isConnected || box.closest('.hidden')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') { if (!setBind(waiting, e.code)) toast('그 키는 쓸 수 없어요'); }
    waiting = null; render();
  }, true);
  render();
  return { start() { waiting = null; render(); } };
}
