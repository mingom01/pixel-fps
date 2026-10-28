// 맵 에디터 같이 만들기 (클라이언트)
// - 방장: '온라인 열기' → 코드를 친구에게 알려줌. 친구는 메인 화면 '방 코드'에 넣고 참가
// - 블록 변경은 서버를 거쳐 모두에게 같은 순서로 적용 (내 변경은 먼저 화면에 바로 보이고, 서버가 돌려준 걸로 한 번 더 맞춤)
// - 다른 사람은 날아다니는 캐릭터 + 이름으로 보임
import * as THREE from '../../lib/three.module.min.js';
import { textSprite, PCOLORS } from '../tex.js';
import { makeChar } from '../models.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// deps = { onMk(msg), onCb(msg), send, scene, SH, ED, myId(), joinInfo(), edSet(x,y,z,b,noUndo,remote), startEditor(map, meta), exitEditor(toMenu), rebuildTheme(), toast }
let D = null;
const st = { on: false, code: null, host: null, members: [], avatars: new Map(), sentAt: 0, sent: '' };

export function initCoop(deps) { D = deps; }
export const isOnline = () => st.on;
export const isGuest = () => st.on && st.host !== D.myId();

// 방장: 지금 편집 중인 맵을 온라인으로 열기
export function openOnline() {
  if (st.on) return;
  const ED = D.ED;
  D.send(Object.assign({ t: 'edopen', ent: Object.assign({ name: ED.name, theme: ED.theme, cb: ED.cb || {}, mk: ED.mk || {} }, D.SH.encodeMap(ED.map)) }, D.joinInfo()));
}
export function leaveOnline() { if (st.on) D.send({ t: 'edleave' }); reset(); }
// 세션 끝 (서버가 이미 정리한 경우: 테스트로 게임 방에 들어감, 연결 끊김)
export function reset() {
  st.on = false; st.code = null; st.host = null; st.members = [];
  for (const a of st.avatars.values()) D.scene.remove(a.model);
  st.avatars.clear();
  renderBar();
}

// 내가 블록을 바꾸면 서버로
export function coopSet(x, y, z, b) { if (st.on) D.send({ t: 'edset', x, y, z, b }); }
export function coopMeta() { if (st.on && !isGuest()) D.send({ t: 'edmeta', name: D.ED.name, theme: D.ED.theme }); }
export function coopTest(id) { D.send({ t: 'edtest', id }); }

// 매 프레임: 내 위치 보내기 (0.1초마다, 움직였을 때만) + 다른 사람 캐릭터 부드럽게 움직이기
export function coopTick(dt) {
  if (!st.on) return;
  const ED = D.ED, now = performance.now();
  if (now - st.sentAt > 100) {
    const k = [ED.x, ED.y, ED.z, ED.yaw].map(v => v.toFixed(1)).join();
    if (k !== st.sent) { st.sent = k; st.sentAt = now; D.send({ t: 'edpos', x: ED.x, y: ED.y, z: ED.z, yaw: ED.yaw }); }
  }
  const t = Math.min(1, dt * 10);
  for (const a of st.avatars.values()) {
    const m = a.model, p = a.p;
    m.position.x += (p[0] - m.position.x) * t; m.position.y += (p[1] - 1.55 - m.position.y) * t; m.position.z += (p[2] - m.position.z) * t;
    m.rotation.y = p[3];
  }
}

function avatarOf(id) {
  let a = st.avatars.get(id);
  if (a) return a;
  const mem = st.members.find(m => m.id === id); if (!mem) return null;
  const model = makeChar(mem.color, 'default');
  const ts = textSprite(mem.name + (mem.host ? ' (방장)' : ''), '#7ff0e0');
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: ts.tex, depthTest: false, transparent: true }));
  tag.scale.set(ts.w / 48, ts.h / 48, 1); tag.position.y = 2.15; tag.renderOrder = 5; model.add(tag);
  D.scene.add(model);
  a = { model, p: [0, 0, 0, 0] }; st.avatars.set(id, a);
  return a;
}

// 위쪽 막대: 코드 · 같이 만드는 사람들, 그리고 방장/참가자에 따라 버튼 보이기
function renderBar() {
  const bar = $('edCoop'); if (!bar) return;
  const guest = isGuest();
  $('edOnline').classList.toggle('hidden', st.on);
  $('edTest').textContent = st.on ? '다 같이 테스트' : '테스트 플레이';
  $('edTest').classList.toggle('hidden', guest);
  $('edSave').textContent = guest ? '내 맵에 복사 저장 (M)' : '저장 (M)';
  $('edName').disabled = guest; $('edTheme').disabled = guest;
  bar.classList.toggle('hidden', !st.on);
  if (!st.on) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<b class="ec-code">온라인 코드 ${esc(st.code)}</b> <span class="dim">${guest ? '같이 만드는 중' : '친구는 메인 화면 \'방 코드\'에 이 코드를 넣고 참가'}</span> · ${st.members.length}/8명: `
    + st.members.map(m => `<span class="ec-m" style="color:${hex(PCOLORS[m.color] || 0xffffff)}">${esc(m.name)}${m.host ? '★' : ''}</span>`).join(' ');
}

// 서버 메시지 (처리했으면 true)
export function coopMsg(m) {
  switch (m.t) {
    case 'edopened':
      Object.assign(st, { on: true, code: m.code, host: m.host, members: m.members });
      renderBar();
      D.toast(`온라인으로 열었어요! 친구에게 코드 ${m.code} 를 알려주세요`);
      return true;
    case 'edjoined': {
      const map = D.SH.mapFromData(m.ent);
      if (!map) { D.toast('맵을 불러오지 못했어요'); D.send({ t: 'edleave' }); return true; }
      D.startEditor(map, { name: m.ent.name, theme: m.ent.theme });
      Object.assign(st, { on: true, code: m.code, host: m.host, members: m.members });
      renderBar();
      D.toast('맵 만들기에 들어왔어요! 같이 고친 건 방장 맵에 저장돼요');
      return true;
    }
    case 'edmembers':
      st.host = m.host; st.members = m.members;
      for (const [id, a] of st.avatars) if (!m.members.some(x => x.id === id)) { D.scene.remove(a.model); st.avatars.delete(id); }
      renderBar();
      return true;
    case 'edmk': // 스폰·힐팩·보급 표시가 바뀜
      if (st.on && D.ED.on) D.onMk(m);
      return true;
    case 'edcb': // 내가 만든 블록이 이 맵에 등록됨 (번호는 서버가 정함)
      if (st.on && D.ED.on) D.onCb(m);
      return true;
    case 'edset':
      if (st.on && D.ED.on) D.edSet(m.x, m.y, m.z, m.b, true, true);
      return true;
    case 'edpos': {
      if (!st.on || m.id === D.myId()) return true;
      const a = avatarOf(m.id); if (!a) return true;
      if (!a.seen) { a.seen = true; a.model.position.set(m.p[0], m.p[1] - 1.55, m.p[2]); }
      a.p = m.p;
      return true;
    }
    case 'edmeta':
      D.ED.name = m.name; $('edName').value = m.name;
      if (m.theme !== D.ED.theme) { D.ED.theme = m.theme; $('edTheme').value = m.theme; D.rebuildTheme(); }
      return true;
    case 'edclosed':
      reset();
      D.toast(m.text || '맵 만들기가 끝났어요');
      if (D.ED.on) D.exitEditor();
      return true;
  }
  return false;
}
