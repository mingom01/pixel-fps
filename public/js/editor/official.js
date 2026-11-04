// 출품 맵 (클라이언트)
// - 로그인하면 서버가 출품 맵 목록을 보내줌 → SH.registerOfficial 로 등록 ('off_<id>') → 대기실 '출품 맵' 탭·랜덤에 나옴
// - 맵 에디터 시작 창: 내 맵마다 '출품' (승인 없이 바로 공개) / '출품 취소', 출품 중 표시
// - 관리자: 메인 메뉴 '출품 맵 관리' → 미리 플레이 · 내리기
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (t) => t ? new Date(t).toLocaleDateString() : '';

// deps = { send, SH, toast, myName(), rebuildCards(바뀐 맵 id 목록), playMapId(id), thumbOf(id) → canvas, onSubs() }
let D = null, admin = false, mySubs = [];
export function initOfficial(deps) {
  D = deps;
  const el = document.createElement('div');
  el.id = 'adminPanel'; el.className = 'modal hidden';
  el.innerHTML = `<div class="panel adm"><div class="ptitle">출품 맵 관리 <span class="dim adm-sub">관리자 · 문제 있는 맵을 내릴 수 있어요</span><button id="admClose" class="btn tiny red right">닫기</button></div><div id="admBody" class="adm-body">불러오는 중…</div></div>`;
  document.body.appendChild(el);
  $('admClose').onclick = () => el.classList.add('hidden');
  $('adminBtn').onclick = () => { el.classList.remove('hidden'); $('admBody').textContent = '불러오는 중…'; D.send({ t: 'admsubs' }); };
}
export const isAdmin = () => admin;
// 내 맵(mid)이 출품 중이면 그 정보
export const subOf = (mid) => mySubs.find(s => s.mid === mid) || null;

export function submitMap(ent) {
  const again = !!subOf(ent.id);
  if (!confirm(again ? `'${ent.name}' 출품 맵을 지금 버전으로 바꿀까요?` : `'${ent.name}' 맵을 출품할까요?\n바로 모든 사람의 '출품 맵' 목록과 빠른 시작·랜덤 모드에 나와요.`)) return;
  D.send({ t: 'submit', ent, by: D.myName() });
}
export function unsubmitMap(ent) {
  if (!confirm(`'${ent.name}' 출품을 취소할까요? (내 맵은 그대로 남아요)`)) return;
  D.send({ t: 'unsubmit', mid: ent.id });
}

// 서버 메시지 (처리했으면 true)
export function officialMsg(m) {
  switch (m.t) {
    case 'official': {
      // 새 출품 맵, 또는 만든 사람이 고친 새 버전 (upd) → 다시 등록하면 다음 판부터 새 버전
      const ids = (m.list || []).map(o => D.SH.registerOfficial(o));
      if (m.admin !== undefined) { admin = !!m.admin; $('adminBtn').classList.toggle('hidden', !admin); }
      if (ids.length) D.rebuildCards(ids);
      return true;
    }
    case 'offdel': D.SH.unregisterOfficial(m.id); D.rebuildCards(['off_' + m.id]); return true;
    case 'mysubs': mySubs = m.list || []; D.onSubs(); return true;
    case 'submitted': D.toast(m.text); return true;
    case 'admsubs': renderAdmin(m.list || []); return true;
  }
  return false;
}

function renderAdmin(list) {
  const body = $('admBody');
  body.innerHTML = `<div class="ptitle small">출품 맵 (${list.length})</div>`
    + (list.length ? list.map(o => `<div class="adm-row" data-id="${esc(o.id)}"><canvas width="64" height="64"></canvas>
      <div class="adm-info"><b>${esc(o.name)}</b><span class="dim">${esc(o.by)} · ${o.W}×${o.D}×${o.H} · 출품 ${day(o.at)}${o.upd && o.upd !== o.at ? ` · 수정 ${day(o.upd)}` : ''}</span></div>
      <div class="adm-btns"><button class="btn tiny yellow" data-act="play">미리 플레이</button><button class="btn tiny red" data-act="del">내리기</button></div></div>`).join('') : '<div class="dim">출품된 맵이 없어요</div>');
  body.querySelectorAll('.adm-row').forEach(row => {
    const id = row.dataset.id, mid = 'off_' + id;
    const th = D.SH.MAPS[mid] && D.thumbOf(mid); if (th) { const x = row.querySelector('canvas').getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(th, 0, 0, 64, 64); }
    row.querySelector('[data-act="play"]').onclick = () => { $('adminPanel').classList.add('hidden'); D.playMapId(mid); };
    row.querySelector('[data-act="del"]').onclick = () => { if (confirm('이 맵을 출품 맵에서 내릴까요? (모든 사람의 목록에서 빠져요)')) D.send({ t: 'admdel', id }); };
  });
}
