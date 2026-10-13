// 꾸미기 상점의 캐릭터/총 스킨 탭: 등급순 카드, 눌러서 미리보기 → 구매/장착 버튼
import { profile, myLevel, buyItem, equip, ACHIEVEMENTS } from '../cosmetics.js';
import { CHAR_SKINS } from '../skins/charSkins.js';
import { GUN_SKINS } from '../skins/gunSkins.js';
import { RARITY_BY, RARITY_ORDER, RARITY_PERKS, rarityOf } from '../skins/rarity.js';
import { sfxSkinShot, sfxSkinKill, sfxFinisher, sfxSkinStep, sfxEquip } from '../skins/skinSounds.js';
import { gunIcon } from '../models.js';
import * as A from '../audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let D = null, pickId = null, pickKind = null, filter = 'all';
const FILTERS = [['all', '전체'], ['legend', '전설'], ['epic', '영웅'], ['rare', '레어'], ['common', '일반'], ['own', '보유']];

// deps = { thumb(id), preview({ skin, gskin, gunShow }), toast(text), changed() }
export function initSkinShop(deps) { D = deps; }

const listOf = (kind) => kind === 'skin' ? CHAR_SKINS : GUN_SKINS;
const ownedOf = (kind) => kind === 'skin' ? profile.skins : profile.gskins;
const curOf = (kind) => kind === 'skin' ? profile.skin : profile.gskin;

function priceHtml(it) {
  if (it.r === 'legend') return `<i class="coin"></i> ${it.price.toLocaleString()} + <i class="goldc"></i> ${it.gold}`;
  return it.gold ? `<i class="goldc"></i> ${it.gold} 골드` : `<i class="coin"></i> ${it.price}`;
}
// 전설: 무료로 받을 수 있는 업적 안내
function achHtml(it) {
  const a = it.ach && ACHIEVEMENTS.find(x => x.id === it.ach); if (!a) return '';
  const done = profile.ach && profile.ach[a.id];
  return `<div class="sk-ach ${done ? 'done' : ''}">업적 <b>[${esc(a.name)}]</b> ${esc(a.desc)} ${done ? '· 달성!' : '→ 무료 획득'}</div>`;
}

export function renderSkinShop(kind) {
  if (pickKind !== kind) { pickKind = kind; pickId = curOf(kind); }
  const list = listOf(kind), owned = ownedOf(kind), cur = curOf(kind), lv = myLevel();
  const ids = Object.keys(list).filter(id => filter === 'all' || (filter === 'own' ? owned.includes(id) : rarityOf(list[id]) === filter)).sort((a, b) => RARITY_ORDER[rarityOf(list[a])] - RARITY_ORDER[rarityOf(list[b])] || (list[a].gold || 0) - (list[b].gold || 0) || (list[a].price || 0) - (list[b].price || 0));
  const cnt = (f) => Object.keys(list).filter(id => f === 'all' || (f === 'own' ? owned.includes(id) : rarityOf(list[id]) === f)).length;
  $('lockerGrid').innerHTML = `<div class="sk-filter">${FILTERS.map(([f, n]) => `<button data-f="${f}" class="${filter === f ? 'on' : ''} ${f !== 'all' && f !== 'own' ? 'r-' + f : ''}">${n} <small>${cnt(f)}</small></button>`).join('')}</div>` + ids.map(id => {
    const it = list[id], r = rarityOf(it), own = owned.includes(id), lock = !own && lv < it.lv;
    const th = kind === 'skin' ? D.thumb(id) : gunIcon('rifle', 2, id);
    const pr = own ? `<div class="pr own">${id === cur ? '장착 중' : '보유'}</div>` : lock ? `<div class="pr lv">Lv.${it.lv} 필요</div>` : `<div class="pr ${it.gold ? 'gold' : ''}">${priceHtml(it)}</div>`;
    const gc = it.glow ? `style="--gc:#${it.glow.c1.toString(16).padStart(6, '0')}"` : it.halo ? `style="--gc:#${it.halo.toString(16).padStart(6, '0')}"` : '';
    return `<div class="lcard r-${r} ${id === cur ? 'eq' : ''} ${id === pickId ? 'sel' : ''} ${lock ? 'lock' : ''}" data-id="${id}" ${gc}><div class="rtag">${RARITY_BY[r].name}</div><div class="th"><img src="${th}"></div><div class="nm">${esc(it.name)}</div>${pr}</div>`;
  }).join('');
  $('lockerGrid').querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; renderSkinShop(kind); });
  $('lockerGrid').querySelectorAll('.lcard').forEach(c => c.onclick = () => { pickId = c.dataset.id; A.sfxSwitch(); renderSkinShop(kind); demo(kind, pickId, true); });
  renderInfo(kind);
  D.preview(kind === 'skin' ? { skin: pickId } : { gskin: pickId, gunShow: true });
}

function renderInfo(kind) {
  const it = listOf(kind)[pickId]; if (!it) return;
  const r = rarityOf(it), R = RARITY_BY[r], own = ownedOf(kind).includes(pickId), eq = curOf(kind) === pickId, lock = !own && myLevel() < it.lv;
  const btn = eq ? '<button class="btn wide" disabled>장착 중</button>'
    : own ? '<button class="btn green wide" id="skAct">장착하기</button>'
      : lock ? `<button class="btn wide" disabled>Lv.${it.lv} 필요</button>`
        : `<button class="btn yellow wide" id="skAct">구매 · ${priceHtml(it)}</button>`;
  $('lockerSel').innerHTML = `<div class="skinfo r-${r}"><div class="sk-r" style="color:${R.color}">${R.name}</div><div class="sk-n">${esc(it.name)}</div>
    <div class="sk-p">${RARITY_PERKS[kind][r]}</div>${own ? '' : achHtml(it)}${btn}${r !== 'common' ? '<button class="btn tiny blue wide" id="skDemo">효과 미리보기 ♪</button>' : ''}</div>`;
  const act = $('skAct');
  if (act) act.onclick = () => {
    if (!own) {
      const res = buyItem(kind, pickId);
      if (res !== 'ok') { A.sfxDeny(); D.toast({ coins: '코인이 부족해요', gold: '골드가 부족해요 (킬·미션·업적으로 모아요)', level: '레벨이 부족해요' }[res] || '살 수 없어요'); return; }
      if (r === 'legend' || r === 'epic') A.sfxFanfare(); else A.sfxBuy();
    } else A.sfxBuy();
    equip(kind, pickId); D.changed(); renderSkinShop(kind);
  };
  const dm = $('skDemo'); if (dm) dm.onclick = () => demo(kind, pickId, false);
}

// 효과음 미리 듣기 (카드 누를 땐 짧게, 버튼은 전부)
function demo(kind, id, short) {
  A.initAudio();
  const it = listOf(kind)[id]; if (!it || !it.fx) return;
  if (kind === 'skin') { sfxSkinStep(it.fx.step, 1); if (!short) setTimeout(() => sfxSkinStep(it.fx.step, 1), 280); return; }
  if (it.r === 'legend' && !short) sfxEquip(it.fx.snd);
  const t0 = it.r === 'legend' && !short ? 700 : 0;
  setTimeout(() => { A.sfxShot('rifle', 0.6, 0); sfxSkinShot(it.fx.snd, 1, 0); }, t0);
  if (short) return;
  setTimeout(() => { A.sfxShot('rifle', 0.6, 0); sfxSkinShot(it.fx.snd, 1, 0); }, t0 + 160);
  if (it.r === 'epic') setTimeout(() => sfxSkinKill(it.fx.snd), t0 + 500);
  if (it.r === 'legend') setTimeout(() => sfxFinisher(it.finisher), t0 + 500);
}
