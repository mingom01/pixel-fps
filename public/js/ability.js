// 능력전 (클라): 능력자 선택 · Q 스킬 / X 궁극기 · HUD · 효과
// main.js 가 initAbility(D) 로 필요한 것들을 넘겨줌
const SH = window.SH;
const { HEROES, ABIL } = SH;
let D = null;
export function initAbility(deps) { D = deps; }

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexN = (css) => parseInt(css.slice(1), 16);

// 능력 아이콘 (8x8 픽셀)
const ICONS = {
  'jett.q': ['...XX...', '..XXXX..', '.XX..XX.', 'XX....XX', '...XX...', '..XXXX..', '.XX..XX.', 'XX....XX'],
  'jett.x': ['X..X..X.', '.X..X..X', '..X..X..', 'XXXXXXXX', 'XXXXXXXX', '..X..X..', '.X..X..X', 'X..X..X.'],
  'sage.q': ['...XX...', '...XX...', '...XX...', 'XXXXXXXX', 'XXXXXXXX', '...XX...', '...XX...', '...XX...'],
  'sage.x': ['..XXXX..', '.X....X.', 'X..XX..X', 'X.XXXX.X', 'X.XXXX.X', 'X..XX..X', '.X....X.', '..XXXX..'],
  'sova.q': ['......XX', '.....XXX', '....XXX.', 'X..XXX..', '.XXXX...', '..XX....', '.XXX....', 'XX......'],
  'sova.x': ['..XXXX..', '.XX..XX.', 'XX.XX.XX', 'X.XXXX.X', 'X.XXXX.X', 'XX.XX.XX', '.XX..XX.', '..XXXX..'],
  'raze.q': ['....XX..', '...X..X.', '..XXX...', '.XXXXX..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXX..', '..XXX...'],
  'raze.x': ['.......X', '......XX', '.....XX.', 'X...XX..', 'XX.XX...', '.XXX....', 'XXXX....', 'XX......'],
  'ghost.q': ['X......X', '.X....X.', '..X..X..', '...XX...', '...XX...', '..X..X..', '.X....X.', 'X......X'],
  'ghost.x': ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'X.X..X.X', '........'],
  'wall.q': ['XXXXXXXX', 'X..X..X.', 'XXXXXXXX', '.X..X..X', 'XXXXXXXX', 'X..X..X.', 'XXXXXXXX', '.X..X..X'],
  'wall.x': ['.XXXXXX.', 'XXXXXXXX', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'],
};
const iconCache = {};
export function abilIcon(hero, k, px) {
  px = px || 4;
  const key = hero + k + px; if (iconCache[key]) return iconCache[key];
  const rows = ICONS[hero + '.' + k] || ICONS['jett.q'], col = (HEROES[hero] || HEROES.jett).color;
  const c = document.createElement('canvas'); c.width = c.height = 10 * px; const x = c.getContext('2d');
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => {
    if (ch !== 'X') return;
    x.fillStyle = '#0b0c0e'; x.fillRect((xx + 1) * px - 1, (yy + 1) * px - 1, px + 2, px + 2);
  }));
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch === 'X') { x.fillStyle = col; x.fillRect((xx + 1) * px, (yy + 1) * px, px, px); } }));
  return (iconCache[key] = c.toDataURL());
}

/* ---------- 능력자 선택 (상점 위쪽) ---------- */
export function heroPickerHtml(cur) {
  return `<div class="bcat">능력자 <small class="dim">죽어 있거나 부활 직후에 바꿀 수 있어요 · Q 스킬 · X 궁극기 (처치·30초마다 충전)</small></div><div class="heroes">`
    + Object.entries(HEROES).map(([id, h]) => `<div class="hero ${id === cur ? 'on' : ''}" data-hero="${id}" style="--hc:${h.color}">
      <div class="hn">${esc(h.name)} <small>${esc(h.role)}</small></div>
      <div class="ha"><img src="${abilIcon(id, 'q', 2)}"><b>Q</b> ${esc(h.q.name)} <small>${h.q.cd}초</small><div class="hd">${esc(h.q.desc)}</div></div>
      <div class="ha"><img src="${abilIcon(id, 'x', 2)}"><b>X</b> ${esc(h.x.name)} <small>${h.x.cost}점</small><div class="hd">${esc(h.x.desc)}</div></div></div>`).join('') + '</div>';
}
export function bindHeroPicker(box) {
  box.querySelectorAll('[data-hero]').forEach(el => el.onclick = () => {
    D.send({ t: 'hero', h: el.dataset.hero });
    D.cfg.hero = el.dataset.hero; D.saveCfg();
    D.A.sfxSwitch();
  });
}

/* ---------- 사용 ---------- */
export function tryAbility(k) {
  const me = D.me, H = HEROES[me.hero];
  if (!H || !me.alive) return;
  const now = D.serverNow();
  if (k === 'q' && now < (me.qAt || 0)) { D.toast(`${H.q.name} 재사용 대기 ${Math.ceil((me.qAt - now) / 1000)}초`); D.A.sfxDeny(); return; }
  if (k === 'x' && (me.ult || 0) < H.x.cost) { D.toast(`궁극기 충전 중 (${me.ult || 0} / ${H.x.cost})`); D.A.sfxDeny(); return; }
  D.send({ t: 'ab', k });
}

// 서버가 확인한 능력 사용 → 효과
export function onAb(m) {
  const S = D.S, me = D.me, mine = m.id === S.myId;
  const H = HEROES[m.h]; if (!H) return;
  const e = mine ? null : S.ents.get(m.id);
  const pos = mine ? { x: me.x, y: me.y, z: me.z } : e ? { x: e.rx, y: e.ry, z: e.rz } : null;
  const col = hexN(H.color);
  const name = (S.roster.get(m.id) || {}).name || '?';
  if (m.k === 'x') {
    const ally = mine || D.isMate(m.id);
    D.showBig(`${mine ? '나' : name}: ${H.x.name}!`, ally ? H.color : '#ff6a5a', 1600);
    D.A.sfxStreak();
  } else D.A.sfxPick();
  if (mine) {
    const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    if (m.h === 'jett' && m.k === 'q') { // 돌진
      me.vx = fx * ABIL.DASH; me.vz = fz * ABIL.DASH; me.vy = Math.max(me.vy, 2.5); me.ground = false; me.sliding = false;
      D.state.dashT = 0.22;
    }
    if (m.h === 'ghost' && m.k === 'q') { // 순간이동: 벽 앞까지
      const ex = me.x, ez = me.z, ey = me.y + 1.0;
      let dist = ABIL.BLINK;
      const h = SH.raycast(S.map, ex, ey, ez, fx, 0, fz, ABIL.BLINK);
      if (h) dist = Math.max(0, h.t - 0.6);
      for (let d = dist; d > 0; d -= 0.25) {
        const nx = ex + fx * d, nz = ez + fz * d;
        if (!SH.bodyHits(S.map, nx, me.y, nz, me.h)) { me.x = nx; me.z = nz; break; }
      }
      D.flash(0.25, '#c08aff');
    }
  }
  if (!pos) return;
  const P = D.spawnParticle;
  if (m.h === 'jett') for (let i = 0; i < 20; i++) P(pos.x, pos.y + Math.random() * 1.6, pos.z, (Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4, 0xd8ffff, 0.5, 0.08, 0);
  else if (m.h === 'sage') for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, r = m.k === 'x' ? 8 : 6; P(pos.x + Math.cos(a) * 0.5, pos.y + 0.2, pos.z + Math.sin(a) * 0.5, Math.cos(a) * r, 1.5, Math.sin(a) * r, i % 2 ? 0x7df07d : 0xffffff, 0.8, 0.12, 0); }
  else if (m.h === 'sova') for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; P(pos.x, pos.y + 1.2, pos.z, Math.cos(a) * 14, 0, Math.sin(a) * 14, 0x6ab0ff, 0.9, 0.1, 0); }
  else if (m.h === 'ghost') {
    const from = m.from ? { x: m.from[0], y: m.from[1], z: m.from[2] } : pos;
    for (let i = 0; i < 30; i++) P(from.x + (Math.random() - 0.5), from.y + Math.random() * 1.8, from.z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, i % 2 ? 0xc08aff : 0x2a1040, 0.9, 0.14, -1);
  } else if (m.h === 'wall' && m.k === 'x') for (let i = 0; i < 24; i++) P(pos.x, pos.y + 1, pos.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0xc8c8d0, 0.6, 0.12, 6);
  // 정찰: 우리 편에게 적 위치 표시
  if (m.ids && (mine || D.isMate(m.id))) {
    for (const id of m.ids) S.reveal.set(id, m.until);
    if (!mine) D.toast(`${name}: ${m.k === 'x' ? H.x.name : H.q.name} — 적 ${m.ids.length}명 표시`);
  }
  void col;
}

// 블록 생김/사라짐 (철벽 방벽)
export function onBlk(m) {
  const S = D.S; if (!S.map) return;
  const cells = [];
  for (const [x, y, z, b] of m.set) {
    const old = S.map.get(x, y, z);
    S.map.set(x, y, z, b); cells.push([x, y, z]);
    const c = b ? 0xd8d0c0 : (D.BLOCK_COLOR[old] || 0x888888);
    for (let i = 0; i < 2; i++) D.spawnParticle(x + Math.random(), y + Math.random(), z + Math.random(), (Math.random() - 0.5) * 2, Math.random() * 3, (Math.random() - 0.5) * 2, c, 0.6, 0.15, 8);
  }
  D.rebuildBlocks(cells);
  // 내가 블록 안에 끼었으면 위로
  const me = D.me;
  if (me.alive && SH.bodyHits(S.map, me.x, me.y, me.z, me.h)) { for (let i = 0; i < 6 && SH.bodyHits(S.map, me.x, me.y, me.z, me.h); i++) me.y += 1; }
}

/* ---------- HUD ---------- */
export function abilityHud() {
  const box = document.getElementById('abilHud');
  const S = D.S, me = D.me;
  const on = S.mode === 'ability' && S.inGame;
  box.classList.toggle('hidden', !on); document.body.classList.toggle('abil', on);
  if (!on) return;
  const H = HEROES[me.hero] || HEROES.jett, now = D.serverNow();
  const qLeft = Math.max(0, ((me.qAt || 0) - now) / 1000), ult = me.ult || 0;
  const key = me.hero + Math.ceil(qLeft) + '|' + ult + '|' + (now < (me.haste || 0)) + (now < (me.steel || 0)) + (now < (me.invis || 0));
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  const buff = now < (me.haste || 0) ? '질주 중' : now < (me.steel || 0) ? '강철 피부' : now < (me.invis || 0) ? '투명' : '';
  box.innerHTML = `<div class="ab-name" style="color:${H.color}">${esc(H.name)}${buff ? ` <span class="ab-buff">${buff}</span>` : ''}</div>
    <div class="ab ${qLeft > 0 ? 'cd' : 'ready'}"><img src="${abilIcon(me.hero, 'q', 3)}"><b>Q</b>${qLeft > 0 ? `<span class="ab-t">${Math.ceil(qLeft)}</span>` : ''}<div class="ab-l">${esc(H.q.name)}</div></div>
    <div class="ab ult ${ult >= H.x.cost ? 'ready' : 'cd'}"><img src="${abilIcon(me.hero, 'x', 3)}"><b>X</b><div class="pips">${Array.from({ length: H.x.cost }, (_, i) => `<i class="${i < ult ? 'on' : ''}"></i>`).join('')}</div><div class="ab-l">${esc(H.x.name)}</div></div>`;
}

// 다른 사람 모델: 투명(256) · 강철(512) · 질주(1024)
export function abilityModelFx(e, fl, mate) {
  if (fl & 256) {
    if (!mate) { e.model.visible = Math.random() < 0.04; e.tag.visible = false; }
    else e.model.visible = Math.floor(performance.now() / 200) % 2 === 0;
  }
  if ((fl & 1024) && Math.random() < 0.4) D.spawnParticle(e.rx + (Math.random() - 0.5) * 0.6, e.ry + Math.random() * 1.6, e.rz + (Math.random() - 0.5) * 0.6, 0, 0.5, 0, 0xd8ffff, 0.3, 0.06, 0);
  if ((fl & 512) && Math.random() < 0.3) D.spawnParticle(e.rx + (Math.random() - 0.5) * 0.8, e.ry + Math.random() * 1.8, e.rz + (Math.random() - 0.5) * 0.8, 0, 0.3, 0, 0xc8c8d0, 0.4, 0.09, 0);
}
