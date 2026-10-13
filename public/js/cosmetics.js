// 프로필: 레벨 / XP / 코인 / 보유 스킨 (브라우저에 저장)
import { CHAR_SKINS } from './skins/charSkins.js';
import { GUN_SKINS } from './skins/gunSkins.js';
import { RARITY, rarityOf } from './skins/rarity.js';
import { EMOTES, FREE_EMOTES } from './skins/emotes.js';
import { SPRAYS, FREE_SPRAYS, OLD_SPRAY_IDS } from './skins/sprays.js';
export { RARITY, rarityOf };
export const EMOTE_SLOTS = 8; // 감정표현 휠 칸 수

const KEY = 'pf_profile';
const DEF = { gold: 0, xp: 0, coins: 300, skins: ['default'], gskins: ['default'], skin: 'default', gskin: 'default', games: 0, kills: 0, wins: 0 };
export const profile = (() => {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* */ }
  return Object.assign({}, DEF, p);
})();
// 이름이 바뀐 옛 스킨 → 새 스킨
const RENAMED = { rainbow: 'prism' };
function fixProfile() {
  profile.gskins = [...new Set(profile.gskins.map(id => RENAMED[id] || id))];
  if (RENAMED[profile.gskin]) profile.gskin = RENAMED[profile.gskin];
  if (!CHAR_SKINS[profile.skin] || !profile.skins.includes(profile.skin)) profile.skin = 'default';
  if (!GUN_SKINS[profile.gskin] || !profile.gskins.includes(profile.gskin)) profile.gskin = 'default';
  // 감정표현·스프레이: 기본 몇 개만 무료, 나머지는 뽑기로 모음
  profile.emotes = [...new Set([...(Array.isArray(profile.emotes) ? profile.emotes : []), ...FREE_EMOTES])].filter(id => EMOTES.some(e => e.id === id));
  profile.sprays = [...new Set([...(Array.isArray(profile.sprays) ? profile.sprays : []), ...FREE_SPRAYS])].filter(id => SPRAYS.some(s => s.id === id));
  if (typeof profile.spray === 'number') profile.spray = OLD_SPRAY_IDS[profile.spray] || 'heart';
  if (!profile.sprays.includes(profile.spray)) profile.spray = FREE_SPRAYS[0];
  const slots = (Array.isArray(profile.emoteSlots) ? profile.emoteSlots : []).filter(id => profile.emotes.includes(id)).slice(0, EMOTE_SLOTS);
  profile.emoteSlots = slots.length ? slots : profile.emotes.slice(0, EMOTE_SLOTS);
}
fixProfile();

// 저장할 때마다 서버로도 보냄 (로그인 후 auth.js 가 연결)
let syncFn = null, syncT = 0;
export function setProfileSync(fn) { syncFn = fn; }
export function saveProfile() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* */ }
  if (syncFn) { clearTimeout(syncT); syncT = setTimeout(() => syncFn(profile), 400); }
}
// 서버에서 받은 프로필로 교체 (객체는 그대로 두고 내용만 바꿈 — 다른 모듈이 참조 중)
export function loadProfile(p) {
  const st = profile.stats;
  for (const k of Object.keys(profile)) delete profile[k];
  Object.assign(profile, DEF, JSON.parse(JSON.stringify(p || {})));
  if (st) { for (const k of Object.keys(st)) delete st[k]; Object.assign(st, profile.stats || {}); profile.stats = st; }
  fixProfile(); fixStats();
  if (!profile.ach) profile.ach = {};
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* */ }
}

// 레벨 n → n+1 에 필요한 XP: 300 + 150*(n-1)
export function levelInfo(xp) {
  let lv = 1, need = 300;
  while (xp >= need) { xp -= need; lv++; need = 300 + 150 * (lv - 1); }
  return { lv, cur: xp, need };
}
export const myLevel = () => levelInfo(profile.xp).lv;

// 매치 보상 계산 + 적용
export function grantMatch({ kills, caps, win, rank }) {
  const before = myLevel();
  const xp = 100 + kills * 25 + caps * 80 + (win ? 150 : 0) + (rank === 0 ? 100 : 0);
  // 코인 획득량 (이전 대비 약 40% 감소)
  const coins = 18 + kills * 6 + caps * 24 + (win ? 60 : 0) + (rank === 0 ? 30 : 0);
  profile.xp += xp; profile.coins += coins; profile.games++; profile.kills += kills; if (win) { profile.wins++; profile.gold += 5; }
  const after = myLevel();
  // 레벨업 보너스 코인
  const bonus = (after - before) * 100;
  profile.coins += bonus;
  saveProfile();
  return { xp, coins: coins + bonus, before, after, gold: win ? 5 : 0 };
}

export function buyItem(kind, id) {
  const list = kind === 'skin' ? CHAR_SKINS : GUN_SKINS, owned = kind === 'skin' ? profile.skins : profile.gskins;
  const it = list[id]; if (!it) return 'bad';
  if (owned.includes(id)) return 'have';
  if (myLevel() < it.lv) return 'level';
  if (it.gold) { if (profile.gold < it.gold) return 'gold'; profile.gold -= it.gold; }
  else { if (profile.coins < it.price) return 'coins'; profile.coins -= it.price; }
  owned.push(id); saveProfile();
  return 'ok';
}
export function equip(kind, id) {
  if (kind === 'skin' && profile.skins.includes(id)) profile.skin = id;
  if (kind === 'gskin' && profile.gskins.includes(id)) profile.gskin = id;
  if (kind === 'spray' && profile.sprays.includes(id)) profile.spray = id;
  if (kind === 'emote' && profile.emotes.includes(id)) {
    // 감정표현은 휠에 넣었다 뺐다 (최대 8개)
    const i = profile.emoteSlots.indexOf(id);
    if (i >= 0) { if (profile.emoteSlots.length > 1) profile.emoteSlots.splice(i, 1); }
    else if (profile.emoteSlots.length < EMOTE_SLOTS) profile.emoteSlots.push(id);
    else return 'full';
  }
  saveProfile();
  return 'ok';
}
// 종류별 보유 목록
export const ownedList = (kind) => ({ skin: profile.skins, gskin: profile.gskins, emote: profile.emotes, spray: profile.sprays })[kind];

export function addGold(n) { profile.gold += n; saveProfile(); }

/* ================= 전적 ================= */
if (!profile.stats) profile.stats = {};
const ST = profile.stats;
function fixStats() {
  for (const k of ['kills', 'deaths', 'hs', 'wins', 'games', 'bestStreak', 'multiMax', 'plants', 'defuses', 'crates', 'caps', 'heals']) if (ST[k] == null) ST[k] = 0;
  if (!ST.weapons) ST.weapons = {};
  if (!ST.modes) ST.modes = {};
}
fixStats();
export const stats = ST;

/* ================= 일일 미션 ================= */
const MISSION_POOL = [
  { type: 'kill', t: [10, 20, 30], name: (n) => `적 ${n}명 처치` },
  { type: 'hs', t: [5, 10], name: (n) => `헤드샷 처치 ${n}번` },
  { type: 'win', t: [1, 2], name: (n) => `매치 ${n}번 승리` },
  { type: 'game', t: [2, 3], name: (n) => `매치 ${n}번 끝까지 플레이` },
  { type: 'multi', t: [2, 3], name: (n) => `더블 킬 이상 ${n}번` },
  { type: 'cat:rifle', t: [8], name: (n) => `소총으로 ${n}명 처치` },
  { type: 'cat:smg', t: [8], name: (n) => `SMG·샷건으로 ${n}명 처치` },
  { type: 'cat:pistol', t: [5], name: (n) => `권총으로 ${n}명 처치` },
  { type: 'cat:heavy', t: [5], name: (n) => `중화기로 ${n}명 처치` },
  { type: 'cat:melee', t: [2], name: (n) => `근접 무기로 ${n}명 처치` },
  { type: 'crate', t: [2], name: (n) => `보급상자 ${n}개 열기` },
  { type: 'heal', t: [3, 5], name: (n) => `힐팩 ${n}번 먹기` },
  { type: 'plant', t: [1, 2], name: (n) => `스파이크 ${n}번 설치` },
  { type: 'mode:zombie', t: [1], name: () => '좀비 감염 한 판' },
  { type: 'mode:br', t: [1], name: () => '배틀로얄 한 판' },
  { type: 'mode:boss', t: [1], name: () => '보스전 한 판' },
  { type: 'mode:gungame', t: [1], name: () => '건게임 한 판' },
  { type: 'mode:spike', t: [1], name: () => '스파이크 한 판' },
];
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function dailyMissions() {
  const d = today();
  if (!profile.daily || profile.daily.date !== d) {
    let h = hashStr(d + (profile.seed || (profile.seed = Math.floor(Math.random() * 1e9))));
    const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
    const pool = MISSION_POOL.slice(), list = [];
    while (list.length < 3 && pool.length) {
      const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0], n = m.t[Math.floor(rnd() * m.t.length)];
      list.push({ type: m.type, target: n, name: m.name(n), prog: 0, done: false, coins: 70 + n * (m.type.startsWith('mode') ? 90 : m.type === 'win' ? 70 : 7), gold: m.type === 'win' || m.type.startsWith('mode') || n >= 20 ? 6 : 3 });
    }
    profile.daily = { date: d, list };
    saveProfile();
  }
  return profile.daily.list;
}
// 이벤트 → 미션 진행. 완료된 미션 목록 반환
export function missionEvent(type, n) {
  const done = [];
  for (const m of dailyMissions()) {
    if (m.done || m.type !== type) continue;
    m.prog = Math.min(m.target, m.prog + (n || 1));
    if (m.prog >= m.target) { m.done = true; profile.coins += m.coins; profile.gold += m.gold; done.push(m); }
  }
  if (done.length) saveProfile();
  return done;
}

/* ================= 업적 ================= */
export const ACHIEVEMENTS = [
  { id: 'k1', name: '첫 사냥', desc: '처음으로 적 처치', test: () => ST.kills >= 1, gold: 5 },
  { id: 'k100', name: '백전노장', desc: '누적 100킬', test: () => ST.kills >= 100, gold: 15 },
  { id: 'k500', name: '학살자', desc: '누적 500킬', test: () => ST.kills >= 500, gold: 40 },
  { id: 'k1000', name: '전설의 총잡이', desc: '누적 1000킬', test: () => ST.kills >= 1000, gold: 80 },
  { id: 'hs50', name: '명사수', desc: '헤드샷 50번', test: () => ST.hs >= 50, gold: 15 },
  { id: 'hs200', name: '저격의 신', desc: '헤드샷 200번', test: () => ST.hs >= 200, gold: 40 },
  { id: 'penta', name: '펜타킬!', desc: '4.5초 안에 5명 연속 처치', test: () => ST.multiMax >= 5, gold: 30 },
  { id: 'st10', name: '멈출 수 없어', desc: '죽지 않고 10연속 처치', test: () => ST.bestStreak >= 10, gold: 25 },
  { id: 'w1', name: '첫 승리', desc: '매치 첫 승리', test: () => ST.wins >= 1, gold: 5 },
  { id: 'w25', name: '승리의 맛', desc: '25번 승리', test: () => ST.wins >= 25, gold: 25 },
  { id: 'w100', name: '챔피언', desc: '100번 승리', test: () => ST.wins >= 100, gold: 60 },
  { id: 'plant10', name: '폭파 전문가', desc: '스파이크 10번 설치', test: () => ST.plants >= 10, gold: 20 },
  { id: 'def5', name: '해체반', desc: '스파이크 5번 해체', test: () => ST.defuses >= 5, gold: 20 },
  { id: 'crate20', name: '보급왕', desc: '보급상자 20개 열기', test: () => ST.crates >= 20, gold: 20 },
  { id: 'allmodes', name: '만능 플레이어', desc: '8가지 모드를 모두 플레이', test: () => ['ffa', 'tdm', 'ctf', 'spike', 'zombie', 'gungame', 'br', 'boss'].every(m => ST.modes[m]), gold: 40 },
  { id: 'lv10', name: '레벨 10', desc: '레벨 10 달성', test: () => myLevel() >= 10, gold: 20 },
  { id: 'lv25', name: '레벨 25', desc: '레벨 25 달성', test: () => myLevel() >= 25, gold: 50 },
  { id: 'col10', name: '수집가', desc: '스킨 10개 모으기', test: () => profile.skins.length + profile.gskins.length - 2 >= 10, gold: 25 },
];
if (!profile.ach) profile.ach = {};
// 새로 달성한 업적 반환 (보상 지급)
export function checkAchievements() {
  const got = [];
  for (const a of ACHIEVEMENTS) if (!profile.ach[a.id] && a.test()) { profile.ach[a.id] = Date.now(); profile.gold += a.gold; got.push(a); }
  if (got.length) saveProfile();
  return got;
}

/* ================= 골드 뽑기 상자 ================= */
export const GACHA_COST = 30;
export function rollGacha() {
  if (profile.gold < GACHA_COST) return { err: 'gold' };
  profile.gold -= GACHA_COST;
  const all = [];
  for (const [id, it] of Object.entries(CHAR_SKINS)) if (id !== 'default') all.push({ kind: 'skin', id, it, r: rarityOf(it) });
  for (const [id, it] of Object.entries(GUN_SKINS)) if (id !== 'default') all.push({ kind: 'gskin', id, it, r: rarityOf(it) });
  for (const it of EMOTES) if (!it.free) all.push({ kind: 'emote', id: it.id, it, r: it.r });
  for (const it of SPRAYS) if (!it.free) all.push({ kind: 'spray', id: it.id, it, r: it.r });
  let x = Math.random() * RARITY.reduce((a, b) => a + b.w, 0), tier = 'common';
  for (const t of RARITY) { if ((x -= t.w) < 0) { tier = t.id; break; } }
  const pool = all.filter(o => o.r === tier);
  const pickd = pool[Math.floor(Math.random() * pool.length)];
  const owned = ownedList(pickd.kind);
  let dup = false;
  if (owned.includes(pickd.id)) { dup = true; profile.coins += RARITY.find(t => t.id === tier).dup; }
  else owned.push(pickd.id);
  saveProfile();
  return Object.assign({ dup }, pickd);
}
