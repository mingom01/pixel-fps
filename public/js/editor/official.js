// 공식 맵 (클라이언트)
// - 로그인하면 서버가 공식 맵 목록을 보내줌 → SH.registerOfficial 로 등록 → 맵 목록·랜덤 맵에 나옴
// - 맵 에디터 시작 창의 '출품' 버튼, 내 출품작 상태 (심사 중 / 승인 / 거절)
// - 관리자: 메인 메뉴 '맵 심사' → 출품작 미리 플레이 · 승인 · 거절, 공식 맵 내리기
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (t) => t ? new Date(t).toLocaleDateString() : '';

// deps = { send, SH, toast, myName(), rebuildCards(), playEnt(ent), thumb(ent) → canvas, onSubs() }
let D = null, admin = false, mySubs = [];
export function initOfficial(deps) {
  D = deps;
  const el = document.createElement('div');
  el.id = 'adminPanel'; el.className = 'modal hidden';
  el.innerHTML = `<div class="panel adm"><div class="ptitle">맵 심사 <span class="dim adm-sub">관리자</span><button id="admClose" class="btn tiny red right">닫기</button></div><div id="admBody" class="adm-body">불러오는 중…</div></div>`;
  document.body.appendChild(el);
  $('admClose').onclick = () => el.classList.add('hidden');
  $('adminBtn').onclick = () => { el.classList.remove('hidden'); $('admBody').textContent = '불러오는 중…'; D.send({ t: 'admsubs' }); };
}
export const isAdmin = () => admin;
export const subOf = (mid) => mySubs.find(s => s.mid === mid) || null;

export function submitMap(ent) {
  if (!confirm(`'${ent.name}' 맵을 공식 맵으로 출품할까요?\n관리자가 승인하면 모든 사람의 맵 목록과 랜덤 맵에 나와요.`)) return;
  D.send({ t: 'submit', ent, by: D.myName() });
}

// 서버 메시지 (처리했으면 true)
export function officialMsg(m) {
  switch (m.t) {
    case 'official':
      for (const o of m.list || []) D.SH.registerOfficial(o);
      if (m.admin !== undefined) { admin = !!m.admin; $('adminBtn').classList.toggle('hidden', !admin); }
      if ((m.list || []).length) D.rebuildCards();
      return true;
    case 'offdel': D.SH.unregisterOfficial(m.id); D.rebuildCards(); return true;
    case 'mysubs': mySubs = m.list || []; D.onSubs(); return true;
    case 'submitted': D.toast(m.text); return true;
    case 'admsubs': renderAdmin(m); return true;
  }
  return false;
}

const STATUS = { pending: '심사 중', approved: '승인됨 · 공식 맵', rejected: '거절됨' };
export const statusText = (s) => s ? STATUS[s.status] + (s.status === 'rejected' && s.why ? ` (${s.why})` : '') : '';

function renderAdmin(m) {
  const body = $('admBody');
  const card = (s) => `<div class="adm-row" data-sid="${esc(s.sid)}"><canvas width="64" height="64"></canvas>
    <div class="adm-info"><b>${esc(s.name)}</b><span class="dim">${esc(s.by)} · ${s.W}×${s.D}×${s.H} · ${day(s.at)}</span></div>
    <div class="adm-btns"><button class="btn tiny yellow" data-act="play">미리 플레이</button><button class="btn tiny green" data-act="ok">승인</button><button class="btn tiny red" data-act="no">거절</button></div></div>`;
  body.innerHTML = `<div class="ptitle small">심사 기다리는 맵 (${m.pending.length})</div>
    ${m.pending.length ? m.pending.map(card).join('') : '<div class="dim">출품된 맵이 없어요</div>'}
    <div class="ptitle small">공식 맵 (${m.official.length})</div>
    ${m.official.length ? m.official.map(o => `<div class="adm-row"><div class="adm-info"><b>${esc(o.name)}</b><span class="dim">${esc(o.by)} · ${day(o.at)}</span></div><div class="adm-btns"><button class="btn tiny red" data-del="${esc(o.id)}">공식 맵에서 내리기</button></div></div>`).join('') : '<div class="dim">아직 없어요</div>'}
    <div class="ptitle small">최근 처리</div>
    ${m.done.map(s => `<div class="adm-row small"><div class="adm-info"><b>${esc(s.name)}</b><span class="dim">${esc(s.by)} · ${statusText(s)}</span></div></div>`).join('') || '<div class="dim">없어요</div>'}`;
  body.querySelectorAll('.adm-row[data-sid]').forEach(row => {
    const s = m.pending.find(x => x.sid === row.dataset.sid);
    const th = D.thumb(Object.assign({ id: 'sub_' + s.sid, updated: s.at }, s.ent)); if (th) { const x = row.querySelector('canvas').getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(th, 0, 0, 64, 64); }
    row.querySelector('[data-act="play"]').onclick = () => { $('adminPanel').classList.add('hidden'); D.playEnt(Object.assign({ id: 'sub_' + s.sid }, s.ent)); };
    row.querySelector('[data-act="ok"]').onclick = () => {
      const name = prompt('공식 맵 이름 (그대로 두면 출품한 이름)', s.name);
      if (name === null) return;
      D.send({ t: 'admok', sid: s.sid, name });
    };
    row.querySelector('[data-act="no"]').onclick = () => {
      const why = prompt('거절 이유 (만든 사람에게 보여요, 비워도 돼요)', '');
      if (why === null) return;
      D.send({ t: 'admno', sid: s.sid, why });
    };
  });
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('이 맵을 공식 맵에서 내릴까요? (맵 목록·랜덤 맵에서 빠져요)')) D.send({ t: 'admdel', id: b.dataset.del }); });
}
