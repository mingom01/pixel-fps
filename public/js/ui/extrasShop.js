// 꾸미기 상점의 감정표현 / 스프레이 탭: 보유한 것만 장착, 나머지는 골드 뽑기에서 획득
import { profile, equip, ownedList, EMOTE_SLOTS } from '../cosmetics.js';
import { EMOTES, EMOTE_BY, emoteIcon } from '../skins/emotes.js';
import { SPRAYS, SPRAY_BY, sprayCanvas } from '../skins/sprays.js';
import { RARITY_BY, RARITY_ORDER } from '../skins/rarity.js';
import * as A from '../audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let D = null, pick = { emote: null, spray: null };
const sprayImg = {};
const sprayUrl = (id) => sprayImg[id] || (sprayImg[id] = sprayCanvas(id, 4).toDataURL());

// deps = { previewEmote(id), toast(text) }
export function initExtrasShop(deps) { D = deps; }

export function renderExtras(kind) {
  const list = kind === 'emote' ? EMOTES : SPRAYS, owned = ownedList(kind);
  const isOn = (id) => kind === 'emote' ? profile.emoteSlots.includes(id) : profile.spray === id;
  const items = list.slice().sort((a, b) => (owned.includes(b.id) - owned.includes(a.id)) || RARITY_ORDER[a.r] - RARITY_ORDER[b.r]);
  const have = list.filter(i => owned.includes(i.id)).length;
  $('lockerGrid').innerHTML = `<div class="ex-head">${kind === 'emote' ? `감정표현 ${have}/${list.length} 보유 · 휠에 ${profile.emoteSlots.length}/${EMOTE_SLOTS}개 장착 (게임 중 Y 키)` : `스프레이 ${have}/${list.length} 보유 (게임 중 T 키)`} · 나머지는 <b>골드 뽑기</b>에서 나와요</div>`
    + items.map(it => {
      const own = owned.includes(it.id), on = isOn(it.id), th = kind === 'emote' ? emoteIcon(it.id, 48) : sprayUrl(it.id);
      const st = !own ? '뽑기에서 획득' : on ? (kind === 'emote' ? '휠에 장착됨' : '사용 중') : (kind === 'emote' ? '눌러서 휠에 넣기' : '눌러서 사용');
      return `<div class="lcard r-${it.r} ${on ? 'eq' : ''} ${own ? '' : 'lock'} ${pick[kind] === it.id ? 'sel' : ''}" data-id="${it.id}"><div class="rtag">${RARITY_BY[it.r].name}</div><div class="th"><img src="${th}"></div><div class="nm">${esc(it.name)}</div><div class="pr ${own ? 'own' : ''}">${st}</div></div>`;
    }).join('');
  $('lockerGrid').querySelectorAll('.lcard').forEach(c => c.onclick = () => {
    const id = c.dataset.id; pick[kind] = id;
    if (kind === 'emote') D.previewEmote(id); else A.sfxSpray(1);
    if (owned.includes(id)) {
      const res = equip(kind, id);
      if (res === 'full') { A.sfxDeny(); D.toast(`휠은 ${EMOTE_SLOTS}개까지예요. 장착된 걸 눌러서 빼 주세요`); }
      else A.sfxSwitch();
    }
    renderExtras(kind);
  });
  const sel = pick[kind] && (kind === 'emote' ? EMOTE_BY[pick[kind]] : SPRAY_BY[pick[kind]]);
  if (sel) {
    const R = RARITY_BY[sel.r];
    $('lockerSel').innerHTML = `<div class="skinfo r-${sel.r}"><div class="sk-r" style="color:${R.color}">${R.name}</div><div class="sk-n">${esc(sel.name)}</div>${kind === 'spray' ? `<img class="ex-big" src="${sprayUrl(sel.id)}">` : ''}<div class="sk-p">${owned.includes(sel.id) ? '보유 중' : '골드 뽑기에서 얻을 수 있어요'}</div></div>`;
  } else $('lockerSel').textContent = '';
}
