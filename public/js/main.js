// 픽셀 스트라이크 — 클라이언트
import * as THREE from '../lib/three.module.min.js';
import { initTouch } from './touch.js';
import { FACES, ATLAS_COLS, makeAtlas, PCOLORS, flashTex, smokeTex, holeTex, textSprite, BLOCK_COLOR, skinMats, CHAR_SKINS } from './tex.js';
import { makeGun, makeChar, setCharGun, animChar, gunIcon, gunLength, GUNS, GUN_SKINS } from './models.js';
import { buildWorld, buildSky, rebuildBlocks, disposeWorld } from './world.js';
import { profile, saveProfile, levelInfo, myLevel, grantMatch, buyItem, equip, addGold, stats, dailyMissions, missionEvent, ACHIEVEMENTS, checkAchievements, GACHA_COST, RARITY, rollGacha } from './cosmetics.js';
import * as A from './audio.js';
import { initAuth, onSocketOpen, handleAuthMsg, isAuthed } from './auth.js';
import { initSettings, openSettings, closeSettings, settingsOpen } from './settings/panel.js';
import { drawCross, getCross } from './settings/crosshair.js';
import { toGame, resetBindsCache } from './settings/keybinds.js';
import { showKillBanner, clearKillBanner } from './hud/killbanner.js';
import { TITLES, titleOwned, titleHow, buyTitle, equipTitle, myTitle, titleHtml } from './titles.js';
import { tickSkins } from './skins/gunMaterial.js';
import { tickAuras, decorateGun, fxColor, killEffect } from './skins/skinFx.js';
import { sfxSkinShot, sfxSkinKill, sfxFinisher, sfxEquip, sfxSkinStep } from './skins/skinSounds.js';
import { initSkinShop, renderSkinShop } from './ui/skinShop.js';
import { initExtrasShop, renderExtras } from './ui/extrasShop.js';
import { EMOTE_BY, applyEmote, clearEmotePose, emoteFx, emoteIcon } from './skins/emotes.js';
import { SPRAY_BY, sprayCanvas } from './skins/sprays.js';
import { initGimmicks, startGimmicks, setGimMap, stopGimmicks, onGimMsg, updateGimmicks, afterMove, groundAccMul, ENV_KILL } from './gimmicks.js';

const SH = window.SH;
const { WEAPONS, ITEMS, P, ECON } = SH;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hexs = (c) => '#' + c.toString(16).padStart(6, '0');

/* ================= 설정 ================= */
const CFG = Object.assign({ name: '', color: Math.floor(Math.random() * 12), sens: 1, fov: 80, vol: 0.6, killcam: true }, (() => { try { return JSON.parse(localStorage.getItem('pf_cfg') || '{}'); } catch (e) { return {}; } })());
function saveCfg() { try { localStorage.setItem('pf_cfg', JSON.stringify(CFG)); } catch (e) { /* */ } }
A.setVolume(CFG.vol);

/* ================= 렌더러 ================= */
const cv = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.autoClear = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.05, 600);
camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7080, 1.6));
const sunL = new THREE.DirectionalLight(0xffffff, 1.4); sunL.position.set(-0.6, 1, -0.4); scene.add(sunL);
const viewScene = new THREE.Scene();
const viewCam = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
viewScene.add(new THREE.HemisphereLight(0xffffff, 0x6a7080, 1.7));
const vsun = new THREE.DirectionalLight(0xffffff, 1.2); vsun.position.set(-0.5, 1, 0.6); viewScene.add(vsun);
const atlas = makeAtlas();
const FLASH = flashTex(), SMOKE = smokeTex(), HOLE = holeTex();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = viewCam.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix(); viewCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

/* ================= 상태 ================= */
const S = {
  myId: null, room: null, roster: new Map(), inGame: false, map: null, mapId: null, world: null, sky: null,
  turrets: new Map(), shopObjs: [], strikesFx: [], uavUntil: 0,
  sprays: new Map(), selfEmote: null, emoteOpen: false, touch: false, afterRoom: null,
  pickups: new Map(), crates: new Map(), targets: [], rangeLabels: [], pst: null, spikeObjs: [], spk: null, specId: null, plantOn: false, defOn: false,
  ents: new Map(), projs: new Map(), drops: new Map(), off: null, endAt: 0, killLimit: 25,
  modal: null, locked: false, dead: true, killer: null, deathPos: null, streak: 0,
  mode: 'ffa', score: [0, 0], target: 25, flags: null, flagObjs: [], kc: null, selfBuf: [], shotLog: [], myCaps: 0, ghost: null,
};
const TEAMS = SH.TEAMS;
const myTeam = () => { const r = S.roster.get(S.myId); return r ? r.team : -1; };
const isTeamMode = () => ['tdm', 'ctf', 'spike', 'zombie', 'boss'].includes(S.mode);
const isMate = (id) => isTeamMode() && id !== S.myId && myTeam() >= 0 && (S.roster.get(id) || {}).team === myTeam();
function nameColor(id) {
  const r = S.roster.get(id); if (!r) return '#ffffff';
  if (isTeamMode() && r.team >= 0) return TEAMS[r.team].css;
  return hexs(PCOLORS[r.color] || 0xffffff);
}
const me = {
  x: 32, y: 10, z: 32, vx: 0, vy: 0, vz: 0, h: P.H, ground: false, stepDy: 0, yaw: 0, pitch: 0,
  crouch: false, sliding: false, slideT: 0, jumps: 0, alive: false, hp: 100, armor: 0, money: 0,
  primary: null, secondary: 'pistol', nades: 0, buyUntil: 0, respawnAt: 0, prot: 0, eye: P.EYE, camOff: 0,
  helmet: false, perks: [], sup: { turret: 0, air: 0 }, maxHp: 100,
};
const WS = { cur: 'pistol', last: 'knife', fireT: 0, reloadT: 0, reloading: false, switchT: 0, ads: 0, spin: 0, recoil: 0, bloom: 0, trigger: false, semiReady: true, kick: 0, slashT: 0, lastFire: 0 };
const ammo = {};
const keys = {};
const serverNow = () => Date.now() + (S.off || 0);

function fullAmmo(w) { const W = WEAPONS[w]; if (W && W.mag) ammo[w] = { mag: W.mag, res: W.res }; }

/* ================= 네트워크 ================= */
let ws = null, wsOk = false;
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { wsOk = true; $('netState').textContent = '· 서버 연결됨'; onSocketOpen(); };
  ws.onclose = () => {
    wsOk = false; $('netState').textContent = '· 연결 끊김, 재접속 중…';
    if (S.inGame || S.room) { leaveGame(); showScreen('menu'); toast('서버 연결이 끊겼어요'); }
    S.room = null;
    setTimeout(connect, 1500);
  };
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
}
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
setInterval(() => { if (wsOk && isAuthed() && !S.room) send({ t: 'list' }); }, 3000);

// 로그인 완료 → 서버 프로필로 화면 갱신
function onLoggedIn(u) {
  if (!$('nameIn').value.trim() && u.name) { $('nameIn').value = u.name.slice(0, 10); CFG.name = $('nameIn').value; saveCfg(); }
  updateProfileUI(); refreshPreview(); updateMissionDot();
  resetBindsCache(); crossCfg = getCross();
  send({ t: 'list' });
}

function onMsg(m) {
  if (handleAuthMsg(m)) return;
  switch (m.t) {
    case 'hello': S.myId = m.id; break;
    case 'rooms': renderRoomList(m.list); break;
    case 'err': toast(m.text); break;
    case 'left': S.room = null; leaveGame(); showScreen('menu'); break;
    case 'room': onRoom(m); break;
    case 'start': startGame(m); break;
    case 'spawn': onSpawn(m); break;
    case 'me': onMe(m); break;
    case 's': onSnap(m); break;
    case 'shot': onRemoteShot(m); break;
    case 'dmg': onDamaged(m); break;
    case 'kill': onKill(m); break;
    case 'boom': onBoom(m); break;
    case 'proj': onProj(m); break;
    case 'drop': addDrop(m.d); break;
    case 'undrop': removeDrop(m.id); break;
    case 'got': fullAmmo(m.w); switchTo(m.w, true); A.sfxPick(); break;
    case 'buyres': onBuyRes(m); break;
    case 'gone': removeEnt(m.id); break;
    case 'chat': addChat(`<b style="color:${nameColor(m.id)}">${esc(m.name)}</b>: ${esc(m.text)}`); break;
    case 'score': S.score = m.s; break;
    case 'flag': onFlag(m); break;
    case 'uav': onUav(m); break;
    case 'strike': onStrike(m); break;
    case 'tgone': onTurretGone(m); break;
    case 'round': onRound(m); break;
    case 'rend': onRoundEnd(m); break;
    case 'spike': onSpikeEv(m); break;
    case 'crate': onCrate(m); break;
    case 'cratepick': onCratePick(m); break;
    case 'pk': onPickup(m); break;
    case 'rank': onRank(m); break;
    case 'emote': onEmote(m); break;
    case 'spray': onSpray(m); break;
    case 'zb': onZb(m); break;
    case 'gg': onGG(m); break;
    case 'boss': onBoss(m); break;
    case 'zone': if (m.ev === 'shrink') { showBig('자기장이 줄어들어요!', '#c08aff', 2200); A.sfxSiren(); } break;
    case 'sys': addChat(`<span style="color:#f4c22b">${esc(m.text)}</span>`); break;
    case 'end': onEnd(m); break;
    case 'gim': onGimMsg(m); break;
  }
}

/* ================= 메뉴 / 로비 ================= */
function showScreen(id) {
  for (const s of ['menu', 'lobby']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== 'game');
  if (id !== 'game') { closeModals(); $('clickToPlay').classList.add('hidden'); }
}
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2500); }

$('nameIn').value = CFG.name || '';
$('nameIn').addEventListener('input', () => { CFG.name = $('nameIn').value.trim(); saveCfg(); });
function myName() { const n = $('nameIn').value.trim(); return n || '플레이어' + (S.myId || '').slice(1); }
function joinInfo() { return { name: myName(), color: CFG.color, skin: profile.skin, gskin: profile.gskin, title: myTitle(), lv: myLevel() }; }
function buildSwatches() {
  const box = $('colors'); box.innerHTML = '';
  PCOLORS.forEach((c, i) => {
    const b = document.createElement('button'); b.style.background = hexs(c); if (i === CFG.color) b.classList.add('on');
    b.onclick = () => { CFG.color = i; saveCfg(); buildSwatches(); refreshPreview(); };
    box.appendChild(b);
  });
}
buildSwatches();

// 캐릭터 미리보기
const pv = { r: new THREE.WebGLRenderer({ canvas: $('preview'), alpha: true, antialias: false }), scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, 180 / 200, 0.1, 20), ch: null };
pv.r.setPixelRatio(1);
pv.scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.8)); const pvl = new THREE.DirectionalLight(0xffffff, 1.3); pvl.position.set(1, 2, -2); pv.scene.add(pvl);
pv.cam.position.set(0, 1.2, -4.3); pv.cam.lookAt(0, 0.95, 0);
// o = { skin, gskin, gunShow } — 상점에서 안 산 스킨도 미리보기. gunShow 면 총만 크게 돌려 보여줌
function refreshPreview(o) {
  o = o || {};
  if (pv.ch) { pv.scene.remove(pv.ch); pv.ch = null; }
  if (pv.gun) { pv.scene.remove(pv.gun); pv.gun = null; }
  const skin = o.skin || profile.skin, gskin = o.gskin || profile.gskin;
  if (o.gunShow) {
    const sc = 0.05, len = gunLength('rifle', sc), g = makeGun('rifle', sc, gskin);
    decorateGun(g, GUN_SKINS[gskin], len);
    g.position.set(0, -0.12, len * 0.18);
    const holder = new THREE.Group(); holder.add(g); holder.position.set(0, 1.0, 0); holder.rotation.z = 0.12;
    pv.gun = holder; pv.scene.add(holder);
    return;
  }
  pv.ch = makeChar(CFG.color, skin); setCharGun(pv.ch, 'rifle', gskin); pv.ch.userData.shadow.visible = false; pv.scene.add(pv.ch);
}
refreshPreview();

/* ---------- 프로필 / 꾸미기 상점 ---------- */
function updateProfileUI() {
  const li = levelInfo(profile.xp);
  $('lvBadge').textContent = $('lockerLv').textContent = 'Lv.' + li.lv;
  $('xpFill').style.width = (li.cur / li.need * 100) + '%'; $('xpText').textContent = `${li.cur} / ${li.need} XP`;
  $('coinNum').textContent = $('lockerCoins').textContent = profile.coins;
  $('goldNum').textContent = $('lockerGold').textContent = profile.gold;
  $('colors').style.opacity = profile.skin === 'default' ? 1 : 0.45;
  $('myTitle').innerHTML = titleHtml(myTitle());
}
updateProfileUI();
let lockerTab = 'skin';
$('lockerBtn').onclick = () => { A.initAudio(); $('locker').classList.remove('hidden'); $('lockerPrevSlot').appendChild($('preview')); renderLocker(); };
$('lockerClose').onclick = () => { $('locker').classList.add('hidden'); $('previewSlot').appendChild($('preview')); refreshPreview(); };
$('lockerTabs').querySelectorAll('button').forEach(b => b.onclick = () => { lockerTab = b.dataset.tab; renderLocker(); });
const skinThumbCache = {};
function skinThumb(id) {
  const k = id + CFG.color; if (skinThumbCache[k]) return skinThumbCache[k];
  const sm = skinMats(CFG.color, id), c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(sm.faceCanvas, 0, 0, 48, 48);
  return (skinThumbCache[k] = c.toDataURL());
}
function renderLocker() {
  updateProfileUI();
  $('lockerTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === lockerTab));
  if (lockerTab === 'spray' || lockerTab === 'emote') { refreshPreview(); renderExtras(lockerTab); return; }
  if (lockerTab === 'title') { refreshPreview(); renderTitles(); return; }
  if (lockerTab === 'gacha') { refreshPreview(); renderGacha(); $('lockerSel').textContent = `${CHAR_SKINS[profile.skin].name} · ${GUN_SKINS[profile.gskin].name}`; return; }
  renderSkinShop(lockerTab);
}
initSkinShop({ thumb: (id) => skinThumb(id), preview: (o) => refreshPreview(o), toast, changed: () => updateProfileUI() });
initExtrasShop({ previewEmote: (id) => { const em = EMOTE_BY[id]; if (em && pv.ch) pv.emote = { anim: em.anim, fx: em.fx, t0: performance.now(), until: performance.now() + 3000 }; }, toast });

// 칭호 탭
function renderTitles() {
  const cur = myTitle(), order = { common: 0, rare: 1, epic: 2, legend: 3 };
  const ids = Object.keys(TITLES).sort((a, b) => order[TITLES[a].r] - order[TITLES[b].r]);
  $('lockerGrid').innerHTML = '<div class="ttl-grid">' + ids.map(id => {
    const own = titleOwned(id), q = TITLES[id].req, buyable = !own && (q.coins || q.gold);
    const st = own ? (id === cur ? '장착 중' : '보유 · 눌러서 장착') : buyable ? (q.gold ? `<i class="goldc"></i> ${q.gold} 골드` : `<i class="coin"></i> ${q.coins}`) : titleHow(id);
    return `<div class="tcard ${id === cur ? 'eq' : ''} ${own ? '' : 'lock'} rr-${TITLES[id].r}" data-t="${id}">${titleHtml(id)}<div class="pr ${own ? 'own' : ''}">${st}</div></div>`;
  }).join('') + '</div>';
  $('lockerGrid').querySelectorAll('[data-t]').forEach(c => c.onclick = () => {
    const id = c.dataset.t;
    if (!titleOwned(id)) {
      const res = buyTitle(id);
      if (res !== 'ok') { A.sfxDeny(); toast({ coins: '코인이 부족해요', gold: '골드가 부족해요', locked: titleHow(id) + '하면 얻어요' }[res] || '얻을 수 없어요'); return; }
      A.sfxBuy();
    }
    equipTitle(id); updateProfileUI(); renderLocker();
  });
  $('lockerSel').innerHTML = titleHtml(cur);
}

function renderRoomList(list) {
  const box = $('roomList');
  if (!list.length) { box.innerHTML = '<div class="dim">방이 없어요. 새로 만들어 보세요!</div>'; return; }
  box.innerHTML = list.map(r => `<div class="roomitem" data-code="${r.code}"><span class="code">${r.code}</span><span>${esc(r.host || '')}의 방</span><span class="dim">${r.rmode && r.state !== 'play' ? '랜덤 모드' : SH.MODES[r.mode || 'ffa'].name} · ${(r.rmode || r.rmap) && r.state !== 'play' ? '랜덤 맵' : (SH.MAPS[r.map] || { name: '커스텀 맵' }).name} · ${r.n}명</span><span class="tag ${r.state === 'play' ? 'play' : ''}">${r.state === 'play' ? '게임 중' : '대기 중'}</span></div>`).join('');
  box.querySelectorAll('.roomitem').forEach(el => el.onclick = () => { A.initAudio(); send(Object.assign({ t: 'join', code: el.dataset.code }, joinInfo())); });
}
$('quickBtn').onclick = () => { A.initAudio(); send(Object.assign({ t: 'create', quick: true, cfg: { map: 'village', mode: 'ffa', rmode: true, rmap: true, bots: 7, time: 300, kills: 25, diff: 'normal' } }, joinInfo())); };
$('practiceBtn').onclick = () => { A.initAudio(); send(Object.assign({ t: 'create', quick: true, cfg: { map: 'range', mode: 'practice', bots: 4, time: 300, kills: 25, diff: 'easy' } }, joinInfo())); };
$('createBtn').onclick = () => { A.initAudio(); send(Object.assign({ t: 'create', cfg: { map: 'village', mode: 'ffa', bots: 5, time: 300, kills: 25, diff: 'normal' } }, joinInfo())); };
$('joinBtn').onclick = () => { A.initAudio(); const c = $('codeIn').value.trim(); if (c) send(Object.assign({ t: 'join', code: c }, joinInfo())); };
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').onclick(); });
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// 맵 썸네일
const thumbCache = {};
function mapThumb(id) {
  if (thumbCache[id]) return thumbCache[id];
  const m = SH.getMap(id), c = document.createElement('canvas'); c.width = m.W; c.height = m.D;
  const ctx = c.getContext('2d'), img = ctx.createImageData(m.W, m.D);
  for (let z = 0; z < m.D; z++) for (let x = 0; x < m.W; x++) {
    let y = m.H - 1; while (y > 0 && !m.get(x, y, z)) y--;
    const col = new THREE.Color(BLOCK_COLOR[m.get(x, y, z)] || 0x888888).multiplyScalar(0.55 + (y / m.H) * 1.1);
    const i = (z * m.W + x) * 4; img.data[i] = clamp(col.r * 255, 0, 255); img.data[i + 1] = clamp(col.g * 255, 0, 255); img.data[i + 2] = clamp(col.b * 255, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  thumbCache[id] = c;
  return c;
}
function buildMapCards() {
  const box = $('mapCards'); box.innerHTML = '';
  // 랜덤 맵 카드 (매 판 새로 뽑음)
  const rd = document.createElement('div'); rd.className = 'mapcard rnd'; rd.dataset.map = 'random';
  rd.innerHTML = '<div class="rndthumb">?</div>랜덤 맵<div class="mdesc">매 판 새로 뽑기</div>';
  rd.onclick = () => sendCfg({ rmap: true });
  box.appendChild(rd);
  for (const id of Object.keys(SH.MAPS)) {
    if (SH.MAPS[id].kind === 'practice') continue;
    const d = document.createElement('div'); d.className = 'mapcard'; d.dataset.map = id;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const cx2 = c.getContext('2d'); cx2.imageSmoothingEnabled = false; cx2.drawImage(mapThumb(id), 0, 0, 64, 64);
    d.appendChild(c); d.appendChild(document.createTextNode(SH.MAPS[id].name));
    if (SH.MAPS[id].desc) { const sm = document.createElement('div'); sm.className = 'mdesc'; sm.textContent = SH.MAPS[id].desc; d.appendChild(sm); }
    d.onclick = () => sendCfg({ map: id, rmap: false });
    box.appendChild(d);
  }
}
buildMapCards();
function sendCfg(p) { if (!S.room) return; send({ t: 'cfg', cfg: Object.assign({}, S.room.cfg, p) }); }
document.querySelectorAll('[data-bots]').forEach(b => b.onclick = () => sendCfg({ bots: clamp(S.room.cfg.bots + Number(b.dataset.bots), 0, 11) }));
$('timeSeg').querySelectorAll('button').forEach(b => b.onclick = () => sendCfg({ time: Number(b.dataset.v) }));
$('killSeg').querySelectorAll('button').forEach(b => b.onclick = () => sendCfg({ kills: Number(b.dataset.v) }));
$('modeSeg').querySelectorAll('button').forEach(b => b.onclick = () => sendCfg(b.dataset.v === 'random' ? { rmode: true } : { mode: b.dataset.v, rmode: false }));
$('diffSeg').querySelectorAll('button').forEach(b => b.onclick = () => sendCfg({ diff: b.dataset.v }));
$('teamBtn').onclick = () => send({ t: 'team' });
const MODE_DESC = {
  ffa: '모두가 적! 가장 먼저 목표 킬을 채운 사람이 승리.',
  tdm: '레드 vs 블루. 팀 킬 합계로 승부해요. 아군끼리는 피해가 없어요.',
  zombie: '처음엔 모두 인간. 20초 뒤 숙주 좀비가 생겨요! 좀비에게 죽으면 좀비가 됩니다. 인간은 시간 끝까지 버티면 승리, 좀비는 모두 감염시키면 승리.',
  gungame: '킬할 때마다 다음 총으로 바뀌어요 (권총 → … → 로켓 → 칼). 마지막 칼로 처치하면 승리! 칼에 맞으면 레벨 다운.',
  br: '칼 한 자루로 시작! 바닥의 총과 보급상자를 줍고, 줄어드는 자기장 안에서 최후의 1인이 되세요. 부활 없음.',
  boss: '모두 힘을 합쳐 거대 골렘을 쓰러뜨리세요! 내려찍기·바위 던지기·돌진, 체력 절반이면 분노해서 졸개를 불러요.',
  spike: '발로란트식! 공격팀은 A/B 사이트에 스파이크 설치, 수비팀은 막거나 해체. 라운드 중 부활 없음 · 5라운드 먼저 이기면 승리 (4라운드 후 공수 교대)',
  ctf: '상대 기지의 깃발을 들고 와서 우리 깃발에 닿으면 득점! 우리 깃발이 기지에 있어야 해요.',
};
$('startBtn').onclick = () => { A.initAudio(); send({ t: 'start' }); };
$('leaveBtn').onclick = () => send({ t: 'leave' });
$('lobbyChatIn').addEventListener('keydown', e => { if (e.key === 'Enter') { const t = e.target.value.trim(); if (t) send({ t: 'chat', text: t }); e.target.value = ''; } });
fetch('/info').then(r => r.json()).then(d => { S.lan = d.ips && d.ips[0] ? `${d.ips[0]}:${d.port}` : null; }).catch(() => {});

/* ---------- 봇 관리 (방장) ---------- */
const amHost = () => !!(S.room && S.room.host === S.myId);
function bindKicks(box) { box.querySelectorAll('[data-kick]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); send({ t: 'bot', op: 'kick', id: b.dataset.kick }); }); }
function renderBotBtns(box) {
  if (!amHost()) { box.innerHTML = ''; return; }
  const md = S.room.cfg.mode, full = S.room.players.length >= 12, nb = S.room.players.filter(p => p.bot).length;
  const add = md === 'ffa' ? `<button class="btn green" data-add="-1" ${full ? 'disabled' : ''}>+ 봇 추가</button>`
    : `<button class="btn red" data-add="0" ${full ? 'disabled' : ''}>+ 레드 봇</button><button class="btn blue" data-add="1" ${full ? 'disabled' : ''}>+ 블루 봇</button>`;
  box.innerHTML = add + `<button class="btn" data-clear="1" ${nb ? '' : 'disabled'}>봇 모두 빼기</button>`;
  box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => send({ t: 'bot', op: 'add', team: Number(b.dataset.add) }));
  box.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => send({ t: 'bot', op: 'clear' }));
}
function renderBotMgr() {
  const host = amHost();
  $('botMgr').classList.toggle('hidden', !host || !S.room);
  if (!host || !S.room) return;
  const bots = S.room.players.filter(p => p.bot);
  $('botMgrList').innerHTML = bots.length ? bots.map(p => `<div><span class="sw" style="width:12px;height:12px;border:2px solid #000;background:${p.team >= 0 ? TEAMS[p.team].css : hexs(PCOLORS[p.color])}"></span>${esc(p.name)} <span class="dim">${p.k}킬</span><button class="kick" data-kick="${p.id}">빼기</button></div>`).join('') : '<span class="dim">봇이 없어요</span>';
  bindKicks($('botMgrList'));
  renderBotBtns($('botMgrBtns'));
}

function onRoom(m) {
  const wasIn = !!S.room;
  S.room = m;
  S.roster.clear();
  for (const p of m.players) S.roster.set(p.id, p);
  for (const [id, e] of S.ents) { const r = S.roster.get(id); if (r && (r.color !== e.color || r.name !== e.name || r.team !== e.team || r.skin !== e.skin || r.gskin !== e.gskin)) { removeEnt(id); } }
  if (m.state !== 'play' || !S.inGame) S.mode = m.cfg.mode;
  const md = m.cfg.mode, rmode = !!m.cfg.rmode, rmap = rmode || !!m.cfg.rmap;
  $('modeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', rmode ? b.dataset.v === 'random' : b.dataset.v === md));
  $('diffSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === m.cfg.diff));
  $('modeDesc').textContent = rmode ? `게임을 시작할 때마다 모드와 맵을 무작위로 골라요${m.state !== 'wait' || S.inGame ? '' : ` · 지난 판: ${SH.MODES[md].name}`}` : MODE_DESC[md];
  $('killLbl').textContent = md === 'ctf' ? '목표 득점' : md === 'tdm' ? '팀 목표 킬' : '목표 킬';
  $('teamBtn').classList.toggle('hidden', rmode || !['tdm', 'ctf', 'spike'].includes(md) || m.state === 'play');
  // 지금 모드에 맞는 맵만 보여줌 (랜덤 모드면 랜덤 맵만)
  let shown = 0;
  document.querySelectorAll('.mapcard').forEach(c => {
    const id = c.dataset.map, k = id === 'custom' || id === 'random' ? 'normal' : SH.MAPS[id].kind || 'normal';
    const hide = rmode ? id !== 'random' : id !== 'random' && (md === 'spike' ? k !== 'spike' : k !== 'normal');
    c.classList.toggle('hidden', hide); if (!hide && id !== 'random') shown++;
  });
  $('mapCount').textContent = rmode ? '(랜덤 모드에서는 맵도 무작위)' : `(${shown}개)`;
  refreshCustomCards(m);
  if (S.afterRoom && m.host === S.myId && m.state === 'wait') { const f = S.afterRoom; S.afterRoom = null; f(m); }
  $('cfgTime').classList.toggle('hidden', md === 'spike' || md === 'br'); $('cfgKill').classList.toggle('hidden', ['spike', 'zombie', 'br', 'boss', 'gungame'].includes(md));
  // 로비 UI
  $('roomCode').textContent = m.code;
  $('lanInfo').textContent = S.lan ? `친구 접속: ${S.lan}` : '';
  const host = m.host === S.myId;
  $('hostNote').textContent = host ? '(방장)' : '방장만 바꿀 수 있어요';
  $('lobby').querySelector('.grow').classList.toggle('locked', !host);
  $('startBtn').disabled = !host; $('startBtn').textContent = host ? '게임 시작' : '방장을 기다리는 중…';
  $('botsVal').textContent = m.cfg.bots;
  document.querySelectorAll('.mapcard').forEach(c => c.classList.toggle('on', rmap ? c.dataset.map === 'random' : c.dataset.map === m.cfg.map));
  $('timeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === m.cfg.time));
  $('killSeg').querySelectorAll('button').forEach(b => { const v = Number(b.dataset.v); b.textContent = SH.targetOf({ mode: md, kills: v }); b.classList.toggle('on', v === m.cfg.kills); });
  const pl = (p) => `<div class="pitem ${p.team >= 0 ? 't' + p.team : ''}"><span class="sw" style="background:${hexs(PCOLORS[p.color])}"></span>${p.id === m.host ? '<span class="crown">★</span>' : ''}<span class="lv">Lv.${p.lv || 1}</span>${esc(p.name)} ${titleHtml(p.title)}${p.id === S.myId ? ' <span class="dim">(나)</span>' : ''}<span class="tag">${p.bot ? '봇' : ''}</span>${p.bot && host ? `<button class="kick" data-kick="${p.id}">빼기</button>` : ''}</div>`;
  $('lobbyPlayers').innerHTML = md === 'ffa' ? m.players.map(pl).join('')
    : [0, 1].map(t => `<div class="teamhead" style="color:${TEAMS[t].css}">${TEAMS[t].name} 팀</div>` + m.players.filter(p => p.team === t).map(pl).join('')).join('');
  $('endBtn').classList.toggle('hidden', !host);
  bindKicks($('lobbyPlayers'));
  renderBotBtns($('lobbyBotBtns'));
  if (S.modal === 'pause') renderBotMgr();
  if (m.state === 'wait') {
    if (S.inGame) leaveGame();
    showScreen('lobby');
    if (!wasIn) $('lobbyChat').innerHTML = '';
  }
  if (S.modal === 'score') renderScore();
}

/* ================= 게임 시작/종료 ================= */
function startGame(m) {
  S.off = m.now - Date.now();
  S.endAt = m.endAt; S.target = m.target; S.mode = m.mode; S.score = m.score || [0, 0]; S.myCaps = 0;
  // 맵은 방마다 복제 (블록 파괴)
  if (S.world) { scene.remove(S.world); disposeWorld(S.world); }
  if (S.sky && S.mapId !== m.map) { scene.remove(S.sky); S.sky = null; }
  if (ED.on) exitEditor(false);
  const customMap = m.custom ? SH.mapFromData(m.custom) : null;
  if (customMap && S.sky) { scene.remove(S.sky); S.sky = null; }
  S.map = customMap || SH.getMap(m.map).clone(); S.mapId = customMap ? 'custom' : m.map;
  S.mapName = customMap ? m.custom.name || '커스텀 맵' : (SH.MAPS[m.map] || {}).name;
  for (const sp of S.sprays.values()) scene.remove(sp); S.sprays.clear(); S.selfEmote = null; toggleEmoteWheel(false);
  for (const [x, y, z] of m.broken || []) S.map.set(x, y, z, 0);
  S.world = buildWorld(S.map, atlas.tex); scene.add(S.world);
  const def = customMap ? SH.MAPS[customMap.theme] || SH.MAPS.village : SH.MAPS[m.map];
  if (!S.sky) { S.sky = buildSky(def); scene.add(S.sky); }
  S.world.visible = true; S.sky.visible = true;
  scene.fog = new THREE.Fog(def.fog, def.fogNear || 45, def.fogFar || 140);
  startGimmicks(def, S.map, m.gim);
  setupFlags();
  setupShops();
  for (const id of [...S.turrets.keys()]) removeTurret(id);
  S.uavUntil = 0; S.strikesFx = [];
  for (const id of [...S.crates.keys()]) removeCrate(id);
  S.spk = null; S.specId = null; S.plantOn = false; S.defOn = false;
  setupZone(); S.zone = null; S.zbs = null;
  setupPractice(); setupSpike(); setupPickups(m.pk || []);
  S.kc = null; S.selfBuf = []; S.shotLog = [];
  $('killcam').classList.add('hidden');
  if (S.ghost) scene.remove(S.ghost);
  S.ghost = makeChar(CFG.color, profile.skin, isTeamMode() && myTeam() >= 0 ? TEAMS[myTeam()].color : null); S.ghost.visible = false; scene.add(S.ghost);
  $('teamBar').classList.toggle('hidden', !isTeamMode() || S.mode === 'spike'); $('timer').classList.toggle('hidden', isTeamMode() || S.mode === 'practice');
  $('spikeBar').classList.toggle('hidden', S.mode !== 'spike'); if (['zombie', 'boss'].includes(S.mode)) { $('teamBar').classList.add('hidden'); $('timer').classList.remove('hidden'); } if (S.mode === 'br') $('timer').classList.add('hidden'); $('practiceHud').classList.toggle('hidden', S.mode !== 'practice'); $('leader').classList.toggle('hidden', S.mode === 'spike' || S.mode === 'practice');
  $('plantBar').classList.add('hidden'); $('spikeHint').textContent = ''; $('flagStat').classList.toggle('hidden', S.mode !== 'ctf');
  for (const id of [...S.ents.keys()]) removeEnt(id);
  for (const id of [...S.projs.keys()]) removeProj(id);
  for (const id of [...S.drops.keys()]) removeDrop(id);
  for (const d of m.drops || []) addDrop(d);
  clearFx();
  S.inGame = true; S.dead = true; me.alive = false; S.streak = 0;
  me.x = S.map.W / 2; me.y = 22; me.z = S.map.D / 2;
  for (const k in ammo) delete ammo[k];
  fullAmmo('pistol');
  WS.cur = 'pistol';
  $('killfeed').innerHTML = ''; $('center').innerHTML = '';
  $('result').classList.add('hidden');
  showScreen('game');
  $('death').classList.add('hidden');
  if (!S.locked) $('clickToPlay').classList.remove('hidden');
  setViewModel('pistol');
}
function leaveGame() {
  S.inGame = false; me.alive = false;
  if (document.pointerLockElement) document.exitPointerLock();
  closeModals(); clearKillBanner(); stopGimmicks();
  $('result').classList.add('hidden');
}
function onEnd(m) {
  closeModals();
  if (document.pointerLockElement) document.exitPointerLock();
  const r = m.rank;
  if (S.kc) endKc();
  const myIdx = r.findIndex(p => p.id === S.myId), mine = r[myIdx];
  const win = m.win == null ? myIdx === 0 : m.win === (mine ? mine.team : -2);
  $('resultTeam').innerHTML = m.win == null ? '' : m.win < 0 ? '무승부!' : `<span style="color:${TEAMS[m.win].css}">${teamName(m.win)}${S.mode === 'zombie' || S.mode === 'boss' ? '' : ' 팀'} 승리!</span> <span class="dim">${m.score[0]} : ${m.score[1]}</span>`;
  if (mine) trackEnd(m.mode, win);
  if (mine) {
    const g = grantMatch({ kills: mine.k, caps: mine.caps || 0, win, rank: m.win == null ? myIdx : -1 });
    $('rewards').innerHTML = `<span>+${g.xp} XP</span><span><i class="coin"></i> +${g.coins} 코인</span>` + (g.after > g.before ? `<span class="up">레벨 업! Lv.${g.after}</span>` : '');
    updateProfileUI();
  } else $('rewards').innerHTML = '';
  const pc = (p) => p.team >= 0 && m.win != null ? TEAMS[p.team].css : hexs(PCOLORS[p.color]);
  const pod = [r[1], r[0], r[2]].map((p, i) => p ? `<div class="pod p${[2, 1, 3][i]}"><div class="nm" style="color:${pc(p)}">${esc(p.name)}</div><div class="kd">${p.k}킬 / ${p.d}데스</div><div class="blk">${[2, 1, 3][i]}</div></div>` : '').join('');
  $('podium').innerHTML = pod;
  const ctf = m.mode === 'ctf';
  $('resultTable').innerHTML = `<tr><th>#</th><th>이름</th>${ctf ? '<th class="num">득점</th>' : ''}<th class="num">킬</th><th class="num">데스</th></tr>` + r.map((p, i) => `<tr class="${p.id === S.myId ? 'me' : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${pc(p)}"></span>${esc(p.name)} ${titleHtml(p.title)}${p.bot ? ' <span class="dim">봇</span>' : ''}</td>${ctf ? `<td class="num">${p.caps || 0}</td>` : ''}<td class="num">${p.k}</td><td class="num">${p.d}</td></tr>`).join('');
  $('result').classList.remove('hidden');
  $('clickToPlay').classList.add('hidden');
  const myRank = r.findIndex(p => p.id === S.myId);
  if (myRank === 0 || win) A.sfxStreak();
}

/* ================= 입력 ================= */
cv.addEventListener('click', () => { if (S.kc && S.kc.active) endKc(); if (S.inGame && !S.modal && !S.locked) lockPointer(); });
$('clickToPlay').addEventListener('click', () => { A.initAudio(); lockPointer(); });
function lockPointer() { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); }
document.addEventListener('pointerlockchange', () => {
  S.locked = document.pointerLockElement === cv;
  if (S.locked) { $('clickToPlay').classList.add('hidden'); if (S.modal === 'pause') closeModals(); }
  else if (S.inGame && !S.modal && $('result').classList.contains('hidden') && document.activeElement !== $('chatIn')) openPause();
  for (const k in keys) keys[k] = false;
  WS.trigger = false; WS.adsHeld = false;
});
document.addEventListener('mousemove', (e) => {
  if (!S.locked || !me.alive) return;
  const zoom = lerp(1, (WEAPONS[WS.cur] && WEAPONS[WS.cur].zoom) || 1, WS.ads);
  const k = 0.0022 * CFG.sens / zoom;
  me.yaw -= e.movementX * k; me.pitch = clamp(me.pitch - e.movementY * k, -1.55, 1.55);
  WS.swayX = (WS.swayX || 0) + e.movementX * 0.0004; WS.swayY = (WS.swayY || 0) + e.movementY * 0.0004;
});
document.addEventListener('mousedown', (e) => {
  if (!S.locked) return;
  if (e.button === 0) { WS.trigger = true; WS.semiReady = true; }
  if (e.button === 2) WS.adsHeld = true;
});
document.addEventListener('mouseup', (e) => { if (e.button === 0) WS.trigger = false; if (e.button === 2) WS.adsHeld = false; });
document.addEventListener('contextmenu', e => { if (S.inGame) e.preventDefault(); });
document.addEventListener('wheel', (e) => { if (!S.locked || !me.alive || ED.on || !S.inGame) return; cycleWeapon(e.deltaY > 0 ? 1 : -1); });

document.addEventListener('keydown', (e) => {
  if (document.activeElement === $('chatIn')) {
    if (e.key === 'Enter') { const t = $('chatIn').value.trim(); if (t) send({ t: 'chat', text: t }); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (ED.on) { editorKey(e); return; }
  if (settingsOpen()) { if (e.code === 'Escape') closeSettingsPanel(); return; }
  if (!S.inGame) return;
  // 사용자가 바꾼 키 → 게임 기본 키 코드
  const code = toGame(e.code);
  if (code === 'Tab') { e.preventDefault(); if (!S.modal) openModal('score'); return; }
  if (code === 'KeyB') { toggleBuy(); return; }
  if (code === 'Enter') { openChat(); e.preventDefault(); return; }
  if (S.modal === 'buy' && e.code === 'Escape') { closeModals(); return; }
  if (S.modal) return;
  if (code === 'Space' && S.kc && S.kc.active) { endKc(); e.preventDefault(); return; }
  if (code === 'Space' && !me.alive && (S.mode === 'spike' || S.mode === 'br')) { nextSpectate(); e.preventDefault(); return; }
  if (S.emoteOpen && /^Digit[1-8]$/.test(e.code)) { doEmote(+e.code.slice(5) - 1); e.preventDefault(); return; }
  if (['Space', 'KeyC', 'Tab'].includes(e.code)) e.preventDefault();
  if (!code) return;
  if (!keys[code]) onPress(code);
  keys[code] = true;
});
document.addEventListener('keyup', (e) => {
  const code = toGame(e.code);
  if (code) keys[code] = false;
  if (code === 'Tab' && S.modal === 'score') closeModals();
});
function onPress(code) {
  if (!me.alive) return;
  switch (code) {
    case 'Space': if (!spikeFrozen()) jump(); break;
    case 'KeyR': startReload(); break;
    case 'Digit1': if (me.primary) switchTo(me.primary); break;
    case 'Digit2': switchTo(me.secondary); break;
    case 'Digit3': case 'KeyV': switchTo(meleeId()); break;
    case 'Digit4': if (me.nades > 0) switchTo('nade'); break;
    case 'KeyQ': if (WS.last && haveWeapon(WS.last)) switchTo(WS.last); break;
    case 'KeyG': quickNade(); break;
    case 'KeyE': { const cr = nearCrate(); if (cr) send({ t: 'open', id: cr.id }); else tryPick(true); break; }
    case 'KeyP': if (S.mode === 'practice') { resetPracticeStats(); toast('연습 기록을 초기화했어요'); } break;
    case 'KeyY': toggleEmoteWheel(); break;
    case 'KeyT': doSpray(); break;
    case 'KeyC': if (me.ground && !me.sliding && isSprinting() ) startSlide(); break;
    case 'KeyK': send({ t: 'suicide' }); break;
    case 'KeyZ': deployTurret(); break;
    case 'KeyX': callAirstrike(); break;
  }
}
function openChat() { const i = $('chatIn'); i.classList.remove('hidden'); i.value = ''; i.focus(); for (const k in keys) keys[k] = false; }
function closeChat() { const i = $('chatIn'); i.blur(); i.classList.add('hidden'); if (S.inGame && !S.locked && !S.modal) lockPointer(); }
function addChat(html) {
  for (const box of [$('chatLog'), $('lobbyChat')]) {
    const d = document.createElement('div'); d.innerHTML = html; box.appendChild(d);
    while (box.children.length > (box.id === 'chatLog' ? 7 : 50)) box.firstChild.remove();
    if (box.id === 'chatLog') setTimeout(() => d.remove(), 12000); else box.scrollTop = box.scrollHeight;
  }
}

/* ================= 모달 ================= */
function openModal(id) {
  closeModals(true);
  S.modal = id; $(id).classList.remove('hidden');
  if (id === 'score') renderScore();
  if (id === 'buy') { renderBuy(); if (document.pointerLockElement) document.exitPointerLock(); }
  if (id === 'pause') renderBotMgr();
  if (id === 'pause') { $('sens').value = CFG.sens; $('fov').value = CFG.fov; $('vol').value = CFG.vol; $('kcToggle').checked = CFG.killcam !== false; updSettingsLbl(); }
}
function closeModals(keep) {
  for (const id of ['buy', 'score', 'pause']) $(id).classList.add('hidden');
  const was = S.modal; S.modal = null;
  if (!keep && (was === 'buy') && S.inGame) lockPointer();
}
function openPause() { openModal('pause'); }
$('resumeBtn').onclick = () => { closeModals(); lockPointer(); };
$('quitBtn').onclick = () => { send({ t: 'leave' }); };
$('endBtn').onclick = () => { send({ t: 'stop' }); };
function updSettingsLbl() { $('sensVal').textContent = Number(CFG.sens).toFixed(2); $('fovVal').textContent = CFG.fov; $('volVal').textContent = Math.round(CFG.vol * 100) + '%'; }
$('sens').oninput = (e) => { CFG.sens = Number(e.target.value); saveCfg(); updSettingsLbl(); };
$('fov').oninput = (e) => { CFG.fov = Number(e.target.value); saveCfg(); updSettingsLbl(); };
$('vol').oninput = (e) => { CFG.vol = Number(e.target.value); A.setVolume(CFG.vol); saveCfg(); updSettingsLbl(); };
$('buyClose').onclick = () => closeModals();
$('kcToggle').onchange = (e) => { CFG.killcam = e.target.checked; saveCfg(); };

initGimmicks({ scene, camera, me, world: () => S.world, spawn: (...a) => spawnParticle(...a), showBig: (...a) => showBig(...a) });

/* ---------- 설정 창 (조준선 · 조작키) ---------- */
let crossCfg = getCross();
initSettings({ cfg: CFG, save: saveCfg, setVolume: A.setVolume }, toast);
function closeSettingsPanel() { closeSettings(); crossCfg = getCross(); if (S.modal === 'pause') openModal('pause'); }
$('setClose').onclick = closeSettingsPanel;
$('settingsBtn').onclick = () => { A.initAudio(); openSettings(); };
$('pauseSetBtn').onclick = () => openSettings();

function renderScore() {
  const ctf = S.mode === 'ctf';
  const list = [...S.roster.values()].sort((a, b) => (ctf ? (b.caps || 0) - (a.caps || 0) : 0) || b.k - a.k || a.d - b.d);
  $('scoreMap').textContent = S.mapId ? `${SH.MODES[S.mode].name} · ${S.mapName || ''} · 목표 ${S.target}${ctf ? '점' : '킬'}` : '';
  const head = `<tr><th>#</th><th>이름</th>${ctf ? '<th class="num">득점</th>' : ''}<th class="num">킬</th><th class="num">데스</th><th class="num">K/D</th></tr>`;
  const row = (p, i) => `<tr class="${p.id === S.myId ? 'me' : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${hexs(PCOLORS[p.color])}"></span><span class="lv" style="color:#f4c22b;font-size:11px">Lv${p.lv || 1}</span> ${esc(p.name)} ${titleHtml(p.title)}${p.bot ? ' <span class="dim">봇</span>' : ''}</td>${ctf ? `<td class="num">${p.caps || 0}</td>` : ''}<td class="num">${p.k}</td><td class="num">${p.d}</td><td class="num">${(p.k / Math.max(1, p.d)).toFixed(2)}</td></tr>`;
  if (!isTeamMode()) { $('scoreTable').innerHTML = `<table>${head}${list.map(row).join('')}</table>`; return; }
  $('scoreTable').innerHTML = [0, 1].map(t => `<h4 style="color:${TEAMS[t].css}">${teamName(t)}${S.mode === 'zombie' || S.mode === 'boss' ? '' : ' 팀 — ' + S.score[t] + '점'}</h4><table>${head}${list.filter(p => p.team === t).map(row).join('')}</table>`).join('');
}

/* ================= 상점 ================= */
const SHOP = [
  ['권총', ['pistol', 'magnum', 'uzi']], ['SMG · 샷건', ['smg', 'shotgun', 'dbarrel']], ['소총', ['burst', 'rifle', 'carbine', 'dmr']], ['저격', ['scout', 'sniper']],
  ['중화기', ['lmg', 'rail', 'rocket', 'minigun']], ['장비', ['armor', 'helmet', 'nade']], ['보급', ['medkit', 'ammo']],
  ['퍽 <small>죽어도 매치 끝까지 유지</small>', ['perk_speed', 'perk_hp', 'perk_reload']], ['지원 <small>Z: 포탑 설치 · X: 공습 지점</small>', ['uav', 'turret', 'air']],
];
function nearShop() { return !!(S.map && S.map.shops && S.map.shops.some(p => Math.hypot(p[0] - me.x, p[2] - me.z) < ECON.SHOP_DIST - 0.3 && Math.abs(p[1] - me.y) < 2.5)); }
// 죽어 있을 때도 다음 부활용으로 구매 가능 (라운드제·특수 모드 제외)
function deadBuyOk() { return !me.alive && S.inGame && !['spike', 'gungame', 'br', 'zombie'].includes(S.mode); }
function canBuyNow() { return deadBuyOk() || (me.alive && (S.mode === 'practice' || serverNow() < me.buyUntil || nearShop())); }
function ownedOf(id) {
  const W = WEAPONS[id], I = ITEMS[id];
  if (W) return me.primary === id || me.secondary === id;
  if (id === 'armor') return me.armor >= 100;
  if (id === 'helmet') return me.helmet;
  if (id === 'nade') return me.nades >= I.max;
  if (id === 'medkit') return me.hp >= me.maxHp;
  if (I.perk) return me.perks.includes(id);
  if (id === 'turret' || id === 'air') return (me.sup[id] || 0) >= I.max;
  return false;
}
// 픽셀 아이콘 (문자 그림)
const PIX = {
  medkit: [['..XXXXXXXX..', '.XWWWWWWWWX.', 'XWWWWRRWWWWX', 'XWWWWRRWWWWX', 'XWWRRRRRRWWX', 'XWWRRRRRRWWX', 'XWWWWRRWWWWX', 'XWWWWRRWWWWX', '.XWWWWWWWWX.', '..XXXXXXXX..'], { X: '#0b0c0e', W: '#f0f0f0', R: '#e2483a' }],
  ammo: [['.Y.Y.Y.Y.', '.Y.Y.Y.Y.', '.B.B.B.B.', 'XXXXXXXXX', 'XGGGGGGGX', 'XGLLLLLGX', 'XGGGGGGGX', 'XXXXXXXXX'], { X: '#0b0c0e', Y: '#f4c22b', B: '#b3820f', G: '#56663a', L: '#8a9a5a' }],
  helmet: [['...XXXXXX...', '..XGGGGGGX..', '.XGLGGGGGGX.', 'XGLGGGGGGGGX', 'XGGGGGGGGGGX', 'XXXXXXXXXXXX', 'XDDDDDDDDDDX', '.XXXXXXXXXX.'], { X: '#0b0c0e', G: '#4b5a2e', L: '#7a8a4a', D: '#3f4a26' }],
  perk_speed: [['.....XXX..', '..WW.XYYX.', '.WWWXYYYX.', 'WWW.XYYYX.', '....XYYYXX', '...XYYYYYX', '..XYYYYYYX', '..XXXXXXXX'], { X: '#0b0c0e', Y: '#f4c22b', W: '#bfe0ff' }],
  perk_hp: [['.XX...XX.', 'XRRX.XRRX', 'XRRRXRRRX', 'XRRRWRRRX', 'XRRWWWRRX', '.XRRWRRX.', '..XRRRX..', '...XRX...', '....X....'], { X: '#0b0c0e', R: '#e2483a', W: '#ffffff' }],
  perk_reload: [['..XXXX..', '.XYYYYX.', '.XYBBYX.', '.XYYYYX.', '.XYBBYX.', '.XYYYYX.', 'XXXXXXXX', 'X.WW..WX', 'XWW..WWX'], { X: '#0b0c0e', Y: '#e3b341', B: '#8a5a10', W: '#6ab0ff' }],
  uav: [['....XXX....', '..XXGGGXX..', '.XGG...GGX.', 'XG..XXX..GX', 'XG.XGGGX.GX', '...XGRGX...', '....XGX....', '....XGX....', '..XXXXXXX..'], { X: '#0b0c0e', G: '#5fe37a', R: '#e2483a' }],
};
const pixCache = {};
function pixIcon(id, px) {
  const k = id + px; if (pixCache[k]) return pixCache[k];
  const [rows, col] = PIX[id], c = document.createElement('canvas'); c.width = rows[0].length * px; c.height = rows.length * px;
  const x = c.getContext('2d');
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(xx * px, yy * px, px, px); } }));
  return (pixCache[k] = c.toDataURL());
}
function itemIcon(id, px) {
  if (id === 'armor') return armorIcon();
  if (PIX[id]) return pixIcon(id, px || 4);
  return gunIcon(id, id === 'nade' ? 5 : (px || 3) > 2 ? 3 : px, id === 'turret' || id === 'air' || id === 'nade' ? null : profile.gskin);
}
function toggleBuy() {
  if (S.modal === 'buy') { closeModals(); return; }
  if (S.modal) return;
  if (!me.alive && !deadBuyOk()) { toast('이 모드에선 죽은 동안 살 수 없어요'); return; }
  if (!canBuyNow()) { toast('구매 시간이 지났어요 (부활 후 8초 동안만 살 수 있어요)'); A.sfxDeny(); return; }
  openModal('buy');
}
function statBar(lbl, v) { return `<div class="sbar"><span>${lbl}</span><i><b style="width:${Math.round(clamp(v, 0.04, 1) * 100)}%"></b></i></div>`; }
function renderBuy() {
  $('buyMoney').textContent = '$' + me.money;
  let h = '';
  for (const [cat, items] of SHOP) {
    h += `<div class="bcat">${cat}</div>`;
    for (const id of items) {
      const W = WEAPONS[id], I = ITEMS[id], price = W ? W.price : I.price;
      const owned = ownedOf(id);
      const poor = me.money < price && !owned && S.mode !== 'practice';
      let stats = '';
      if (W) {
        const dps = W.dmg * (W.pellets || 1);
        stats = statBar('피해', dps / 130) + statBar('연사', W.rpm / 1400) + statBar('정확', 1 - (W.spread || 0) / 0.12) + statBar('기동', ((W.speed || 1) - 0.65) / 0.45);
      } else stats = `<div class="desc">${I.desc}</div>`;
      const icon = itemIcon(id, 4);
      h += `<div class="bcard ${owned ? 'owned' : ''} ${poor ? 'poor' : ''}" data-item="${id}">${owned ? `<span class="owned-tag">${id === 'medkit' ? '체력 가득' : '보유'}</span>` : ''}<span class="pr">${S.mode === 'practice' ? '무료' : price ? '$' + price : '기본'}</span><div class="img"><img src="${icon}"></div><div class="nm">${W ? W.name : I.name}</div>${stats}</div>`;
    }
  }
  $('buyGrid').innerHTML = h;
  $('buyGrid').querySelectorAll('.bcard').forEach(c => c.onclick = () => { if (!canBuyNow()) { toast('구매 시간이 끝났어요'); closeModals(); return; } send({ t: 'buy', item: c.dataset.item }); S.lastBuy = S.lastBuy || []; });
}
let _armorIcon = null;
function armorIcon() {
  if (_armorIcon) return _armorIcon;
  const c = document.createElement('canvas'); c.width = c.height = 40; const x = c.getContext('2d');
  const rows = ['..XXXX..XXXX..', '.XBBBBXXBBBBX.', '.XBBBBBBBBBBX.', '..XBBBBBBBBX..', '..XBLLBBLLBX..', '..XBBBBBBBBX..', '..XBBBBBBBBX..', '..XBDDDDDDBX..', '...XXXXXXXX...'];
  const col = { X: '#0b0c0e', B: '#3d6b9e', L: '#8ac6ff', D: '#2a4a70' };
  rows.forEach((r, y) => [...r].forEach((ch, i) => { if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(i * 3 - 1, y * 3 + 6, 3, 3); } }));
  return (_armorIcon = c.toDataURL());
}
function onBuyRes(m) {
  if (m.res === 'ok') {
    A.sfxBuy();
    S.lastBuy = [...new Set([...(S.lastBuy || []).filter(x => !(WEAPONS[x] && WEAPONS[m.item] && WEAPONS[x].slot === WEAPONS[m.item].slot)), m.item])];
    const W = WEAPONS[m.item];
    if (W) { fullAmmo(m.item); if (me.alive) setTimeout(() => switchTo(m.item, true), 0); else toast(`부활하면 ${W.name}을(를) 들고 나와요`); }
    else if (m.item === 'ammo') { for (const k in ammo) { const W2 = WEAPONS[k]; if (W2 && W2.res) ammo[k].res = W2.res; } }
    else if (m.item === 'medkit') A.sfxHeal();
    else if (m.item === 'turret') toast('Z 키로 자동 포탑을 설치하세요');
    else if (m.item === 'air') toast('X 키로 조준한 곳에 공습을 요청하세요');
  } else {
    A.sfxDeny();
    toast({ money: '돈이 부족해요', time: '구매 시간이 지났어요', have: '이미 가지고 있어요', dead: '죽은 상태예요' }[m.res] || '살 수 없어요');
  }
}
$('rebuyBtn').onclick = () => { for (const it of S.lastBuy || []) send({ t: 'buy', item: it }); };

/* ================= 엔티티(다른 플레이어) ================= */
function getEnt(id) {
  let e = S.ents.get(id);
  if (e) return e;
  const r = S.roster.get(id); if (!r) return null;
  const team = isTeamMode() ? r.team : -1, mate = isMate(id);
  const model = r.boss ? makeBossModel() : makeChar(r.color, r.skin, team >= 0 && S.mode !== 'zombie' && S.mode !== 'boss' ? TEAMS[team].color : null);
  scene.add(model);
  const ts = textSprite(`Lv${r.lv || 1} ${r.name}`, team >= 0 ? TEAMS[team].css : '#ffdf6a');
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: ts.tex, depthTest: !mate, transparent: true }));
  tag.scale.set(ts.w / 48, ts.h / 48, 1); tag.position.y = 2.15; tag.renderOrder = mate ? 5 : 0; model.add(tag);
  const uavMk = new THREE.Sprite(new THREE.SpriteMaterial({ map: UAV_TEX, depthTest: false, transparent: true }));
  uavMk.scale.set(0.5, 0.5, 1); uavMk.position.y = 2.6; uavMk.renderOrder = 9; uavMk.visible = false; model.add(uavMk);
  model.userData.uavMk = uavMk;
  if (r.boss) { tag.position.y = 6.2; tag.scale.multiplyScalar(1.6); }
  e = { boss: !!r.boss, id, name: r.name, color: r.color, bot: r.bot, team: r.team, skin: r.skin, gskin: r.gskin, model, tag, buf: [], alive: false, rx: 0, ry: 0, rz: 0, ryaw: 0, rpitch: 0, fl: 0, w: '', deadT: 0, lastPos: null };
  S.ents.set(id, e);
  return e;
}
function removeEnt(id) { const e = S.ents.get(id); if (!e) return; scene.remove(e.model); S.ents.delete(id); }

function onSnap(m) {
  const sample = m.now - Date.now();
  S.off = S.off == null ? sample : S.off + (sample - S.off) * 0.05;
  if (!S.inGame) return;
  for (const p of m.p) {
    const [id, x, y, z, yaw, pitch, fl, w, hp] = p;
    if (id === S.myId) { me.srvFl = fl; continue; }
    const e = getEnt(id); if (!e) continue;
    e.buf.push({ t: m.now, x, y, z, yaw, pitch, fl, w, hp });
    if (e.buf.length > 140) e.buf.shift();
  }
  if (m.f) S.flags = m.f;
  if (m.tu) syncTurrets(m.tu);
  if (m.sp) S.spk = m.sp;
  if (m.z) S.zone = m.z;
  if (m.zb) S.zbs = m.zb;
  syncCrates(m.cr || []);
  // 투사체
  const seen = new Set();
  for (const j of m.j) {
    const [id, kind, x, y, z] = j; seen.add(id);
    let pr = S.projs.get(id);
    if (!pr) pr = addProj(id, kind, x, y, z, 0, 0, 0, null);
    pr.buf.push({ t: m.now, x, y, z }); if (pr.buf.length > 10) pr.buf.shift();
  }
  for (const [id, pr] of S.projs) if (!seen.has(id) && performance.now() - pr.born > 400) removeProj(id);
}
function sampleBuf(buf, rt) {
  if (!buf.length) return null;
  if (rt <= buf[0].t) return buf[0];
  for (let i = buf.length - 1; i >= 0; i--) {
    if (buf[i].t <= rt) {
      const a = buf[i], c = buf[i + 1];
      if (!c || !(a.fl & 1) || !(c.fl & 1)) return a;
      const k = (rt - a.t) / Math.max(1, c.t - a.t);
      return { x: lerp(a.x, c.x, k), y: lerp(a.y, c.y, k), z: lerp(a.z, c.z, k), yaw: angLerp(a.yaw, c.yaw, k), pitch: lerp(a.pitch, c.pitch, k), fl: a.fl, w: a.w, hp: a.hp };
    }
  }
  return buf[buf.length - 1];
}
function updateEnts(dt) {
  const kcOn = S.kc && S.kc.active;
  const rt = kcOn ? kcTime() : serverNow() - 110;
  // 킬캠: 내 유령 모델
  if (S.ghost) {
    S.ghost.visible = false;
    if (kcOn) {
      const g = sampleBuf(S.selfBuf, rt);
      if (g) {
        S.ghost.visible = true; S.ghost.position.set(g.x, g.y, g.z); S.ghost.rotation.y = g.yaw;
        if (g.w) setCharGun(S.ghost, g.w, profile.gskin);
        animChar(S.ghost, dt, (g.fl & 1) ? 3 : 0, g.pitch, !!(g.fl & 2), false, !(g.fl & 1));
      }
    }
  }
  for (const e of S.ents.values()) {
    const s = sampleBuf(e.buf, rt);
    if (!s) { e.model.visible = false; continue; }
    const alive = !!(s.fl & 1);
    if (alive) {
      if (!e.alive) { e.model.visible = true; e.deadT = 0; e.lastPos = null; if (!e.boss) animChar(e.model, 0, 0, 0, false, false, false); }
      e.alive = true;
      const sp = e.lastPos ? Math.hypot(s.x - e.lastPos.x, s.z - e.lastPos.z) / Math.max(dt, 0.001) : 0;
      e.lastPos = { x: s.x, z: s.z };
      e.rx = s.x; e.ry = s.y; e.rz = s.z; e.ryaw = s.yaw; e.rpitch = s.pitch; e.fl = s.fl;
      e.model.position.set(s.x, s.y, s.z); e.model.rotation.y = s.yaw;
      if (!e.boss && s.w && s.w !== e.w) { e.w = s.w; setCharGun(e.model, s.w === 'nade' ? 'nade' : s.w, e.gskin); }
      e.model.userData.firing = performance.now() - (e.lastShot || 0) < 150;
      if (e.boss) animBoss(e, dt, sp > 20 ? 0 : sp, false); else animChar(e.model, dt, sp > 20 ? 0 : sp, s.pitch, !!(s.fl & 2), !!(s.fl & 64), false);
      if (e.emote) { if (performance.now() < e.emote.until && sp < 1.5) { applyEmote(e.model, e.emote.anim, (performance.now() - e.emote.t0) / 1000); emoteFx(e.emote.fx, e.rx, e.ry, e.rz, spawnParticle); } else { clearEmotePose(e.model); e.emote = null; } }
      // 보호막 깜빡임
      e.model.visible = !(s.fl & 16) || (Math.floor(performance.now() / 120) % 2 === 0);
      e.tag.visible = !kcOn;
      const radar = serverNow() < (S.uavUntil || 0) && !isMate(e.id) && !kcOn;
      e.model.userData.uavMk.visible = radar;
      e.tag.material.depthTest = !(isMate(e.id) || radar);
      if (kcOn && e.id === S.kc.killer) e.model.visible = false;
    } else {
      if (e.alive) { e.alive = false; e.deadT = 0; }
      e.deadT += dt;
      if (e.boss) animBoss(e, dt, 0, true); else animChar(e.model, dt, 0, 0, false, false, true);
      e.tag.visible = false;
      e.model.visible = e.deadT < 2.8;
    }
  }
}

/* ================= 로컬 플레이어 ================= */
function onSpawn(m) {
  Object.assign(me, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0, yaw: m.yaw, pitch: 0, alive: true, crouch: false, sliding: false, h: P.H, jumps: 0, camOff: 0, stepDy: 0, prot: m.prot });
  S.dead = false; S.killer = null;
  $('death').classList.add('hidden');
  fullAmmo(me.secondary);
  if (me.primary && !ammo[me.primary]) fullAmmo(me.primary);
  WS.reloading = false; WS.spin = 0; WS.recoil = 0; WS.bloom = 0;
  switchTo(me.primary || me.secondary || meleeId(), true);
}
function onMe(m) {
  const prevPrim = me.primary, prevSec = me.secondary;
  Object.assign(me, { zombie: !!m.zombie, gg: m.gg || 0, hp: m.hp, armor: m.armor, money: m.money, primary: m.primary, secondary: m.secondary, nades: m.nades, buyUntil: m.buyUntil, respawnAt: m.respawnAt, helmet: !!m.helmet, perks: m.perks || [], sup: m.sup || { turret: 0, air: 0 }, maxHp: m.maxHp || 100 });
  if (!m.alive && me.alive) { me.alive = false; }
  if (m.primary && m.primary !== prevPrim && !ammo[m.primary]) fullAmmo(m.primary);
  if (m.secondary !== prevSec) fullAmmo(m.secondary);
  if ((!haveWeapon(WS.cur) || (m.zombie && WS.cur !== 'claw')) && me.alive) switchTo(me.primary || me.secondary || meleeId(), true);
  if (S.modal === 'buy') renderBuy();
}
function haveWeapon(w) { return w === meleeId() || (!!w && (w === me.primary || w === me.secondary)) || (w === 'nade' && me.nades > 0 && !me.zombie); }
function isSprinting() { const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); return keys.ShiftLeft && fwd > 0 && !me.crouch && WS.ads < 0.3; }
function startSlide() {
  const sp = Math.hypot(me.vx, me.vz);
  if (sp < 4) return;
  me.sliding = true; me.slideT = 0.8;
  const k = Math.max(P.SLIDE, sp * 1.15) / sp; me.vx *= k; me.vz *= k;
  A.sfxLand();
}
function jump() {
  if (me.ground) { me.vy = P.JUMP; me.jumps = 1; me.ground = false; if (me.sliding) { me.sliding = false; } A.sfxJump(); }
  else if (me.jumps < 2) {
    me.vy = P.JUMP2; me.jumps = 2; A.sfxJump();
    // 공중 점프: 방향 전환 약간
    const w = wishDir(); if (w) { const sp = Math.max(Math.hypot(me.vx, me.vz), 4); me.vx = lerp(me.vx, w[0] * sp, 0.6); me.vz = lerp(me.vz, w[1] * sp, 0.6); }
    for (let i = 0; i < 10; i++) spawnParticle(me.x, me.y, me.z, (Math.random() - 0.5) * 3, -1 - Math.random(), (Math.random() - 0.5) * 3, 0xffffff, 0.4, 0.09, 2);
  }
}
function wishDir() {
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  if (!f && !s) return null;
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw), rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw);
  let x = fx * f + rx * s, z = fz * f + rz * s; const l = Math.hypot(x, z); return [x / l, z / l];
}
let stepAcc = 0;
function updateMe(dt) {
  if (!me.alive || !S.map) return;
  const W = WEAPONS[WS.cur] || WEAPONS.knife;
  const wantCrouch = !!keys.KeyC;
  if (wantCrouch && !me.crouch) me.crouch = true;
  else if (!wantCrouch && me.crouch && !me.sliding) { if (!SH.bodyHits(S.map, me.x, me.y, me.z, P.H)) me.crouch = false; }
  if (me.sliding) me.crouch = true;
  me.h = me.crouch ? P.HC : P.H;
  const frozen = spikeFrozen();
  const wish = frozen ? null : wishDir();
  if (frozen && me.ground) { me.vx = 0; me.vz = 0; me.sliding = false; }
  const sprint = isSprinting() && !WS.reloading;
  let speed = (me.crouch ? P.CROUCH : sprint ? P.RUN : P.WALK) * (W.speed || 1) * (WS.ads > 0.5 ? 0.62 : 1) * (me.perks.includes('perk_speed') ? 1.12 : 1) * (me.zombie ? SH.ZB.SPEED : 1);
  if (me.sliding) {
    const f = 1 - dt * 1.4; me.vx *= f; me.vz *= f;
    me.slideT -= dt;
    if (me.slideT <= 0 || Math.hypot(me.vx, me.vz) < 3.5) me.sliding = false;
  } else {
    const tx = wish ? wish[0] * speed : 0, tz = wish ? wish[1] * speed : 0;
    const acc = (me.ground ? 55 * groundAccMul(me) : 14) * dt;
    const dx = tx - me.vx, dz = tz - me.vz, dl = Math.hypot(dx, dz);
    if (me.ground || wish) {
      if (dl <= acc) { me.vx = tx; me.vz = tz; } else { me.vx += dx / dl * acc; me.vz += dz / dl * acc; }
    }
  }
  me.vy -= P.GRAV * dt * (S.map.grav || 1);
  const wasGround = me.ground, vyBefore = me.vy;
  SH.moveBody(S.map, me, dt);
  afterMove(me);
  if (me.ground) { me.jumps = 0; if (!wasGround && vyBefore < -9) A.sfxLand(); }
  if (me.stepDy) { me.camOff -= me.stepDy; me.stepDy = 0; }
  me.camOff *= Math.pow(0.0001, dt); if (Math.abs(me.camOff) < 0.002) me.camOff = 0;
  me.eye = lerp(me.eye, me.crouch ? P.EYEC : P.EYE, Math.min(1, dt * 14));
  // 발소리
  const hs = Math.hypot(me.vx, me.vz);
  if (me.ground && hs > 2 && !me.crouch) {
    stepAcc += dt * hs;
    if (stepAcc > 2.6) {
      stepAcc = 0; A.sfxStep(sprint ? 1 : 0.7);
      const cf = me.zombie ? null : (CHAR_SKINS[profile.skin] || {}).fx; // 레어+ 캐릭터: 발소리·발자국 효과
      if (cf) { sfxSkinStep(cf.step, sprint ? 1 : 0.7); for (let i = 0; i < 4; i++) spawnParticle(me.x + (Math.random() - 0.5) * 0.4, me.y + 0.05, me.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 1.2, Math.random() * 1.2, (Math.random() - 0.5) * 1.2, cf.dust, 0.4, 0.05, 4); }
    }
  }
  WS.bob = (WS.bob || 0) + dt * (me.ground ? hs : 0) * 1.6;
  if (me.y < -10) { send({ t: 'suicide' }); me.alive = false; }
  tryPick(false);
}

/* ================= 무기 ================= */
const VMS = 0.022;
const vm = { holder: new THREE.Group(), gun: null, id: null, flash: null, arms: null };
viewScene.add(vm.holder);
function armMesh(len, shirt, skin) {
  const g = new THREE.Group();
  const sl = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, len).translate(0, 0, len / 2 + 0.06), new THREE.MeshLambertMaterial({ color: shirt }));
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.12).translate(0, 0, 0.06), new THREE.MeshLambertMaterial({ color: skin }));
  g.add(sl, hd); return g;
}
function setViewModel(id, look) {
  look = look || (me.zombie ? { ci: CFG.color, skin: 'zombie', gskin: 'default' } : { ci: CFG.color, skin: profile.skin, gskin: profile.gskin });
  if (vm.gun) vm.holder.remove(vm.gun);
  if (vm.arms) vm.holder.remove(vm.arms);
  vm.id = id;
  const gun = makeGun(id === 'nade' ? 'nade' : id, id === 'nade' ? 0.022 : VMS, look.gskin);
  vm.gun = gun; vm.holder.add(gun);
  const sm = skinMats(look.ci, look.skin);
  const arms = new THREE.Group();
  const ra = armMesh(0.55, sm.shirt, sm.skin); ra.position.set(0.015, -0.05, 0.02); ra.rotation.set(0.45, 0.25, 0); arms.add(ra);
  const def = GUNS[id] || GUNS.pistol;
  const two = !['pistol', 'magnum', 'uzi', 'knife', 'claw', 'nade'].includes(id);
  if (two) {
    const fz = -((def.muz[2] - def.grip[2]) * 0.48) * VMS;
    const la = armMesh(0.6, sm.shirt, sm.skin); la.position.set(-0.02, -0.04, fz); la.rotation.set(0.35, -0.75, 0); arms.add(la);
  } else if (id !== 'knife' && id !== 'claw' && id !== 'nade') {
    const la = armMesh(0.55, sm.shirt, sm.skin); la.position.set(-0.04, -0.09, 0.02); la.rotation.set(0.45, -0.5, 0); arms.add(la);
  }
  vm.arms = arms; vm.holder.add(arms);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLASH, transparent: true, depthTest: false }));
  fl.scale.set(0.22, 0.22, 1); fl.position.copy(gun.userData.muzzle); fl.visible = false; gun.add(fl); vm.flash = fl;
  // 스킨: 총구 섬광 색 + 전설 오라
  const gsk = GUN_SKINS[look.gskin];
  if (gsk && gsk.fx && typeof gsk.fx.flash === 'number') fl.material.color.setHex(gsk.fx.flash);
  if (id !== 'nade' && id !== 'claw') decorateGun(gun, gsk, gunLength(id, VMS));
  vm.flashT = 0;
}
function switchTo(w, force) {
  if (!w || (!force && w === WS.cur)) return;
  if (!haveWeapon(w)) return;
  if (WS.cur !== w) WS.last = WS.cur;
  WS.cur = w; WS.reloading = false; WS.switchT = 0.38; WS.spin = 0; WS.burstLeft = 0; WS.fireT = Math.max(WS.fireT, 0);
  if (w !== 'knife' && w !== 'nade' && !ammo[w]) fullAmmo(w);
  setViewModel(w);
  A.sfxSwitch();
  const gsk = GUN_SKINS[profile.gskin];
  if (gsk && gsk.r === 'legend' && !me.zombie && w !== 'nade') sfxEquip(gsk.fx.snd);
}
function cycleWeapon(dir) {
  const list = [me.primary, me.secondary, meleeId(), me.nades > 0 ? 'nade' : null].filter(Boolean);
  const i = list.indexOf(WS.cur);
  switchTo(list[(i + dir + list.length) % list.length]);
}
function startReload() {
  const W = WEAPONS[WS.cur], a = ammo[WS.cur];
  if (!W || !W.mag || !a || WS.reloading || a.mag >= W.mag || a.res <= 0) return;
  const rf = me.perks.includes('perk_reload') ? 0.7 : 1;
  WS.reloading = true; WS.reloadT = W.reload * rf; WS.reloadDur = W.reload * rf;
  A.sfxReload(0);
}
function updateWeapon(dt) {
  if (S.mode === 'practice') for (const k in ammo) { const W2 = WEAPONS[k]; if (W2 && W2.res) ammo[k].res = W2.res; }
  const W = WEAPONS[WS.cur];
  WS.fireT -= dt; WS.switchT = Math.max(0, WS.switchT - dt);
  WS.recoil *= Math.pow(0.002, dt); WS.bloom *= Math.pow(0.02, dt); WS.kick *= Math.pow(0.0005, dt);
  WS.slashT = Math.max(0, WS.slashT - dt);
  const canAds = me.alive && W && !W.melee && !WS.reloading && WS.cur !== 'nade' && !me.sliding;
  WS.ads = clamp(WS.ads + ((WS.adsHeld && canAds) ? dt * 7 : -dt * 8), 0, 1);
  if (!me.alive) return;
  // 재장전
  if (WS.reloading) {
    WS.reloadT -= dt;
    if (WS.reloadT <= 0) {
      const a = ammo[WS.cur];
      if (W.shell) {
        a.mag++; a.res--; A.sfxReload(1);
        if (a.mag < W.mag && a.res > 0) WS.reloadT = W.reload * (me.perks.includes('perk_reload') ? 0.7 : 1); else WS.reloading = false;
      } else {
        const take = Math.min(W.mag - a.mag, a.res); a.mag += take; a.res -= take; WS.reloading = false; A.sfxReload(1);
      }
    }
  }
  // 미니건 회전
  if (W && W.spin) {
    const want = WS.trigger || WS.adsHeld;
    if (want && WS.spin === 0) A.sfxSpin(true);
    WS.spin = clamp(WS.spin + (want ? dt : -dt * 1.5), 0, W.spin);
    if (vm.gun && vm.gun.userData.spin) vm.gun.userData.spin.rotation.z += dt * 40 * (WS.spin / W.spin);
  }
  if (WS.trigger && !S.modal) {
    if (WEAPONS[WS.cur] && WEAPONS[WS.cur].melee) { if (WS.fireT <= 0) knifeAttack(); }
    else if (WS.cur === 'nade') { if (WS.semiReady) { WS.semiReady = false; throwNade(); } }
    else if (W && W.burst) { if (WS.semiReady && WS.fireT <= 0 && !WS.burstLeft) { WS.semiReady = false; WS.burstLeft = W.burst; } }
    else if (W && (W.auto || WS.semiReady)) {
      let n = 0;
      while (WS.fireT <= 0 && n++ < 3 && WS.trigger) { if (!fireGun(W)) break; if (!W.auto) { WS.semiReady = false; break; } }
    }
  }
  // 점사: 버튼을 떼도 남은 발은 이어서 나감
  if (WS.burstLeft > 0 && W && W.burst) {
    while (WS.fireT <= 0 && WS.burstLeft > 0) { if (!fireGun(W)) { WS.burstLeft = 0; break; } if (--WS.burstLeft === 0) WS.fireT += W.burstGap; }
  }
  if (WS.fireT < -0.05) WS.fireT = -0.05;
}
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
function camForward(out) { return out.set(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch)); }
function eyePos() { return new THREE.Vector3(me.x, me.y + me.eye, me.z); }
function fireGun(W) {
  const a = ammo[WS.cur];
  if (WS.switchT > 0) return false;
  if (WS.reloading) { if (W.shell && a.mag > 0) WS.reloading = false; else return false; }
  if (!a || a.mag <= 0) { if (WS.semiReady || WS.fireT <= 0) { A.sfxEmpty(); WS.fireT = 0.25; WS.semiReady = false; startReload(); } return false; }
  if (W.spin && WS.spin < W.spin) return false;
  WS.fireT = Math.max(WS.fireT, -0.02) + 60 / W.rpm;
  a.mag--;
  WS.lastFire = performance.now();
  const eye = eyePos(), fwd = camForward(new THREE.Vector3());
  const moving = Math.hypot(me.vx, me.vz) / P.RUN;
  let spread = (WS.ads > 0.6 ? (W.adsSpread != null ? W.adsSpread : W.spread * 0.35) : W.spread) + moving * (W.mspread || 0) + WS.bloom + (me.ground ? 0 : 0.05);
  if (me.crouch && !me.sliding) spread *= 0.7;
  if (W.scope && WS.ads < 0.9) spread = Math.max(spread, W.spread);
  const right = new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw)), up = new THREE.Vector3().crossVectors(right, fwd);
  const start = eye.clone().addScaledVector(right, 0.22).addScaledVector(up, -0.18).addScaledVector(fwd, 0.6);
  if (WS.ads > 0.6) start.copy(eye).addScaledVector(up, -0.08).addScaledVector(fwd, 0.6);
  vm.flashT = 0.05;
  muzzleLight(start);
  A.sfxShot(WS.cur, 1, 0);
  const myFx = me.zombie ? null : (GUN_SKINS[profile.gskin] || {}).fx;
  if (myFx) sfxSkinShot(myFx.snd, 1, 0);
  const trc = W.tracer || (myFx ? fxColor(myFx.tracer) : 0);
  if (W.proj) {
    send({ t: 'proj', kind: 'rocket', x: eye.x + fwd.x * 0.6, y: eye.y + fwd.y * 0.6 - 0.1, z: eye.z + fwd.z * 0.6, dx: fwd.x, dy: fwd.y, dz: fwd.z });
  } else {
    const ends = [], hits = new Map(), hitTurs = new Set();
    let shotHit = false, shotHead = false;
    for (let i = 0; i < (W.pellets || 1); i++) {
      const d = fwd.clone();
      if (spread > 0) {
        const r = spread * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
        d.addScaledVector(right, Math.cos(th) * r).addScaledVector(up, Math.sin(th) * r).normalize();
      }
      let res = hitscan(eye, d, 160);
      // 관통 (레일건): 맞은 적을 제외하고 다시 쏴서 뒤의 적도 맞힘
      if (W.pierce && res.ent) {
        const skip = new Set([res.ent.id]); let k = 1, last = res;
        while (k++ < W.pierce) {
          const nx = hitscan(eye, d, 160, skip); if (!nx.ent) { last = nx; break; }
          skip.add(nx.ent.id); last = nx;
          const h2 = hits.get(nx.ent.id) || { dmg: 0, head: false, ent: nx.ent };
          h2.dmg += W.dmg * SH.falloff(W, nx.t) * (W.partMul || SH.PART_MUL)[nx.part]; if (nx.part === 'head') h2.head = true; hits.set(nx.ent.id, h2); blood(nx.p, d);
        }
        tracer(start, last.p, trc);
      } else tracer(start, res.p, trc);
      ends.push([+res.p.x.toFixed(2), +res.p.y.toFixed(2), +res.p.z.toFixed(2), res.ent ? 1 : 0]);
      if (res.ent) {
        const pm = (W.partMul || SH.PART_MUL)[res.part];
        const dmg = W.dmg * SH.falloff(W, res.t) * pm;
        const h = hits.get(res.ent.id) || { dmg: 0, head: false, ent: res.ent };
        h.dmg += dmg; if (res.part === 'head') h.head = true; hits.set(res.ent.id, h);
        shotHit = true; if (res.part === 'head') shotHead = true;
        blood(res.p, d);
      } else if (res.tg) {
        hitTarget(res.tg); shotHit = true; puff(res.p, 0xffffff, 6);
      } else if (res.tur) {
        res.tur.dmgAcc = (res.tur.dmgAcc || 0) + W.dmg * SH.falloff(W, res.t);
        hitTurs.add(res.tur);
        puff(res.p, 0xffd040, 5);
      } else if (res.wall) impact(res.p, res.wall, d, myFx && fxColor(myFx.impact));
    }
    send({ t: 'shot', w: WS.cur, e: ends.slice(0, 12) });
    logShot(S.myId, WS.cur, ends);
    if (S.mode === 'practice' && S.pst) { S.pst.shots++; if (shotHit) S.pst.hits++; if (shotHead) S.pst.heads++; }
    for (const tu of hitTurs) { send({ t: 'hitt', id: tu.id, w: WS.cur, dmg: Math.round(tu.dmgAcc * 10) / 10 }); tu.dmgAcc = 0; hitMarker(''); A.sfxHit(false); }
    for (const h of hits.values()) {
      send({ t: 'hit', id: h.ent.id, w: WS.cur, dmg: Math.round(h.dmg * 10) / 10, part: h.head ? 'head' : 'body' });
      hitMarker(h.head ? 'head' : '');
      A.sfxHit(h.head);
    }
  }
  // 반동
  const rk = W.recoil * (WS.ads > 0.6 ? 0.6 : 1) * (me.crouch ? 0.75 : 1);
  me.pitch = clamp(me.pitch + rk * 0.0045, -1.55, 1.55);
  me.yaw += (Math.random() - 0.5) * rk * 0.003;
  WS.recoil += rk * 0.006; WS.bloom = Math.min(0.08, WS.bloom + rk * 0.0028); WS.kick = Math.min(1, WS.kick + 0.25 + rk * 0.05);
  if (a.mag <= 0) setTimeout(() => { if (ammo[WS.cur] === a && a.mag <= 0) startReload(); }, 250);
  return true;
}
function hitscan(o, d, maxD, skip) {
  const wall = SH.raycast(S.map, o.x, o.y, o.z, d.x, d.y, d.z, maxD);
  let best = wall ? wall.t : maxD, ent = null, part = null;
  for (const e of S.ents.values()) {
    if (!e.alive || !e.model.visible && !(e.fl & 16)) continue;
    if (skip && skip.has(e.id)) continue;
    if (isMate(e.id)) continue; // 아군은 통과
    if (Math.hypot(e.rx - o.x, e.rz - o.z) > best + 2) continue;
    for (const hb of (e.boss ? SH.bossHitboxes(e.rx, e.ry, e.rz) : SH.hitboxes(e.rx, e.ry, e.rz, !!(e.fl & 2)))) {
      const t = SH.rayBox(o.x, o.y, o.z, d.x, d.y, d.z, hb.b);
      if (t >= 0 && t < best) { best = t; ent = e; part = hb.part; }
    }
  }
  let tur = null;
  for (const tu of S.turrets.values()) {
    if (tu.owner === S.myId || (isTeamMode() && tu.team === myTeam())) continue;
    const t = SH.rayBox(o.x, o.y, o.z, d.x, d.y, d.z, [tu.x - 0.4, tu.y, tu.z - 0.4, tu.x + 0.4, tu.y + 1.3, tu.z + 0.4]);
    if (t >= 0 && t < best) { best = t; tur = tu; ent = null; }
  }
  let tg = null;
  for (const t of S.targets) {
    if (!t.up) continue;
    const tt = SH.rayBox(o.x, o.y, o.z, d.x, d.y, d.z, [t.x - 0.45, SH.G + 0.85, t.z - 0.12, t.x + 0.45, SH.G + 1.95, t.z + 0.12]);
    if (tt >= 0 && tt < best) { best = tt; tg = t; ent = null; tur = null; }
  }
  const p = o.clone().addScaledVector(d, best);
  return { t: best, p, ent, part, tur, tg, wall: !ent && !tur && !tg && wall ? wall : null };
}
function knifeAttack() {
  const W = WEAPONS[WS.cur] || WEAPONS.knife;
  WS.fireT = 60 / W.rpm; WS.slashT = 0.3; WS.lastFire = performance.now();
  A.sfxKnife();
  const eye = eyePos(), fwd = camForward(new THREE.Vector3());
  // 약간 넓게: 3방향 레이
  let hit = null;
  for (const off of [0, 0.15, -0.15]) {
    const d = fwd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), off);
    const r = hitscan(eye, d, W.melee);
    if (r.ent) { hit = r; break; }
    if (!hit && r.wall && off === 0) impact(r.p, r.wall, d);
  }
  if (hit) {
    const e = hit.ent;
    const back = WS.cur === 'knife' && !e.boss && Math.abs(angDiff(e.ryaw, me.yaw)) < 0.9;
    const dmg = back ? 150 : W.dmg;
    send({ t: 'hit', id: e.id, w: WS.cur, dmg, part: 'body' });
    hitMarker(back ? 'head' : ''); A.sfxHit(back);
    blood(hit.p, fwd);
  }
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function throwNade() {
  if (me.nades <= 0) { switchTo(WS.last && haveWeapon(WS.last) ? WS.last : me.secondary); return; }
  const eye = eyePos(), fwd = camForward(new THREE.Vector3());
  send({ t: 'proj', kind: 'nade', x: eye.x + fwd.x * 0.5, y: eye.y + fwd.y * 0.5, z: eye.z + fwd.z * 0.5, dx: fwd.x, dy: fwd.y + 0.15, dz: fwd.z });
  me.nades--; WS.slashT = 0.3; A.sfxKnife();
  setTimeout(() => { if (WS.cur === 'nade') switchTo(me.nades > 0 ? 'nade' : (WS.last && WS.last !== 'nade' && haveWeapon(WS.last) ? WS.last : (me.primary || me.secondary)), true); }, 350);
}
function quickNade() {
  if (me.nades <= 0) { toast('수류탄이 없어요 (상점에서 구매)'); return; }
  const back = WS.cur;
  if (WS.cur !== 'nade') { WS.cur = 'nade'; setViewModel('nade'); WS.last = back; }
  throwNade();
}

/* ================= 줍기 ================= */
function tryPick(manual) {
  if (!me.alive) return;
  let best = null, bd = 1.6;
  for (const d of S.drops.values()) { const dist = Math.hypot(d.x - me.x, d.z - me.z); if (dist < bd && Math.abs(d.y - me.y) < 2) { bd = dist; best = d; } }
  S.nearDrop = best;
  if (!best) return;
  const nowT = performance.now();
  if (manual || (!me.primary && (!best.askT || nowT - best.askT > 500))) { best.askT = nowT; send({ t: 'pick', id: best.id }); }
}
function addDrop(d) {
  if (S.drops.has(d.id)) return;
  const g = makeGun(d.w, 0.032); g.position.set(d.x, d.y, d.z);
  scene.add(g);
  S.drops.set(d.id, Object.assign({}, d, { mesh: g, t: Math.random() * 6 }));
}
function removeDrop(id) { const d = S.drops.get(id); if (!d) return; scene.remove(d.mesh); S.drops.delete(id); }
function updateDrops(dt) {
  for (const d of S.drops.values()) {
    d.t += dt;
    // 떨어지기
    if (S.map && !S.map.solid(Math.floor(d.x), Math.floor(d.y - 0.05), Math.floor(d.z))) d.y = Math.max(d.y - dt * 6, 0);
    d.mesh.position.set(d.x, d.y + 0.35 + Math.sin(d.t * 2) * 0.08, d.z); d.mesh.rotation.y = d.t * 1.5;
  }
}

/* ================= 원격 사격 ================= */
function muzzleOf(e) {
  const g = e.model.userData.gun;
  if (g && g.userData.muzzle) { e.model.updateMatrixWorld(true); return g.localToWorld(g.userData.muzzle.clone()); }
  return new THREE.Vector3(e.rx, e.ry + 1.3, e.rz);
}
function logShot(id, w, e) {
  const t = serverNow();
  S.shotLog.push({ t, id, w, e });
  while (S.shotLog.length && S.shotLog[0].t < t - 7000) S.shotLog.shift();
}
function onRemoteShot(m) {
  if (String(m.id)[0] === 't') {
    const tu = S.turrets.get(m.id); if (!tu) return;
    logShot(m.id, m.w, m.e);
    if (S.kc && S.kc.active) return;
    const st = turretMuzzle(tu);
    const d = Math.hypot(st.x - me.x, st.z - me.z), ang = Math.atan2(-(st.x - me.x), -(st.z - me.z)) - me.yaw;
    A.sfxShot('smg', clamp(1 - d / 80, 0.05, 0.7), -Math.sin(ang) * 0.8);
    flashAt(st, 0.3); tu.kick = 1;
    for (const p of m.e || []) { const end = new THREE.Vector3(p[0], p[1], p[2]); tracer(st, end); if (p[3]) blood(end, end.clone().sub(st).normalize()); else puff(end, 0xcccccc, 3); }
    return;
  }
  const e = S.ents.get(m.id); if (!e) return;
  logShot(m.id, m.w, m.e);
  e.lastShot = performance.now();
  if (S.kc && S.kc.active) return; // 킬캠 중엔 실시간 이펙트 생략
  const st = muzzleOf(e);
  const d = Math.hypot(st.x - me.x, st.y - me.y, st.z - me.z);
  const ang = Math.atan2(-(st.x - me.x), -(st.z - me.z)) - me.yaw;
  A.sfxShot(m.w, clamp(1 - d / 90, 0.06, 0.9), -Math.sin(ang) * 0.8);
  const rr = S.roster.get(m.id), rfx = rr && !rr.zombie ? (GUN_SKINS[rr.gskin] || {}).fx : null;
  if (rfx) sfxSkinShot(rfx.snd, clamp(1 - d / 90, 0.06, 0.9), -Math.sin(ang) * 0.8);
  flashAt(st, 0.35);
  for (const p of m.e || []) {
    const end = new THREE.Vector3(p[0], p[1], p[2]);
    tracer(st, end, (WEAPONS[m.w] || {}).tracer || (rfx ? fxColor(rfx.tracer) : 0));
    const dir = end.clone().sub(st).normalize();
    if (p[3]) blood(end, dir);
    else puff(end, 0xcccccc, 4);
  }
}

/* ================= 피해/처치 ================= */
function onDamaged(m) {
  me.hp = m.hp; me.armor = m.armor;
  A.sfxHurt();
  const v = $('vignette'); v.style.opacity = clamp(m.amt / 40, 0.25, 0.9); clearTimeout(v.t); v.t = setTimeout(() => v.style.opacity = 0, 180);
  if (m.from && m.from !== S.myId) {
    const ang = Math.atan2(-(m.ax - me.x), -(m.az - me.z)) - me.yaw;
    const el = document.createElement('div'); el.className = 'dmgdir';
    el.style.transform = `rotate(${-ang}rad) translateY(-110px)`;
    // 위쪽이 정면
    el.style.transform = `rotate(${-ang * 180 / Math.PI}deg) translate(0, -110px)`;
    $('dmgDirs').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  S.shake = Math.min(1, (S.shake || 0) + m.amt / 60);
}
function onKill(m) {
  const kn = m.k ? (S.roster.get(m.k) || {}).name || '?' : '?', vn = (S.roster.get(m.v) || {}).name || '?';
  const kr = S.roster.get(m.k), vr = S.roster.get(m.v);
  if (kr && m.k !== m.v) kr.k++; if (vr) vr.d++;
  const kf = document.createElement('div'); kf.className = 'kf' + (m.k === S.myId || m.v === S.myId ? ' me' : '');
  const icon = WEAPONS[m.w] || m.w === 'nade' ? `<img src="${gunIcon(m.w === 'nade' ? 'nade' : m.w, 1)}">` : '';
  kf.innerHTML = !m.k && ENV_KILL[m.w] ? `<span style="color:${nameColor(m.v)}">${esc(vn)}</span> <span class="dim">${ENV_KILL[m.w]}</span>`
    : m.k === m.v ? `<span>${esc(vn)}</span> ${icon} <span class="dim">자폭</span>` : `<span style="color:${nameColor(m.k)}">${esc(kn)}</span>${icon}${m.hs ? '<span class="hs">헤드</span>' : ''}<span style="color:${nameColor(m.v)}">${esc(vn)}</span>`;
  $('killfeed').prepend(kf);
  while ($('killfeed').children.length > 6) $('killfeed').lastChild.remove();
  setTimeout(() => kf.remove(), 7000);
  const ve = S.ents.get(m.v);
  const vsk = CHAR_SKINS[(vr || {}).skin];
  if (ve && vsk && vsk.death) killEffect(spawnParticle, { x: ve.rx, y: ve.ry - 0.3, z: ve.rz }, vsk.death, null);
  if (ve) { ve.alive = false; ve.deadT = 0; ve.buf.push({ t: serverNow(), x: ve.rx, y: ve.ry, z: ve.rz, yaw: ve.ryaw, pitch: 0, fl: 0, w: '', hp: 0 }); for (let i = 0; i < 18; i++) spawnParticle(ve.rx, ve.ry + 1, ve.rz, (Math.random() - 0.5) * 5, Math.random() * 5, (Math.random() - 0.5) * 5, 0xb3201a, 0.8, 0.1, 14); }
  if (m.k === S.myId && m.v !== S.myId) {
    S.streak = m.streak;
    A.sfxKill(); hitMarker('kill');
    const c = document.createElement('div'); c.className = 'cm' + (m.hs ? ' hs' : '');
    c.innerHTML = `${m.hs ? '헤드샷! ' : ''}${esc(vn)} 처치 <span class="reward">+$${m.reward}</span>`;
    $('center').prepend(c); while ($('center').children.length > 3) $('center').lastChild.remove();
    setTimeout(() => c.remove(), 2600);
    const gsk = GUN_SKINS[profile.gskin], csk = CHAR_SKINS[profile.skin];
    showKillBanner({ streak: m.streak || 1, hs: !!m.hs, theme: (gsk && gsk.banner) || (csk && csk.banner) });
    // 영웅: 처치 파편 + 처치음 / 전설: 피니셔
    if (gsk && (gsk.r === 'epic' || gsk.r === 'legend') && !me.zombie) {
      if (ve) killEffect(spawnParticle, { x: ve.rx, y: ve.ry, z: ve.rz }, gsk.fx.kill, gsk.finisher, flashAt);
      if (gsk.finisher) sfxFinisher(gsk.finisher); else sfxSkinKill(gsk.fx.snd);
    }
    onMyKill(m); trackKill(m);
    if (S.mode === 'practice' && S.pst) S.pst.kills++;
  }
  if (m.k && m.k !== S.myId && m.k !== m.v) onOtherKill(m, kn);
  if (m.v === S.myId) {
    trackDeath();
    me.alive = false; S.dead = true; S.killer = m.k !== m.v ? m.k : null; S.deathPos = { x: me.x, y: me.y, z: me.z, yaw: me.yaw };
    S.deathT = 0; WS.trigger = false; WS.ads = 0;
    $('death').classList.remove('hidden');
    $('deathBy').innerHTML = !m.k && ENV_KILL[m.w] ? `${ENV_KILL[m.w]}(으)로 쓰러졌어요` : m.k === m.v ? '스스로 쓰러졌어요' : `<span style="color:${nameColor(m.k)}">${esc(kn)}</span> ${titleHtml((kr || {}).title)}${icon}${m.hs ? '<span class="hs" style="color:#ff6a5a">헤드샷</span>' : ''}`;
    closeModals(true);
    S.selfBuf.push({ t: serverNow(), x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: 0, fl: 0, w: WS.cur });
    if (CFG.killcam !== false && S.killer && S.ents.get(S.killer) && m.w !== 'turret' && m.w !== 'air') S.kc = { killer: S.killer, w: m.w, hs: m.hs, at: serverNow(), start: performance.now() + 800, active: false, lastT: 0, kick: 0, vw: null };
  }
  if (S.modal === 'score') renderScore();
}

/* ================= 이펙트 ================= */
const PMAX = 700;
const pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), PMAX);
pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PMAX * 3), 3);
pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
const parts = [];
const _m4 = new THREE.Matrix4(), _col = new THREE.Color();
function spawnParticle(x, y, z, vx, vy, vz, color, life, size, grav) {
  if (parts.length >= PMAX) parts.shift();
  parts.push({ x, y, z, vx, vy, vz, life, max: life, size, grav: grav == null ? 12 : grav, color });
}
// 눈 내리기
let snowAcc = 0;
function updateWeather(dt) {
  const def = S.mapId && SH.MAPS[S.mapId];
  if (!def || !def.snow) return;
  snowAcc += dt * 45;
  while (snowAcc > 1) {
    snowAcc--;
    const a = Math.random() * Math.PI * 2, d = 2 + Math.random() * 22;
    spawnParticle(camera.position.x + Math.cos(a) * d, camera.position.y + 8 + Math.random() * 6, camera.position.z + Math.sin(a) * d, (Math.random() - 0.5) * 0.6, -1.6 - Math.random(), (Math.random() - 0.5) * 0.6, 0xffffff, 5, 0.07, 0);
  }
}
function updateParticles(dt) {
  updateWeather(dt);
  let n = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (S.map && S.map.solid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { p.y = Math.floor(p.y) + 1.01; p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; }
  }
  for (const p of parts) {
    const s = p.size * Math.min(1, p.life / p.max * 2);
    _m4.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
    pMesh.setMatrixAt(n, _m4); pMesh.setColorAt(n, _col.setHex(p.color)); n++;
  }
  pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
}
function puff(p, color, n) { for (let i = 0; i < n; i++) spawnParticle(p.x, p.y, p.z, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, color, 0.4 + Math.random() * 0.3, 0.06, 10); }
function blood(p, d) { for (let i = 0; i < 8; i++) spawnParticle(p.x, p.y, p.z, d.x * 2 + (Math.random() - 0.5) * 3, Math.random() * 3, d.z * 2 + (Math.random() - 0.5) * 3, Math.random() < 0.5 ? 0xc01e1e : 0x8a1010, 0.5 + Math.random() * 0.3, 0.07, 12); }
const holes = []; const holeGeo = new THREE.PlaneGeometry(0.13, 0.13);
const holeMat = new THREE.MeshBasicMaterial({ map: HOLE, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
function impact(p, wall, d, fxc) {
  const col = BLOCK_COLOR[wall.b] || 0x999999;
  if (fxc) for (let i = 0; i < 5; i++) spawnParticle(p.x + wall.nx * 0.05, p.y + wall.ny * 0.05, p.z + wall.nz * 0.05, wall.nx * 3 + (Math.random() - 0.5) * 4, wall.ny * 3 + Math.random() * 3, wall.nz * 3 + (Math.random() - 0.5) * 4, fxc, 0.35 + Math.random() * 0.3, 0.06, 6);
  for (let i = 0; i < 6; i++) spawnParticle(p.x + wall.nx * 0.05, p.y + wall.ny * 0.05, p.z + wall.nz * 0.05, wall.nx * 2 + (Math.random() - 0.5) * 3, wall.ny * 2 + Math.random() * 2.5, wall.nz * 2 + (Math.random() - 0.5) * 3, col, 0.5 + Math.random() * 0.4, 0.07, 14);
  smoke(p.x + wall.nx * 0.1, p.y + wall.ny * 0.1, p.z + wall.nz * 0.1, 0.35, 0.5);
  let h = holes.length < 90 ? null : holes.shift();
  if (!h) { h = new THREE.Mesh(holeGeo, holeMat); scene.add(h); }
  h.position.set(p.x + wall.nx * 0.012, p.y + wall.ny * 0.012, p.z + wall.nz * 0.012);
  h.lookAt(h.position.x + wall.nx, h.position.y + wall.ny, h.position.z + wall.nz);
  h.rotation.z = Math.random() * 6;
  h.visible = true; h.userData.blk = wall.x + ',' + wall.y + ',' + wall.z;
  holes.push(h);
  void d;
}
const smokes = [];
function smoke(x, y, z, size, life, color) {
  let s = smokes.find(o => o.life <= 0);
  if (!s) { if (smokes.length > 80) return; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: SMOKE, transparent: true, depthWrite: false })); scene.add(sp); s = { sp, life: 0 }; smokes.push(s); }
  s.sp.visible = true; s.sp.position.set(x, y, z); s.size = size; s.life = s.max = life; s.sp.material.color.setHex(color || 0xffffff);
  s.vy = 0.6 + Math.random() * 0.4;
}
function updateSmoke(dt) {
  for (const s of smokes) {
    if (s.life <= 0) continue;
    s.life -= dt; if (s.life <= 0) { s.sp.visible = false; continue; }
    const k = 1 - s.life / s.max;
    s.sp.position.y += s.vy * dt; s.sp.scale.setScalar(s.size * (1 + k * 1.8)); s.sp.material.opacity = (1 - k) * 0.8;
  }
}
const tracers = []; const trGeo = new THREE.BoxGeometry(0.025, 0.025, 1).translate(0, 0, -0.5);
function tracer(a, b, color) {
  let t = tracers.find(o => o.life <= 0);
  if (!t) { if (tracers.length > 60) return; const m = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, depthWrite: false })); scene.add(m); t = { m, life: 0 }; tracers.push(t); }
  t.m.material.color.setHex(color || 0xffe9a0);
  const len = a.distanceTo(b);
  if (len < 0.5) return;
  // 총구에서 일부 구간만 빠르게 지나가는 꼬리
  t.a = a.clone(); t.b = b.clone(); t.len = len; t.life = t.max = Math.min(0.12, 0.03 + len / 600); t.m.visible = true;
}
function updateTracers(dt) {
  for (const t of tracers) {
    if (t.life <= 0) continue;
    t.life -= dt; if (t.life <= 0) { t.m.visible = false; continue; }
    const k = 1 - t.life / t.max, seg = Math.min(t.len, 6), head = Math.min(t.len, k * t.len + seg * 0.5);
    const tail = Math.max(0, head - seg);
    _d.copy(t.b).sub(t.a).normalize();
    t.m.position.copy(t.a).addScaledVector(_d, tail);
    _v.copy(t.a).addScaledVector(_d, head);
    t.m.lookAt(_v); t.m.scale.set(1, 1, Math.max(0.01, head - tail));
    t.m.material.opacity = 0.9 * (1 - k * 0.5);
  }
}
const flashes = [];
function flashAt(p, size) {
  let f = flashes.find(o => o.life <= 0);
  if (!f) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLASH, transparent: true, depthWrite: false })); scene.add(sp); f = { sp, life: 0 }; flashes.push(f); }
  f.sp.position.copy(p); f.sp.scale.setScalar(size); f.life = 0.05; f.sp.visible = true; f.sp.material.rotation = Math.random() * 6;
}
const mLight = new THREE.PointLight(0xffc860, 0, 8); scene.add(mLight);
function muzzleLight(p) { mLight.position.copy(p); mLight.intensity = 6; }
function updateFlashes(dt) { for (const f of flashes) { if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.sp.visible = false; } } mLight.intensity = Math.max(0, mLight.intensity - dt * 120); }
function clearFx() { parts.length = 0; for (const s of smokes) { s.life = 0; s.sp.visible = false; } for (const t of tracers) { t.life = 0; t.m.visible = false; } for (const h of holes) scene.remove(h); holes.length = 0; }

function onBoom(m) {
  const p = new THREE.Vector3(m.x, m.y, m.z);
  if (m.blk && m.blk.length && S.map) {
    const gone = new Set();
    for (const [x, y, z] of m.blk) {
      const b = S.map.get(x, y, z);
      if (b) for (let i = 0; i < 2; i++) spawnParticle(x + Math.random(), y + Math.random(), z + Math.random(), (x + 0.5 - m.x) * 3 + (Math.random() - 0.5) * 3, 3 + Math.random() * 5, (z + 0.5 - m.z) * 3 + (Math.random() - 0.5) * 3, BLOCK_COLOR[b] || 0x888888, 1 + Math.random() * 0.8, 0.22, 16);
      S.map.set(x, y, z, 0); gone.add(x + ',' + y + ',' + z);
    }
    rebuildBlocks(S.world, m.blk);
    for (const h of holes) if (h.userData.blk && gone.has(h.userData.blk)) h.visible = false;
  }
  flashAt(p, m.r * 1.4);
  mLight.position.copy(p); mLight.intensity = 30; mLight.distance = 18;
  setTimeout(() => { mLight.distance = 8; }, 200);
  for (let i = 0; i < 50; i++) { const a = Math.random() * 6.28, b = Math.random() * 3.14, s = 4 + Math.random() * 8; spawnParticle(m.x, m.y, m.z, Math.cos(a) * Math.sin(b) * s, Math.cos(b) * s + 3, Math.sin(a) * Math.sin(b) * s, [0xffd040, 0xff8a20, 0xd04010, 0x555555][i % 4], 0.6 + Math.random() * 0.6, 0.14, 10); }
  for (let i = 0; i < 12; i++) smoke(m.x + (Math.random() - 0.5) * 2.5, m.y + Math.random() * 1.5, m.z + (Math.random() - 0.5) * 2.5, 1.2 + Math.random(), 1.2 + Math.random() * 0.8, i % 3 ? 0x777777 : 0xffaa55);
  const d = Math.hypot(m.x - me.x, m.y - (me.y + 1), m.z - me.z);
  const ang = Math.atan2(-(m.x - me.x), -(m.z - me.z)) - me.yaw;
  A.sfxBoom(clamp(1.2 - d / 70, 0.1, 1.2), -Math.sin(ang) * 0.7);
  S.shake = Math.min(1.5, (S.shake || 0) + clamp(1.5 - d / 12, 0, 1.5));
  // 넉백 (로켓 점프!)
  if (me.alive && d < m.r * 1.3) {
    const k = (1 - d / (m.r * 1.3)) * (m.by === S.myId ? 15 : 9);
    const dx = me.x - m.x, dy = me.y + 0.9 - m.y, dz = me.z - m.z, l = Math.max(0.3, Math.hypot(dx, dy, dz));
    me.vx += dx / l * k; me.vz += dz / l * k; me.vy = Math.max(me.vy, 0) + Math.max(0.35, dy / l) * k * 1.1; me.ground = false; me.sliding = false;
  }
  for (const [id, pr] of S.projs) if (Math.hypot(pr.mesh.position.x - m.x, pr.mesh.position.z - m.z) < 3) removeProj(id);
}
function onProj(m) {
  const [id, kind, x, y, z, vx, vy, vz] = m.p;
  const pr = S.projs.get(id) || addProj(id, kind, x, y, z, vx, vy, vz);
  pr.vx = vx; pr.vy = vy; pr.vz = vz;
}
function addProj(id, kind, x, y, z, vx, vy, vz) {
  let mesh;
  if (kind === 'rock') {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color: 0x6e7076 }));
  } else if (kind === 'rocket') {
    mesh = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x56663a })); mesh.add(b);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), new THREE.MeshLambertMaterial({ color: 0xd23b2a })); t.position.z = -0.3; mesh.add(t);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLASH, transparent: true })); f.scale.setScalar(0.35); f.position.z = 0.3; mesh.add(f);
  } else mesh = makeGun('nade', 0.03);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  const pr = { id, kind, mesh, buf: [{ t: serverNow(), x, y, z }], vx, vy, vz, born: performance.now() };
  S.projs.set(id, pr);
  return pr;
}
function removeProj(id) { const p = S.projs.get(id); if (!p) return; scene.remove(p.mesh); S.projs.delete(id); }
function updateProjs(dt) {
  const rt = serverNow() - 60;
  for (const pr of S.projs.values()) {
    const b = pr.buf; let p;
    if (b.length >= 2 && rt >= b[0].t) {
      p = sampleBuf(b.map(o => Object.assign({ fl: 1, yaw: 0, pitch: 0 }, o)), rt);
      const last = b[b.length - 1];
      if (rt > last.t && pr.kind === 'rocket') { const k = (rt - last.t) / 1000; p = { x: last.x + pr.vx * k, y: last.y + pr.vy * k, z: last.z + pr.vz * k }; }
    } else { const k = (performance.now() - pr.born) / 1000; p = { x: b[0].x + pr.vx * k, y: b[0].y + pr.vy * k - (pr.kind === 'nade' ? 10 * k * k : 0), z: b[0].z + pr.vz * k }; }
    const prev = pr.mesh.position.clone();
    pr.mesh.position.set(p.x, p.y, p.z);
    if (pr.kind === 'rocket') {
      _v.set(p.x, p.y, p.z).sub(prev);
      if (_v.lengthSq() > 1e-6) pr.mesh.lookAt(_v.add(pr.mesh.position));
      pr.trail = (pr.trail || 0) + dt;
      if (pr.trail > 0.02) { pr.trail = 0; smoke(prev.x, prev.y, prev.z, 0.35, 0.6, 0xdddddd); }
    } else { pr.mesh.rotation.x += dt * 8; pr.mesh.rotation.z += dt * 5; }
  }
}

/* ================= 뷰모델 ================= */
function updateViewModel(dt) {
  if (S.kc && S.kc.active) {
    vm.holder.visible = true; $('scope').classList.remove('on');
    const k = S.kc.kick; S.kc.kick *= Math.pow(0.0005, dt);
    const knife = vm.id === 'knife';
    vm.holder.position.set(0.2, knife ? -0.2 : -0.2, (knife ? -0.36 : -0.62) + k * 0.06); vm.holder.rotation.set(k * 0.12, 0.05, 0);
    vm.flashT -= dt; if (vm.flash) vm.flash.visible = vm.flashT > 0;
    viewCam.fov = 70; viewCam.updateProjectionMatrix();
    return;
  }
  const W = WEAPONS[WS.cur];
  const scoped = W && W.scope && WS.ads > 0.85;
  vm.holder.visible = me.alive && !scoped;
  $('scope').classList.toggle('on', !!(me.alive && scoped));
  if (!vm.gun) return;
  const def = GUNS[WS.cur] || GUNS.pistol;
  const topY = (Math.max(...def.boxes.filter(b => b[5] < def.grip[2] + 20).map(b => b[4])) - def.grip[1]) * VMS;
  const hip = WS.cur === 'knife' || WS.cur === 'claw' ? [0.2, -0.2, -0.36] : WS.cur === 'nade' ? [0.2, -0.18, -0.34] : [0.2, -0.2, -0.62];
  const adsP = [0, -topY - 0.012, -0.36];
  const a = WS.ads;
  let x = lerp(hip[0], adsP[0], a), y = lerp(hip[1], adsP[1], a), z = lerp(hip[2], adsP[2], a);
  let rx = 0, ry = 0.05 * (1 - a), rz = 0;
  // 흔들림
  const hs = Math.hypot(me.vx, me.vz), bobA = me.ground ? Math.min(1, hs / 7) * (1 - a * 0.85) : 0;
  x += Math.sin(WS.bob) * 0.012 * bobA; y += -Math.abs(Math.cos(WS.bob)) * 0.014 * bobA;
  WS.swayX = (WS.swayX || 0) * Math.pow(0.001, dt); WS.swayY = (WS.swayY || 0) * Math.pow(0.001, dt);
  x -= clamp(WS.swayX, -0.05, 0.05) * (1 - a * 0.8); y += clamp(WS.swayY, -0.05, 0.05) * (1 - a * 0.8);
  // 달리기 자세
  WS.sprintK = lerp(WS.sprintK || 0, isSprinting() && me.ground && !WS.reloading && performance.now() - WS.lastFire > 300 ? 1 : 0, Math.min(1, dt * 10));
  rx += -0.35 * WS.sprintK; ry += 0.7 * WS.sprintK; y -= 0.05 * WS.sprintK;
  // 반동
  z += WS.kick * 0.06; rx += WS.kick * 0.12 * (1 - a * 0.6);
  // 재장전
  if (WS.reloading) {
    const W2 = WEAPONS[WS.cur];
    const k = W2.shell ? 0.6 : Math.sin(Math.PI * clamp(1 - WS.reloadT / WS.reloadDur, 0, 1));
    rx += -0.55 * k; rz += 0.4 * k; y -= 0.08 * k;
  }
  // 교체
  y -= WS.switchT * 0.6; rx -= WS.switchT * 1.2;
  // 칼 휘두르기
  if (WS.slashT > 0) { const k = Math.sin((1 - WS.slashT / 0.3) * Math.PI); ry += k * 0.9; rx += -k * 0.3; x -= k * 0.15; z -= k * 0.1; }
  if (WS.cur === 'knife') { ry += 0.15; rz += -0.2; rx += 0.2; }
  if (WS.cur === 'claw') { rx += 0.5; y += 0.04; }
  if (me.sliding) rz += 0.25;
  vm.holder.position.set(x, y, z); vm.holder.rotation.set(rx, ry, rz);
  // 머즐 플래시
  vm.flashT -= dt;
  if (vm.flash) { vm.flash.visible = vm.flashT > 0 && !W.proj; vm.flash.material.rotation = Math.random() * 6; }
  if (vm.gun.userData.spin && !(W && W.spin)) vm.gun.userData.spin.rotation.z += dt * 2;
  viewCam.fov = 70 / lerp(1, 1 + (((W && W.zoom) || 1) - 1) * 0.15, a);
  viewCam.updateProjectionMatrix();
}

/* ================= 카메라 ================= */
function updateCamera(dt) {
  S.shake = Math.max(0, (S.shake || 0) - dt * 2.5);
  const sh = S.shake * 0.05;
  const kcE = S.kc && S.kc.active && S.ents.get(S.kc.killer);
  const kcS = kcE && sampleBuf(kcE.buf, kcTime());
  if (selfEmoteActive()) {
    updateSelfEmoteCam(dt);
  } else if (kcS) {
    camera.position.set(kcS.x, kcS.y + ((kcS.fl & 2) ? P.EYEC : P.EYE), kcS.z);
    camera.rotation.set(kcS.pitch, kcS.yaw, 0);
    camera.fov = CFG.fov;
    if (kcS.w && kcS.w !== S.kc.vw) { S.kc.vw = kcS.w; setViewModel(kcS.w, { ci: kcE.color, skin: kcE.skin, gskin: kcE.gskin }); }
    $('kcInfo').textContent = `남은 체력 ${kcS.hp || 0}`;
  } else if (me.alive) {
    camera.position.set(me.x + (Math.random() - 0.5) * sh, me.y + me.eye + me.camOff + (Math.random() - 0.5) * sh, me.z + (Math.random() - 0.5) * sh);
    const W = WEAPONS[WS.cur];
    const roll = me.sliding ? 0.06 : 0;
    camera.rotation.set(me.pitch + WS.recoil, me.yaw, roll);
    const zoom = lerp(1, (W && W.zoom) || 1, WS.ads);
    camera.fov = CFG.fov / zoom * (isSprinting() && me.ground ? 1.06 : 1);
  } else if ((S.mode === 'spike' || S.mode === 'br') && S.deathPos && (S.deathT || 0) > 2.5 && (!S.kc || S.kc.done || !S.kc.active) && specTarget()) {
    const e = specTarget();
    S.deathT += dt;
    camera.position.set(e.rx + Math.sin(e.ryaw) * 3, e.ry + 2.3, e.rz + Math.cos(e.ryaw) * 3);
    camera.lookAt(e.rx - Math.sin(e.ryaw) * 4, e.ry + 1.3, e.rz - Math.cos(e.ryaw) * 4);
    camera.fov = CFG.fov;
  } else if (S.deathPos) {
    S.deathT = (S.deathT || 0) + dt;
    const dp = S.deathPos, k = Math.min(1, S.deathT * 1.5);
    const tgt = S.killer && S.ents.get(S.killer);
    camera.position.set(dp.x + Math.sin(dp.yaw) * 2.5 * k, dp.y + 0.5 + 2.2 * k, dp.z + Math.cos(dp.yaw) * 2.5 * k);
    if (tgt && tgt.alive) camera.lookAt(tgt.rx, tgt.ry + 1.2, tgt.rz); else camera.lookAt(dp.x, dp.y + 0.5, dp.z);
    camera.fov = CFG.fov;
  } else {
    // 첫 스폰 전 하늘 뷰
    const t = performance.now() / 8000;
    if (S.map) { camera.position.set(S.map.W / 2 + Math.cos(t) * 30, 26, S.map.D / 2 + Math.sin(t) * 30); camera.lookAt(S.map.W / 2, 4, S.map.D / 2); }
    camera.fov = CFG.fov;
  }
  camera.updateProjectionMatrix();
  if (S.sky) { S.sky.position.set(camera.position.x, 0, camera.position.z); S.sky.userData.clouds.position.x = (performance.now() / 1000 * 1.5) % 250; }
}

/* ================= HUD ================= */
let hudT = 0;
function hitMarker(kind) {
  const h = $('hitmark'); h.className = kind || ''; h.style.opacity = 1;
  clearTimeout(h.t); h.t = setTimeout(() => h.style.opacity = 0, kind === 'kill' ? 350 : 140);
}
function updateHud(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.05;
  $('clickToPlay').classList.toggle('hidden', S.locked || S.touch || !!S.modal || !$('result').classList.contains('hidden') || document.activeElement === $('chatIn'));
  const now = serverNow();
  const left = Math.max(0, S.endAt - now) / 1000;
  $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('timer').style.color = left < 30 ? '#ff6a5a' : '';
  const top = [...S.roster.values()].sort((a, b) => b.k - a.k)[0];
  const mine = S.roster.get(S.myId);
  if (S.mode === 'spike') spikeHud(now);
  if (S.mode === 'practice' && S.pst) $('practiceHud').innerHTML = practiceHudText();
  if (isTeamMode()) {
    $('timerT').textContent = $('timer').textContent; $('timerT').style.color = $('timer').style.color;
    $('scoreR').textContent = S.score[0]; $('scoreB').textContent = S.score[1];
    document.querySelector('#teamBar .red').classList.toggle('mine', myTeam() === 0); document.querySelector('#teamBar .blue').classList.toggle('mine', myTeam() === 1);
    $('leader').textContent = `${SH.MODES[S.mode].name} · 목표 ${S.target}${S.mode === 'ctf' ? '점' : '킬'} · 나 ${mine ? mine.k : 0}킬${myTeam() >= 0 ? ' · ' + TEAMS[myTeam()].name + ' 팀' : ''}`;
  } else $('leader').textContent = top ? `1위 ${top.name} ${top.k}킬 · 나 ${mine ? mine.k : 0}킬 · 목표 ${S.target}` : '';
  modeHud();
  if (S.mode === 'ctf' && S.flags) {
    const ft = (t) => { const f = S.flags[t]; if (f[4]) return '기지'; if (f[3]) return f[3] === S.myId ? '내가 운반 중!' : `${(S.roster.get(f[3]) || {}).name || '?'} 운반 중`; return '떨어짐'; };
    $('flagStat').innerHTML = [0, 1].map(t => `<span style="color:${TEAMS[t].css}">${TEAMS[t].name} 깃발: ${ft(t)}</span>`).join('');
    const carrying = S.flags.some(f => f[3] === S.myId);
    if (carrying) showBig('깃발을 우리 기지로 가져가세요!', '#f4c22b', 300);
  }
  $('money').textContent = '$' + me.money;
  $('hpNum').textContent = Math.max(0, Math.ceil(me.hp)); $('hpBar').style.width = clamp(me.hp / me.maxHp * 100, 0, 100) + '%';
  const pk = (me.helmet ? 'helmet,' : '') + me.perks.join(',');
  if ($('perkBar').dataset.k !== pk) { $('perkBar').dataset.k = pk; $('perkBar').innerHTML = pk.split(',').filter(Boolean).map(id => `<img src="${itemIcon(id, 2)}" title="${ITEMS[id].name}">`).join(''); }
  const sk = JSON.stringify(me.sup) + (serverNow() < (S.uavUntil || 0) ? Math.ceil((S.uavUntil - serverNow()) / 1000) : '');
  if ($('supBar').dataset.k !== sk) {
    $('supBar').dataset.k = sk;
    $('supBar').innerHTML = (me.sup.turret ? `<span><b>Z</b><img src="${gunIcon('turret', 1)}">포탑</span>` : '') + (me.sup.air ? `<span><b>X</b><img src="${gunIcon('air', 1)}">공습</span>` : '')
      + (serverNow() < (S.uavUntil || 0) ? `<span style="border-color:#5fe37a">레이더 ${Math.ceil((S.uavUntil - serverNow()) / 1000)}초</span>` : '');
  }
  $('arNum').textContent = Math.ceil(me.armor); $('arBar').style.width = clamp(me.armor, 0, 100) + '%';
  const W = WEAPONS[WS.cur];
  $('wName').textContent = WS.cur === 'nade' ? '수류탄' : W ? W.name : '';
  const iconSrc = gunIcon(WS.cur, 2);
  if ($('wIcon').getAttribute('src') !== iconSrc) $('wIcon').src = iconSrc;
  const a = ammo[WS.cur];
  if (W && W.mag && a) { $('mag').textContent = a.mag; $('res').textContent = a.res; $('ammo').classList.toggle('low', a.mag <= Math.ceil(W.mag * 0.25)); $('ammo').style.visibility = ''; }
  else if (WS.cur === 'nade') { $('mag').textContent = me.nades; $('res').textContent = '-'; $('ammo').style.visibility = ''; }
  else $('ammo').style.visibility = 'hidden';
  // 슬롯
  const sl = [[1, me.primary], [2, me.secondary], [3, 'knife'], [4, me.nades > 0 ? 'nade' : null]];
  const key = sl.map(s => s[1]).join() + WS.cur + me.nades;
  if ($('slots').dataset.k !== key) {
    $('slots').dataset.k = key;
    $('slots').innerHTML = sl.filter(s => s[1]).map(([n, w]) => `<div class="slot ${w === WS.cur ? 'on' : ''}">${n} <img src="${gunIcon(w, 1)}">${w === 'nade' ? 'x' + me.nades : ''}</div>`).join('');
  }
  // 구매
  const bl = (me.buyUntil - now) / 1000;
  const atShop = me.alive && nearShop();
  $('buyHint').textContent = S.mode === 'practice' ? 'B: 상점 (모든 총 무료)' : me.alive && bl > 0 ? `B: 상점 (${Math.ceil(bl)}초)` : deadBuyOk() ? 'B: 상점 (부활 전 미리 구매)' : '';
  if (S.modal === 'buy') { $('buyTime').textContent = deadBuyOk() ? '부활 전 구매' : bl > 0 ? `${Math.ceil(bl)}초 남음` : ''; $('buyMoney').textContent = '$' + me.money; if (bl <= 0 && !atShop && S.mode !== 'practice' && !deadBuyOk()) closeModals(); }
  // 줍기
  const nd = S.nearDrop;
  $('hint').classList.toggle('on', !!(nd && me.alive));
  if (nd) $('hint').textContent = `E: ${WEAPONS[nd.w].name} 줍기`;
  const nc = me.alive && nearCrate(); if (nc) { $('hint').classList.add('on'); $('hint').textContent = 'E: 보급상자 열기'; }
  // 사망
  const kcOn = !!(S.kc && S.kc.active);
  $('killcam').classList.toggle('hidden', !kcOn);
  if (kcOn) $('death').classList.add('hidden');
  if (!me.alive && S.dead) $('deathTimer').textContent = me.respawnAt > now ? `${Math.ceil((me.respawnAt - now) / 1000)}초 후 부활` : '부활 중…';
  // 조준선
  // 이동 오차 / 사격 오차 (픽셀) — 설정에서 켠 선만 벌어져요
  const pxRad = window.innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
  const moveErr = W ? Math.hypot(me.vx, me.vz) / P.RUN * (W.mspread || 0) * pxRad : 0;
  const fireErr = W ? (WS.bloom + (me.ground ? 0 : 0.05)) * pxRad : 0;
  const c = $('cross');
  // 스코프는 스코프 십자선 사용
  const scopedNow = !!(W && W.scope && WS.ads > 0.5);
  c.style.display = me.alive && !scopedNow ? '' : 'none';
  if (me.alive && !scopedNow) drawCross(c, crossCfg, { move: Math.min(moveErr, 60), fire: Math.min(fireErr, 60) });
}

/* ================= 네트워크 송신 ================= */
let sendT = 0;
function netSend(dt) {
  sendT -= dt; if (sendT > 0) return; sendT = 0.05;
  if (!S.inGame || !me.alive) return;
  const fl = 1 | (me.crouch ? 2 : 0) | (me.sliding ? 4 : 0) | (WS.reloading ? 8 : 0) | (WS.ads > 0.5 ? 32 : 0) | (me.ground ? 0 : 64) | (performance.now() - WS.lastFire < 300 ? 128 : 0);
  send({ t: 'st', x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), fl, w: WS.cur });
  S.selfBuf.push({ t: serverNow(), x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: me.pitch, fl, w: WS.cur });
  if (S.selfBuf.length > 140) S.selfBuf.shift();
}

/* ================= 깃발 ================= */
function flagIconTex(t) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  const col = TEAMS[t].css;
  x.fillStyle = '#0b0c0e'; x.fillRect(3, 1, 3, 15); x.fillRect(5, 1, 10, 9);
  x.fillStyle = '#e8e8e8'; x.fillRect(4, 2, 1, 13);
  x.fillStyle = col; x.fillRect(6, 2, 8, 7);
  x.fillStyle = '#ffffff'; x.fillRect(9, 4, 2, 3);
  const tx = new THREE.CanvasTexture(c); tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
function setupFlags() {
  for (const o of S.flagObjs) { scene.remove(o.grp); scene.remove(o.pad); }
  S.flagObjs = []; S.flags = null;
  if (S.mode !== 'ctf' || !S.map.bases) return;
  for (let t = 0; t < 2; t++) {
    const col = TEAMS[t].color, grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.1, 0.07).translate(0, 1.05, 0), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.48, 0.05).translate(0.4, 0, 0), new THREE.MeshLambertMaterial({ color: col }));
    cloth.position.y = 1.8;
    const emb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.07).translate(0.42, 0, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cloth.add(emb);
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: flagIconTex(t), depthTest: false, transparent: true }));
    mk.scale.set(0.7, 0.7, 1); mk.position.y = 2.9; mk.renderOrder = 10;
    grp.add(pole, cloth, mk); scene.add(grp);
    const b = S.map.bases[t];
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 2), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.75 }));
    pad.position.set(b[0], b[1] + 0.03, b[2]); scene.add(pad);
    grp.position.set(b[0], b[1], b[2]);
    S.flagObjs.push({ grp, cloth, pad, mk, t });
  }
}
function updateFlags() {
  if (!S.flags || !S.flagObjs.length) return;
  const tm = performance.now() / 1000;
  S.flags.forEach((f, t) => {
    const o = S.flagObjs[t]; if (!o) return;
    let x = f[0], y = f[1], z = f[2], sc = 1, ry = 0;
    if (f[3]) {
      if (f[3] === S.myId && !(S.kc && S.kc.active)) { o.grp.visible = false; return; }
      const e = S.ents.get(f[3]);
      if (e && e.alive) { ry = e.ryaw; x = e.rx + Math.sin(ry) * 0.3; y = e.ry + 0.7; z = e.rz + Math.cos(ry) * 0.3; sc = 0.75; }
    }
    o.grp.visible = true; o.grp.position.set(x, y, z); o.grp.scale.setScalar(sc); o.grp.rotation.y = ry;
    o.cloth.rotation.y = Math.sin(tm * 3 + t) * 0.25;
    o.mk.position.y = 2.9 + Math.sin(tm * 2 + t) * 0.1;
  });
}
let bigT = null;
function showBig(text, color, ms) {
  const el = $('bigMsg'); el.textContent = text; el.style.color = color || '#fff'; el.classList.add('on');
  clearTimeout(bigT); bigT = setTimeout(() => el.classList.remove('on'), ms || 2500);
}
function onFlag(m) {
  const who = m.id ? (S.roster.get(m.id) || {}).name || '?' : '';
  const tn = TEAMS[m.team].name, actor = (m.ev === 'take' || m.ev === 'cap') ? 1 - m.team : m.team;
  const txt = {
    take: `${who} 님이 ${tn} 깃발을 탈취!`, drop: `${tn} 깃발이 떨어졌어요`,
    return: who ? `${who} 님이 ${tn} 깃발을 되찾았어요` : `${tn} 깃발이 기지로 돌아갔어요`,
    cap: `${who} 님 득점! (${TEAMS[actor].name} +1)`,
  }[m.ev];
  if (!txt) return;
  showBig(txt, TEAMS[actor].css, 2600);
  addChat(`<span style="color:${TEAMS[actor].css}">${esc(txt)}</span>`);
  if (m.ev === 'cap') { A.sfxStreak(); if (m.id === S.myId) { S.myCaps++; track('cap'); } }
  else if (m.ev === 'take') A.sfxKill(); else A.sfxPick();
}

/* ================= 상점 자판기 ================= */
function labelSprite(text, color, depth) {
  const ts = textSprite(text, color);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ts.tex, depthTest: depth !== false, transparent: true }));
  sp.scale.set(ts.w / 40, ts.h / 40, 1); if (depth === false) sp.renderOrder = 8;
  return sp;
}
function setupShops() {
  for (const o of S.shopObjs) scene.remove(o);
  S.shopObjs = [];
  for (const p of S.map.shops || []) {
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); g.add(m); return m; };
    box(0.95, 1.9, 0.75, 0, 0.95, 0, 0xc0302a);
    box(0.62, 1.1, 0.06, -0.1, 1.15, -0.39, 0x9fd8ff);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box(0.12, 0.14, 0.04, -0.3 + c * 0.2, 0.8 + r * 0.33, -0.42, [0xf4c22b, 0x4cbf4c, 0x3d8bf0][(r + c) % 3]);
    box(0.18, 0.5, 0.06, 0.34, 1.2, -0.39, 0x2b2f36);
    box(0.5, 0.18, 0.06, -0.1, 0.35, -0.39, 0x17191c);
    const top = box(0.97, 0.22, 0.77, 0, 2.0, 0, 0xffe08a);
    top.material = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    const lbl = labelSprite('$ 상점', '#7df07d', false); lbl.position.y = 2.6; g.add(lbl);
    g.position.set(p[0], p[1], p[2]);
    g.rotation.y = Math.atan2(-(S.map.W / 2 - p[0]), -(S.map.D / 2 - p[2])); // 앞면(-z)이 맵 가운데를 보게
    g.userData.lbl = lbl;
    scene.add(g); S.shopObjs.push(g);
  }
}
function updateShops() {
  for (const g of S.shopObjs) {
    const d = Math.hypot(g.position.x - camera.position.x, g.position.z - camera.position.z);
    g.userData.lbl.visible = d < 45;
    g.userData.lbl.position.y = 2.6 + Math.sin(performance.now() / 400) * 0.06;
  }
}

/* ================= 포탑 ================= */
function makeTurretModel(team, own) {
  const g = new THREE.Group();
  const legM = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07).translate(0, -0.45, 0), legM);
    l.position.y = 0.85; l.rotation.set(0.45, (i / 3) * Math.PI * 2, 0, 'YXZ'); g.add(l);
  }
  const col = team >= 0 ? TEAMS[team].color : own ? 0x4cbf4c : 0xe2483a;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45), new THREE.MeshLambertMaterial({ color: col })); plate.position.y = 0.88; g.add(plate);
  const yawG = new THREE.Group(); yawG.position.y = 0.95; g.add(yawG);
  const head = makeGun('turret', 0.04); yawG.add(head);
  g.userData = { yawG, head };
  return g;
}
function turretMuzzle(tu) {
  const h = tu.mesh.userData.head; tu.mesh.updateMatrixWorld(true);
  return h.localToWorld(h.userData.muzzle.clone());
}
function syncTurrets(list) {
  const seen = new Set();
  for (const [id, x, y, z, yaw, team, owner, hp] of list) {
    seen.add(id);
    let tu = S.turrets.get(id);
    if (!tu) {
      const own = owner === S.myId;
      const mesh = makeTurretModel(isTeamMode() ? team : -1, own);
      const oname = (S.roster.get(owner) || {}).name || '?';
      const lbl = labelSprite(own ? '내 포탑' : `${oname}의 포탑`, own || isMate(owner) ? '#7df07d' : '#ff6a5a'); lbl.position.y = 1.75; mesh.add(lbl);
      scene.add(mesh);
      tu = { id, mesh, owner, team, x, y, z, yaw, tyaw: yaw, hp, kick: 0 };
      S.turrets.set(id, tu);
    }
    Object.assign(tu, { x, y, z, tyaw: yaw, hp });
  }
  for (const id of [...S.turrets.keys()]) if (!seen.has(id)) removeTurret(id);
}
function removeTurret(id) { const tu = S.turrets.get(id); if (!tu) return; scene.remove(tu.mesh); S.turrets.delete(id); }
function updateTurrets(dt) {
  for (const tu of S.turrets.values()) {
    tu.yaw = angLerp(tu.yaw, tu.tyaw, Math.min(1, dt * 12));
    tu.kick *= Math.pow(0.001, dt);
    tu.mesh.position.set(tu.x, tu.y, tu.z);
    tu.mesh.userData.yawG.rotation.y = tu.yaw;
    tu.mesh.userData.head.position.z = tu.kick * 0.05;
  }
}
function onTurretGone(m) {
  removeTurret(m.id);
  if (m.boom) {
    const p = new THREE.Vector3(m.x, m.y + 0.8, m.z);
    flashAt(p, 2.5);
    for (let i = 0; i < 24; i++) spawnParticle(p.x, p.y, p.z, (Math.random() - 0.5) * 7, Math.random() * 6, (Math.random() - 0.5) * 7, [0xffd040, 0xff8a20, 0x3a3f46][i % 3], 0.8, 0.1, 12);
    for (let i = 0; i < 4; i++) smoke(p.x, p.y, p.z, 0.8, 1.2, 0x777777);
    const d = Math.hypot(m.x - me.x, m.z - me.z); A.sfxBoom(clamp(0.8 - d / 70, 0.05, 0.8), 0);
  }
}
function deployTurret() {
  if (!me.sup.turret) { toast('포탑이 없어요 (상점 > 지원에서 구매)'); A.sfxDeny(); return; }
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  send({ t: 'deploy', x: me.x + fx * 1.2, z: me.z + fz * 1.2, yaw: me.yaw });
  A.sfxReload(1);
}

/* ================= 공습 / 레이더 ================= */
function callAirstrike() {
  if (!me.sup.air) { toast('공습이 없어요 (상점 > 지원에서 구매)'); A.sfxDeny(); return; }
  const eye = eyePos(), fwd = camForward(new THREE.Vector3());
  const h = SH.raycast(S.map, eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, 150);
  if (!h) { toast('땅이나 벽을 조준하세요'); return; }
  send({ t: 'strike', x: eye.x + fwd.x * h.t, z: eye.z + fwd.z * h.t });
}
function onStrike(m) {
  const mine = m.by === S.myId || isMate(m.by);
  showBig(mine ? '공습 요청! 표시된 곳에서 떨어지세요' : '적 공습 경보!', mine ? '#f4c22b' : '#ff6a5a', 2500);
  A.sfxSiren(); setTimeout(() => A.sfxSiren(), 1200);
  const plane = makeGun('air', 0.12);
  scene.add(plane);
  S.strikesFx.push({ x: m.x, z: m.z, dx: m.dx, dz: m.dz, at: m.at, plane, smokeT: 0, played: false });
}
function updateStrikes(dt) {
  const now = serverNow();
  for (let i = S.strikesFx.length - 1; i >= 0; i--) {
    const s = S.strikesFx[i];
    const tc = s.at + 550, k = (now - tc) / 1000; // 가운데 지나는 시각
    if (now < s.at) {
      s.smokeT -= dt;
      if (s.smokeT <= 0) { s.smokeT = 0.08; const gy = S.map ? groundTop(s.x, s.z) : 4; smoke(s.x + (Math.random() - 0.5) * 0.3, gy + 0.2, s.z + (Math.random() - 0.5) * 0.3, 0.5, 1.6, 0xff4030); }
    }
    s.plane.position.set(s.x + s.dx * k * 45, 34, s.z + s.dz * k * 45);
    s.plane.lookAt(s.plane.position.x + s.dx, 34, s.plane.position.z + s.dz);
    s.plane.visible = Math.abs(k) < 3;
    if (!s.played && k > -2) { s.played = true; A.sfxPlane(1); }
    if (k > 3.5) { scene.remove(s.plane); S.strikesFx.splice(i, 1); }
  }
}
function groundTop(x, z) { let y = S.map.H - 1; while (y > 0 && !S.map.solid(Math.floor(x), y, Math.floor(z))) y--; return y + 1; }
function onUav(m) {
  const forMe = isTeamMode() ? m.team === myTeam() : m.by === S.myId;
  if (!forMe) { if (!isTeamMode() || m.team !== myTeam()) showBig('적이 레이더를 켰어요!', '#ff6a5a', 1800); return; }
  S.uavUntil = Math.max(S.uavUntil || 0, m.until);
  showBig('레이더 작동! 20초간 적 위치 표시', '#5fe37a', 2200); A.sfxPick();
}
const UAV_TEX = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d');
  const rows = ['...XX...', '..XRRX..', '.XRRRRX.', 'XRRRRRRX', '.XRRRRX.', '..XRRX..', '...XX...'];
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch !== '.') { x.fillStyle = ch === 'X' ? '#200' : '#ff3a2a'; x.fillRect(xx, yy, 1, 1); } }));
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
})();

/* ================= 골드 / 연속킬 축하 ================= */
let goldT = null, celT = null;
function goldPop(n) {
  const el = $('goldPop'); el.textContent = `+${n} 골드`; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(goldT); goldT = setTimeout(() => el.classList.remove('on'), 1600);
  updateProfileUI();
}
const MULTI_NAMES = { 2: '더블 킬!', 3: '트리플 킬!', 4: '쿼드라 킬!', 5: '펜타 킬!!' };
const STREAK_NAMES = { 5: '학살 중!', 7: '막을 수 없다!', 10: '전설의 등장!', 15: '신이 강림했다!', 20: '불멸의 존재!' };
function celebrate(main, sub, tier) {
  const el = $('celebrate');
  el.className = ''; void el.offsetWidth; el.className = 'on ' + (tier || '');
  $('celMain').textContent = main; $('celSub').textContent = sub || '';
  A.sfxFanfare();
  clearTimeout(celT); celT = setTimeout(() => { el.className = ''; }, 2200);
}
// 내 처치 → 골드 + 연출
function onMyKill(m) {
  const multi = m.multi || 1, streak = m.streak || 1;
  if (S.mode !== 'practice') {
    let g = 1 + (m.hs ? 1 : 0) + ({ 2: 1, 3: 2, 4: 3 }[multi] || 0) + (multi >= 5 ? 10 : 0) + (streak === 5 ? 3 : streak === 10 ? 10 : 0);
    addGold(g); goldPop(g);
  }
  if (multi >= 5) celebrate(multi >= 6 ? '레전더리!!' : '펜타 킬!!', multi >= 6 ? `${multi}연속 멀티킬 · +10 골드` : '5연속 멀티킬 · +10 골드', 't-penta');
  else if (STREAK_NAMES[streak]) celebrate(STREAK_NAMES[streak], `${streak}연속 처치${streak === 5 ? ' · +3 골드' : streak === 10 ? ' · +10 골드' : ''}`, streak >= 10 ? 't-god' : '');
  else if (multi >= 2) {
    const s = $('streak'); s.className = 't' + multi; s.textContent = MULTI_NAMES[multi]; void s.offsetWidth; s.classList.add('on');
    A.sfxStreak(); clearTimeout(s.t); s.t = setTimeout(() => s.classList.remove('on'), 2000);
  }
}
// 다른 사람의 대단한 처치 → 모두에게 알림
function onOtherKill(m, kn) {
  if ((m.multi || 0) >= 5) showBig(`${kn} 님의 펜타 킬!!`, '#ff6af0', 2600);
  else if ((m.streak || 0) >= 7 && STREAK_NAMES[m.streak]) showBig(`${kn}: ${STREAK_NAMES[m.streak]}`, '#ffd84a', 2400);
}

/* ================= 모드: 좀비 / 건게임 / 배틀로얄 / 보스 ================= */
function teamName(t) {
  if (S.mode === 'zombie') return t ? '좀비' : '인간';
  if (S.mode === 'boss') return t ? '보스' : '플레이어';
  return TEAMS[t] ? TEAMS[t].name : '';
}
const meleeId = () => (me.zombie ? 'claw' : 'knife');
function onZb(m) {
  if (m.ev === 'prep') showBig('20초 뒤 누군가 좀비로 변해요! 무기를 사고 숨으세요', '#9be06a', 3500);
  else if (m.ev === 'start') {
    const names = (m.ids || []).map(id => (S.roster.get(id) || {}).name || '?').join(', ');
    if ((m.ids || []).includes(S.myId)) { showBig('당신이 숙주 좀비입니다! 인간을 감염시키세요', '#6aa84f', 3500); }
    else showBig(`감염 시작! 숙주: ${names}`, '#6aa84f', 3000);
    A.sfxSiren(); S.shake = 0.6;
  } else if (m.ev === 'last') {
    showBig(m.id === S.myId ? '당신이 마지막 생존자! 끝까지 버티세요' : `마지막 생존자: ${(S.roster.get(m.id) || {}).name || '?'}`, '#ffd84a', 3500);
    A.sfxStreak();
  }
}
function onGG(m) {
  if (m.id !== S.myId) return;
  const W = WEAPONS[m.w];
  showBig(`레벨 ${m.lv + 1} → ${W ? W.name : m.w}${m.w === 'knife' ? ' (마지막! 칼로 처치하면 승리)' : ''}`, '#ffd84a', 1800);
  A.sfxBuy();
}
function zbHud() {
  const z = S.zbs; if (!z) return '';
  const left = Math.max(0, (z[1] - serverNow()) / 1000);
  return z[0] ? `생존자 ${z[2]}명 · 좀비 ${z[3]}명${me.zombie ? ' · 인간을 감염시키세요!' : ' · 끝까지 버티면 승리'}` : `감염까지 ${Math.ceil(left)}초 · B로 무기 구매`;
}
function ggHud() {
  const L = SH.GG_LADDER, lv = Math.min(me.gg || 0, L.length - 1);
  const top = [...S.roster.values()].sort((a, b) => (b.gg || 0) - (a.gg || 0))[0];
  return `레벨 ${lv + 1}/${L.length} · ${WEAPONS[L[lv]].name}${lv < L.length - 1 ? ' → ' + WEAPONS[L[lv + 1]].name : ' (칼로 처치하면 승리!)'}${top && top.id !== S.myId ? ` · 1위 ${top.name} Lv${(top.gg || 0) + 1}` : ''}`;
}
// 배틀로얄 자기장
let zoneObj = null;
function setupZone() {
  if (zoneObj) { scene.remove(zoneObj.wall); scene.remove(zoneObj.ring); zoneObj = null; }
  if (S.mode !== 'br') return;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 70, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x9a4aff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  scene.add(wall); scene.add(ring);
  zoneObj = { wall, ring };
}
function updateZone() {
  if (!zoneObj || !S.zone) return;
  const [cx, cz, r, tx, tz, tr] = S.zone;
  zoneObj.wall.position.set(cx, 30, cz); zoneObj.wall.scale.set(Math.max(0.1, r), 1, Math.max(0.1, r));
  zoneObj.ring.position.set(tx, SH.G + 0.06, tz); zoneObj.ring.scale.setScalar(Math.max(0.1, tr)); zoneObj.ring.visible = tr < r - 0.5;
}
function brHud() {
  const z = S.zone; if (!z) return '';
  const [cx, cz, r, , , , at, phase, alive] = z;
  const left = Math.max(0, (at - serverNow()) / 1000);
  const out = me.alive && Math.hypot(me.x - cx, me.z - cz) > r;
  $('zoneWarn').classList.toggle('on', out);
  if (out) { const ang = Math.atan2(-(cx - me.x), -(cz - me.z)) - me.yaw; const deg = ((-ang * 180 / Math.PI) % 360 + 360) % 360; $('zoneWarn').textContent = `자기장 밖! 안으로 이동하세요 ${deg < 45 || deg > 315 ? '↑' : deg < 135 ? '→' : deg < 225 ? '↓' : '←'}`; }
  return `생존자 ${alive}명 · ${phase === 'shrink' ? '자기장 축소 중!' : phase === 'final' ? '마지막 자기장' : `자기장 축소까지 ${Math.ceil(left)}초`}`;
}
// 보스
function makeBossModel() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const stone = new THREE.MeshLambertMaterial({ color: 0x7a7d82 }), dark = new THREE.MeshLambertMaterial({ color: 0x55585e }), moss = new THREE.MeshLambertMaterial({ color: 0x4f7a2e });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff8a20 });
  const box = (p, w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); p.add(m); return m; };
  const leg = (x) => { const g = new THREE.Group(); g.position.set(x, 1.7, 0); box(g, 0.95, 1.7, 0.95, 0, -0.85, 0, stone); box(g, 1.0, 0.3, 1.1, 0, -1.55, -0.05, dark); body.add(g); return g; };
  const legL = leg(-0.6), legR = leg(0.6);
  const torso = new THREE.Group(); torso.position.y = 1.7; body.add(torso);
  box(torso, 2.3, 2.2, 1.4, 0, 1.1, 0, stone); box(torso, 2.32, 0.5, 1.42, 0, 2.0, 0, moss); box(torso, 0.5, 0.9, 0.06, -0.4, 1.2, -0.72, glow); box(torso, 0.3, 0.5, 0.06, 0.5, 0.7, -0.72, glow);
  box(torso, 0.8, 0.6, 0.6, -0.7, 2.35, 0.3, dark); box(torso, 0.6, 0.5, 0.5, 0.8, 2.3, 0.35, dark);
  const head = new THREE.Group(); head.position.y = 2.2; torso.add(head);
  box(head, 1.3, 1.2, 1.2, 0, 0.6, 0, stone); box(head, 1.32, 0.3, 1.22, 0, 1.1, 0, moss);
  const eyeL = box(head, 0.28, 0.2, 0.06, -0.3, 0.65, -0.62, glow), eyeR = box(head, 0.28, 0.2, 0.06, 0.3, 0.65, -0.62, glow);
  const arm = (x) => { const g = new THREE.Group(); g.position.set(x, 2.0, 0); box(g, 0.85, 2.5, 0.85, 0, -1.2, 0, stone); box(g, 1.0, 0.7, 1.0, 0, -2.55, 0, dark); torso.add(g); return g; };
  const armL = arm(-1.6), armR = arm(1.6);
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; root.add(sh);
  root.userData = { body, legL, legR, armL, armR, head, glow, eyes: [eyeL, eyeR], walk: 0, boss: true };
  return root;
}
function animBoss(e, dt, speed, dead) {
  const u = e.model.userData;
  if (dead) { u.deadT = Math.min(1, (u.deadT || 0) + dt * 1.5); u.body.rotation.x = -u.deadT * 1.45; return; }
  u.walk += dt * speed * 1.2;
  const sw = Math.sin(u.walk) * Math.min(1, speed / 3) * 0.6;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  const act = !!(e.fl & 128);
  const ar = act ? -2.6 : -sw * 0.7;
  u.armL.rotation.x = lerp(u.armL.rotation.x, ar, Math.min(1, dt * 8)); u.armR.rotation.x = lerp(u.armR.rotation.x, act ? -2.6 : sw * 0.7, Math.min(1, dt * 8));
  u.glow.color.setHex(e.fl & 256 ? 0xff2a10 : 0xff8a20);
}
function bossHud() {
  const b = [...S.ents.values()].find(e => e.boss);
  const bar = $('bossBar');
  if (!b) { bar.classList.add('hidden'); return; }
  const last = b.buf[b.buf.length - 1], hp = last ? last.hp : 0;
  b.maxSeen = Math.max(b.maxSeen || 1, hp);
  bar.classList.remove('hidden');
  $('bossName').textContent = `거대 골렘${last && last.fl & 256 ? ' · 분노!' : ''}`;
  $('bossFill').style.width = (hp / b.maxSeen * 100) + '%';
  $('bossHpTxt').textContent = `${Math.max(0, Math.ceil(hp))} / ${b.maxSeen}`;
}
const slamRings = [];
function onBoss(m) {
  if (m.act === 'enrage') { showBig('거대 골렘이 분노했어요! 졸개 소환!', '#ff6a5a', 2800); A.sfxSiren(); S.shake = 1; }
  else if (m.act === 'slam') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 6.5, 48), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, SH.G + 0.08, m.z);
    const b = [...S.ents.values()].find(e => e.boss); if (b) ring.position.y = b.ry + 0.08;
    scene.add(ring); slamRings.push({ ring, until: performance.now() + 900 });
  } else if (m.act === 'slamhit') {
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28; spawnParticle(m.x + Math.cos(a) * 1.5, m.y + 0.2, m.z + Math.sin(a) * 1.5, Math.cos(a) * 9, 2 + Math.random() * 3, Math.sin(a) * 9, [0x7a7d82, 0x55585e, 0x8a5a36][i % 3], 0.8, 0.18, 12); }
    const d = Math.hypot(me.x - m.x, me.z - m.z);
    S.shake = Math.max(S.shake || 0, clamp(1.6 - d / 10, 0.2, 1.6)); A.sfxBoom(clamp(1 - d / 50, 0.2, 1), 0);
    if (me.alive && d < m.r) { const k = (1 - d / m.r) * 12 + 4; me.vx += (me.x - m.x) / Math.max(d, 0.5) * k; me.vz += (me.z - m.z) / Math.max(d, 0.5) * k; me.vy = 8; me.ground = false; }
  } else if (m.act === 'charge') { A.sfxSiren(); }
  else if (m.act === 'chargehit' && m.id === S.myId) { me.vx += m.dx * 16; me.vz += m.dz * 16; me.vy = 7; me.ground = false; S.shake = 1.2; }
}
function updateSlamRings() {
  const now = performance.now();
  for (let i = slamRings.length - 1; i >= 0; i--) {
    const s = slamRings[i]; const k = 1 - (s.until - now) / 900;
    s.ring.material.opacity = 0.2 + 0.5 * Math.abs(Math.sin(k * 12));
    if (now > s.until) { scene.remove(s.ring); slamRings.splice(i, 1); }
  }
}
function modeHud() {
  if (S.mode === 'zombie') { $('leader').textContent = zbHud(); $('zombieTint').classList.toggle('on', !!me.zombie && me.alive); }
  else $('zombieTint').classList.remove('on');
  if (S.mode === 'gungame') $('leader').textContent = ggHud();
  if (S.mode === 'br') $('leader').textContent = brHud(); else $('zoneWarn').classList.remove('on');
  if (S.mode === 'boss') { bossHud(); const mine = S.roster.get(S.myId); $('leader').textContent = `거대 골렘을 쓰러뜨리세요! · 나 ${mine ? mine.k : 0}킬`; } else $('bossBar').classList.add('hidden');
}

/* ================= 알림 / 미션·업적 추적 ================= */
function notify(text, color) {
  const box = $('notices'); const d = document.createElement('div');
  d.className = 'notice'; d.style.borderColor = color || '#ffd84a'; d.innerHTML = `<b style="color:${color || '#ffd84a'}">${esc(text)}</b>`;
  box.appendChild(d); while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 4200);
}
const trackOn = () => S.mode !== 'practice';
function noticeDone(done, ach) {
  for (const m of done) notify(`미션 완료! ${m.name} · +${m.coins} 코인 +${m.gold} 골드`, '#7df07d');
  for (const a of ach) notify(`업적 달성! [${a.name}] · +${a.gold} 골드`, '#ffd84a');
  if (done.length || ach.length) { A.sfxStreak(); updateProfileUI(); updateMissionDot(); }
}
function track(type, n) {
  if (!trackOn()) return;
  const map = { plant: 'plants', defuse: 'defuses', crate: 'crates', cap: 'caps', heal: 'heals' };
  if (map[type]) stats[map[type]]++;
  saveProfile();
  noticeDone(missionEvent(type, n), checkAchievements());
}
function trackKill(m) {
  if (!trackOn()) return;
  stats.kills++; if (m.hs) stats.hs++;
  stats.weapons[m.w] = (stats.weapons[m.w] || 0) + 1;
  stats.bestStreak = Math.max(stats.bestStreak, m.streak || 0); stats.multiMax = Math.max(stats.multiMax, m.multi || 0);
  saveProfile();
  const W = WEAPONS[m.w];
  const done = [...missionEvent('kill'), ...(m.hs ? missionEvent('hs') : []), ...((m.multi || 0) >= 2 ? missionEvent('multi') : []), ...(W ? missionEvent('cat:' + W.cat) : [])];
  noticeDone(done, checkAchievements());
}
function trackDeath() { if (!trackOn()) return; stats.deaths++; saveProfile(); }
function trackEnd(mode, win) {
  if (!trackOn()) return;
  stats.games++; if (win) stats.wins++;
  stats.modes[mode] = (stats.modes[mode] || 0) + 1;
  saveProfile();
  noticeDone([...missionEvent('game'), ...(win ? missionEvent('win') : []), ...missionEvent('mode:' + mode)], checkAchievements());
}
function updateMissionDot() {
  const left = dailyMissions().filter(m => !m.done).length;
  $('missionDot').textContent = left ? `(${left})` : '(완료)';
}

/* ================= 내 기록 창 (미션/업적/전적/랭킹) ================= */
let hubTab = 'mission', rankTab = 'kills', rankData = null;
$('hubBtn').onclick = () => { A.initAudio(); hubTab = 'mission'; $('hub').classList.remove('hidden'); renderHub(); };
$('rankBtn').onclick = () => { A.initAudio(); hubTab = 'stats'; $('hub').classList.remove('hidden'); renderHub(); };
$('hubClose').onclick = () => $('hub').classList.add('hidden');
$('hubTabs').querySelectorAll('button').forEach(b => b.onclick = () => { hubTab = b.dataset.tab; renderHub(); });
function medalIcon(on, color) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  const rows = ['..RR....BB..', '...RR..BB...', '....RRBB....', '.....XX.....', '...XGGGGX...', '..XGGLLGGX..', '..XGLGGGGX..', '..XGGGGGGX..', '..XGGGGGGX..', '...XGGGGX...', '....XXXX....'];
  const col = on ? { R: '#e2483a', B: '#3d8bf0', X: '#5a3a00', G: color || '#f4c22b', L: '#fff3a8' } : { R: '#4a4f5a', B: '#3a3f4a', X: '#22252c', G: '#3a3f4a', L: '#4a4f5a' };
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(xx + 2, yy + 2, 1, 1); } }));
  return c.toDataURL();
}
function renderHub() {
  $('hubTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === hubTab));
  const body = $('hubBody');
  if (hubTab === 'mission') {
    const list = dailyMissions();
    body.innerHTML = '<div class="dim" style="margin-bottom:8px">매일 새로운 미션 3개 · 완료하면 바로 보상</div>' + list.map(m => `<div class="mission ${m.done ? 'done' : ''}"><div class="mn">${m.done ? '<b class="okb">완료</b> ' : ''}${esc(m.name)}</div><div class="mbar"><div style="width:${m.prog / m.target * 100}%"></div><span>${m.prog} / ${m.target}</span></div><div class="mr"><i class="coin"></i> ${m.coins} <i class="goldc"></i> ${m.gold}</div></div>`).join('');
  } else if (hubTab === 'ach') {
    const n = ACHIEVEMENTS.filter(a => profile.ach[a.id]).length;
    body.innerHTML = `<div class="dim" style="margin-bottom:8px">${n} / ${ACHIEVEMENTS.length} 달성</div><div class="achgrid">` + ACHIEVEMENTS.map(a => { const on = !!profile.ach[a.id]; return `<div class="ach ${on ? 'on' : ''}"><img src="${medalIcon(on)}"><div><div class="an">${esc(a.name)}</div><div class="ad">${esc(a.desc)}</div><div class="ag"><i class="goldc"></i> ${a.gold}${on ? ' · 달성' : ''}</div></div></div>`; }).join('') + '</div>';
  } else if (hubTab === 'stats') {
    const st = stats, kd = (st.kills / Math.max(1, st.deaths)).toFixed(2), hsr = st.kills ? Math.round(st.hs / st.kills * 100) : 0, wr = st.games ? Math.round(st.wins / st.games * 100) : 0;
    const topW = Object.entries(st.weapons).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const cell = (k, v) => `<div class="stc"><div class="stv">${v}</div><div class="stk">${k}</div></div>`;
    body.innerHTML = `<div class="stgrid">${cell('처치', st.kills)}${cell('죽음', st.deaths)}${cell('K/D', kd)}${cell('헤드샷률', hsr + '%')}${cell('승리', st.wins + ' / ' + st.games)}${cell('승률', wr + '%')}${cell('최고 연속킬', st.bestStreak)}${cell('최대 멀티킬', st.multiMax)}${cell('스파이크 설치', st.plants)}${cell('스파이크 해체', st.defuses)}${cell('보급상자', st.crates)}${cell('힐팩', st.heals)}</div>`
      + `<div class="ptitle small">많이 쓴 무기</div>` + (topW.length ? topW.map(([w, n]) => `<div class="wrow"><img src="${gunIcon(w === 'nade' ? 'nade' : w, 2)}"><span>${(WEAPONS[w] || {}).name || (w === 'nade' ? '수류탄' : w)}</span><b>${n}킬</b></div>`).join('') : '<div class="dim">아직 기록이 없어요</div>')
      + `<div class="ptitle small">모드별 플레이</div><div class="dim">${Object.entries(st.modes).map(([m, n]) => `${(SH.MODES[m] || {}).name || m} ${n}판`).join(' · ') || '아직 없음'}</div>`;
  } else if (hubTab === 'rank') {
    send({ t: 'rank' });
    body.innerHTML = `<div class="seg" id="rankSeg"><button data-r="kills">처치</button><button data-r="wins">승리</button><button data-r="kd">K/D</button></div><div id="rankList" class="dim">불러오는 중…</div>`;
    body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { rankTab = b.dataset.r; renderRank(); });
    renderRank();
  }
}
function renderRank() {
  const seg = document.getElementById('rankSeg'); if (!seg) return;
  seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.r === rankTab));
  if (!rankData) return;
  const list = rankData[rankTab] || [], me2 = myName();
  $('rankList').classList.remove('dim');
  $('rankList').innerHTML = `<div class="dim" style="margin:6px 0">이 서버에서 플레이한 ${rankData.total}명 중 상위 20명 (봇 제외)</div><table><tr><th>#</th><th>이름</th><th class="num">처치</th><th class="num">승리</th><th class="num">판수</th><th class="num">K/D</th></tr>` +
    (list.length ? list.map((v, i) => `<tr class="${v.name === me2 ? 'me' : ''}"><td>${i < 3 ? `<b style="color:${['#f4c22b', '#c9ced9', '#c98a4a'][i]}">${i + 1}</b>` : i + 1}</td><td><span class="sw" style="background:${hexs(PCOLORS[v.color || 0])}"></span><span class="lv" style="color:#f4c22b;font-size:11px">Lv${v.lv || 1}</span> ${esc(v.name)}</td><td class="num">${v.kills}</td><td class="num">${v.wins}</td><td class="num">${v.games}</td><td class="num">${(v.kills / Math.max(1, v.deaths)).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="6" class="dim">아직 기록이 없어요. 매치를 끝까지 해보세요!</td></tr>') + '</table>';
}
function onRank(m) { rankData = m; if (hubTab === 'rank' && !$('hub').classList.contains('hidden')) renderRank(); }

/* ================= 골드 뽑기 ================= */
let CHEST_URL = null;
function chestIcon() {
  if (CHEST_URL) return CHEST_URL;
  const c = document.createElement('canvas'); c.width = 20; c.height = 16; const x = c.getContext('2d');
  const rows = ['..XXXXXXXXXXXXXX..', '.XWWWWWWWWWWWWWWX.', 'XWwwwwwwwwwwwwwwWX', 'XWwwwwwwwwwwwwwwWX', 'XGGGGGGGLLGGGGGGGX', 'XWwwwwwwLLwwwwwwWX', 'XWwwwwwwwwwwwwwwWX', 'XWwwwwwwwwwwwwwwWX', 'XWwwwwwwwwwwwwwwWX', 'XGGGGGGGGGGGGGGGGX', 'XXXXXXXXXXXXXXXXXX'];
  const col = { X: '#2a1600', W: '#7a4a1e', w: '#9a6430', G: '#e3b341', L: '#fff3a8' };
  rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (col[ch]) { x.fillStyle = col[ch]; x.fillRect(xx + 1, yy + 3, 1, 1); } }));
  return (CHEST_URL = c.toDataURL());
}
function renderGacha() {
  $('lockerGrid').innerHTML = `<div class="gacha"><img class="chest" id="gChest" src="${chestIcon()}"><div class="gtitle">골드 뽑기 상자</div>
    <div class="dim">캐릭터 스킨 · 총 스킨 · 감정표현 · 스프레이 중 하나가 랜덤으로 나와요 (레벨 제한 무시!) · 이미 가진 거면 코인으로 돌려받아요</div>
    <div class="grates">${RARITY.map(r => `<span style="color:${r.color}">${r.name} ${r.w}%</span>`).join(' · ')}</div>
    <button id="gachaBtn" class="btn big yellow">뽑기 <small><i class="goldc"></i> ${GACHA_COST} 골드 (보유 ${profile.gold})</small></button>
    <div id="gachaOut"></div></div>`;
  $('gachaBtn').onclick = doGacha;
}
function doGacha() {
  const res = rollGacha();
  if (res.err) { A.sfxDeny(); toast('골드가 부족해요 (킬·미션·업적으로 모아요)'); return; }
  updateProfileUI();
  const btn = $('gachaBtn'); btn.disabled = true;
  const chest = $('gChest'); chest.classList.add('shake'); A.sfxSpin(true);
  const R = RARITY.find(r => r.id === res.r);
  setTimeout(() => {
    chest.classList.remove('shake');
    const th = res.kind === 'skin' ? skinThumb(res.id) : res.kind === 'gskin' ? gunIcon('rifle', 2, res.id) : res.kind === 'emote' ? emoteIcon(res.id, 64) : sprayCanvas(res.id, 5).toDataURL();
    $('gachaOut').innerHTML = `<div class="greveal" style="--rc:${R.color}"><div class="grar" style="color:${R.color}">${R.name}</div><img src="${th}"><div class="gname">${esc(res.it.name)} <span class="dim">(${{ skin: '캐릭터 스킨', gskin: '총 스킨', emote: '감정표현', spray: '스프레이' }[res.kind]})</span></div>${res.dup ? '<div class="dim">이미 가지고 있어서 코인으로 돌려받았어요</div>' : `<button class="btn green" id="gEquip">바로 장착</button>`}</div>`;
    if (!res.dup) $('gEquip').onclick = () => { equip(res.kind, res.id); refreshPreview(); A.sfxBuy(); renderGacha(); };
    if (!res.dup && res.kind === 'emote' && pv.ch) pv.emote = { anim: res.it.anim, fx: res.it.fx, t0: performance.now(), until: performance.now() + 3000 };
    if (res.r === 'legend') { A.sfxFanfare(); } else A.sfxBuy();
    btn.disabled = false; $('gachaBtn').querySelector('small').innerHTML = `<i class="goldc"></i> ${GACHA_COST} 골드 (보유 ${profile.gold})`;
    updateProfileUI(); noticeDone([], checkAchievements());
  }, 1300);
}

setTimeout(() => { updateMissionDot(); noticeDone([], checkAchievements()); }, 600);

/* ================= 감정표현 / 스프레이 ================= */
function toggleEmoteWheel(on) {
  S.emoteOpen = on == null ? !S.emoteOpen : on;
  const el = $('emoteWheel');
  el.classList.toggle('hidden', !S.emoteOpen);
  if (S.emoteOpen) el.innerHTML = '<div class="ew-title">감정표현 · 숫자키로 선택 (Y 닫기)</div>' + profile.emoteSlots.map((id, i) => `<div class="ew-item r-${(EMOTE_BY[id] || {}).r}" data-e="${i}"><b>${i + 1}</b> ${esc((EMOTE_BY[id] || { name: id }).name)}</div>`).join('');
  el.querySelectorAll('[data-e]').forEach(d => d.onclick = () => doEmote(+d.dataset.e));
}
function doEmote(i) {
  toggleEmoteWheel(false);
  const id = profile.emoteSlots[i];
  if (!me.alive || !EMOTE_BY[id]) return;
  send({ t: 'emote', e: id });
  S.selfEmote = { e: id, t0: performance.now(), until: performance.now() + 2600, x: me.x, z: me.z };
}
function onEmote(m) {
  const em = EMOTE_BY[m.e]; if (!em) return;
  const e = S.ents.get(m.id);
  if (e) {
    e.emote = { anim: em.anim, fx: em.fx, t0: performance.now(), until: performance.now() + 2600 };
    if (em.say) {
      if (e.bubble) e.model.remove(e.bubble);
      const b = labelSprite(em.say, '#ffffff'); b.position.y = 2.55; b.scale.multiplyScalar(1.3); e.model.add(b); e.bubble = b;
      setTimeout(() => { if (e.bubble === b) { e.model.remove(b); e.bubble = null; } }, 2600);
    }
  }
  if (em.say && m.id !== S.myId) addChat(`<b style="color:${nameColor(m.id)}">${esc((S.roster.get(m.id) || {}).name || '?')}</b>: ${esc(em.say)}`);
}
const sprayTexCache = {};
function sprayTex(i) {
  if (!SPRAY_BY[i]) i = 'heart';
  if (sprayTexCache[i]) return sprayTexCache[i];
  const t = new THREE.CanvasTexture(sprayCanvas(i, 1)); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return (sprayTexCache[i] = t);
}
function doSpray() {
  if (!me.alive || !S.map) return;
  const eye = eyePos(), fwd = camForward(new THREE.Vector3());
  const h = SH.raycast(S.map, eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, 6);
  if (!h) { toast('가까운 벽이나 바닥을 보고 T를 누르세요'); return; }
  send({ t: 'spray', s: profile.spray, p: [+(eye.x + fwd.x * h.t).toFixed(2), +(eye.y + fwd.y * h.t).toFixed(2), +(eye.z + fwd.z * h.t).toFixed(2)], n: [h.nx, h.ny, h.nz] });
}
function onSpray(m) {
  const old = S.sprays.get(m.id); if (old) scene.remove(old);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: sprayTex(m.s), transparent: true, alphaTest: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  const [x, y, z] = m.p, [nx, ny, nz] = m.n;
  mesh.position.set(x + nx * 0.02, y + ny * 0.02, z + nz * 0.02);
  mesh.lookAt(mesh.position.x + nx, mesh.position.y + ny, mesh.position.z + nz);
  scene.add(mesh); S.sprays.set(m.id, mesh);
  const d = Math.hypot(x - me.x, z - me.z); if (d < 20) A.sfxSpray(clamp(1 - d / 20, 0.1, 1));
}
// 내 감정표현: 3인칭 카메라 + 유령 모델
function selfEmoteActive() {
  const se = S.selfEmote;
  if (!se) return false;
  if (!me.alive || performance.now() > se.until || Math.hypot(me.x - se.x, me.z - se.z) > 0.6 || WS.trigger) { S.selfEmote = null; if (S.ghost) { S.ghost.visible = false; clearEmotePose(S.ghost); } return false; }
  return true;
}
function updateSelfEmoteCam(dt) {
  const se = S.selfEmote, g = S.ghost; if (!g) return;
  g.visible = true; g.position.set(me.x, me.y, me.z); g.rotation.y = me.yaw;
  animChar(g, dt, 0, 0, false, false, false);
  const em = EMOTE_BY[se.e] || { anim: 'wave' };
  applyEmote(g, em.anim, (performance.now() - se.t0) / 1000); emoteFx(em.fx, me.x, me.y, me.z, spawnParticle);
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  camera.position.set(me.x + fx * 3.2 + fz * 0.6, me.y + 2.0, me.z + fz * 3.2 - fx * 0.6);
  camera.lookAt(me.x, me.y + 1.1, me.z);
  camera.fov = CFG.fov;
}

/* ================= 맵 에디터 ================= */
const BLOCK_NAMES = { 1: '잔디', 2: '흙', 3: '돌', 4: '조약돌', 5: '나무판자', 6: '통나무', 7: '나뭇잎', 8: '모래', 9: '사암', 10: '벽돌', 11: '콘크리트', 12: '철판', 13: '상자', 14: '지붕', 15: '기반암', 16: '아스팔트', 17: '자갈길', 18: '건초', 19: '선인장', 20: '빨간 컨테이너', 21: '파란 컨테이너', 22: '초록 컨테이너', 23: '무늬 사암', 24: '조명', 25: '회벽', 26: '철망', 27: '경고 줄무늬', 28: '짙은 나무', 29: '노란 컨테이너', 30: '눈', 31: '얼음', 32: '전나무 잎', 33: '이끼 돌', 34: '석재 벽돌', 35: '석탄 광석', 36: '금 광석', 37: '다이아 광석', 38: '월면토', 39: '달 바위', 40: '패널', 41: '유리창', 42: '빨간 양털', 43: '파란 양털', 44: '흰 양털', 45: '노란 양털', 46: '금 블록', 47: '네온' };
const THEMES = ['village', 'desert', 'snow', 'factory', 'moon', 'jungle', 'city', 'arena'];
const ED = { on: false, map: null, world: null, sky: null, name: '내 맵', theme: 'village', id: null, x: 32, y: 12, z: 60, yaw: 0, pitch: -0.3, slot: 0, pal: [1, 2, 3, 4, 5, 10, 6, 7, 47], undo: [], hit: null, hl: null, picker: false };
const blockIconCache = {};
function blockIcon(b) {
  if (blockIconCache[b]) return blockIconCache[b];
  const f = FACES[b]; if (!f) return '';
  const ti = f[1], c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(atlas.cv, (ti % ATLAS_COLS) * 16, Math.floor(ti / ATLAS_COLS) * 16, 16, 16, 0, 0, 32, 32);
  return (blockIconCache[b] = c.toDataURL());
}
function loadSavedMaps() { try { return JSON.parse(localStorage.getItem('pf_maps') || '[]'); } catch (e) { return []; } }
function storeSavedMaps(list) { try { localStorage.setItem('pf_maps', JSON.stringify(list)); return true; } catch (e) { toast('저장 공간이 부족해요'); return false; } }
function mapThumbOf(m) {
  const c = document.createElement('canvas'); c.width = m.W; c.height = m.D;
  const ctx = c.getContext('2d'), img = ctx.createImageData(m.W, m.D);
  for (let z = 0; z < m.D; z++) for (let x = 0; x < m.W; x++) {
    let y = m.H - 1; while (y > 0 && !m.get(x, y, z)) y--;
    const col = new THREE.Color(BLOCK_COLOR[m.get(x, y, z)] || 0x888888).multiplyScalar(0.55 + (y / m.H) * 1.1);
    const i = (z * m.W + x) * 4; img.data[i] = clamp(col.r * 255, 0, 255); img.data[i + 1] = clamp(col.g * 255, 0, 255); img.data[i + 2] = clamp(col.b * 255, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function themeName(t) { return (SH.MAPS[t] || SH.MAPS.village).name + ' 하늘'; }

// 시작 창
function openEditorStart() {
  A.initAudio();
  const list = loadSavedMaps();
  $('edStartBody').innerHTML = `
    <div class="ptitle small">새로 만들기</div>
    <div class="row">크기 <select id="edNewSize"><option value="48">48×48 (작게)</option><option value="64" selected>64×64 (보통)</option><option value="80">80×80 (크게)</option></select>
      바닥 <select id="edNewTheme">${['village', 'desert', 'snow', 'factory', 'moon'].map(t => `<option value="${t}">${SH.MAPS[t].name} 스타일</option>`).join('')}</select>
      <button class="btn green" id="edNew">빈 맵 만들기</button></div>
    <div class="row">기존 맵 복사 <select id="edCopy">${Object.keys(SH.MAPS).filter(k => (SH.MAPS[k].kind || 'normal') === 'normal').map(k => `<option value="${k}">${SH.MAPS[k].name}</option>`).join('')}</select><button class="btn blue" id="edCopyBtn">복사해서 시작</button></div>
    <div class="ptitle small">내 맵 (${list.length}/8)</div>
    <div class="edlist">${list.length ? list.map(e => `<div class="edrow" data-id="${e.id}"><span class="edn">${esc(e.name)}</span><span class="dim">${e.W}×${e.D} · ${new Date(e.updated).toLocaleDateString()}</span><button class="btn tiny green" data-act="edit">편집</button><button class="btn tiny red" data-act="del">삭제</button></div>`).join('') : '<div class="dim">아직 만든 맵이 없어요</div>'}</div>
    <div class="ptitle small">공유 코드로 불러오기</div>
    <textarea id="edImport" placeholder="친구에게 받은 맵 코드를 붙여넣으세요"></textarea>
    <button class="btn" id="edImportBtn">불러오기</button>`;
  $('editorStart').classList.remove('hidden');
  $('edNew').onclick = () => { const sz = +$('edNewSize').value, th = $('edNewTheme').value; startEditor(SH.blankMap(sz, sz, th), { name: '내 맵', theme: th }); };
  $('edCopyBtn').onclick = () => { const k = $('edCopy').value; startEditor(SH.getMap(k).clone(), { name: SH.MAPS[k].name + ' 수정본', theme: k }); };
  $('edStartBody').querySelectorAll('.edrow').forEach(row => {
    const ent = list.find(e => e.id === row.dataset.id);
    row.querySelector('[data-act="edit"]').onclick = () => { const m = SH.mapFromData(ent); if (!m) { toast('맵을 불러올 수 없어요'); return; } startEditor(m, ent); };
    row.querySelector('[data-act="del"]').onclick = () => { if (!confirm(`'${ent.name}' 맵을 지울까요?`)) return; storeSavedMaps(list.filter(e => e.id !== ent.id)); openEditorStart(); };
  });
  $('edImportBtn').onclick = () => {
    try {
      const o = JSON.parse($('edImport').value.trim().replace(/^PXM1:/, ''));
      const ent = { name: String(o.n || '받은 맵').slice(0, 16), theme: o.t || 'village', W: o.W, H: o.H, D: o.D, data: o.d };
      const m = SH.mapFromData(ent); if (!m) throw new Error();
      startEditor(m, ent);
    } catch (e) { toast('코드가 올바르지 않아요'); }
  };
}
$('editorBtn').onclick = openEditorStart;
$('edStartClose').onclick = () => $('editorStart').classList.add('hidden');

function startEditor(map, meta) {
  $('editorStart').classList.add('hidden');
  Object.assign(ED, { on: true, map, name: meta.name || '내 맵', theme: THEMES.includes(meta.theme) ? meta.theme : 'village', id: meta.id || null, undo: [], x: map.W / 2, y: 14, z: map.D - 3, yaw: 0, pitch: -0.4 });
  for (const s of ['menu', 'lobby']) $(s).classList.add('hidden');
  $('hud').classList.add('hidden');
  if (S.world) S.world.visible = false; if (S.sky) S.sky.visible = false;
  edBuildScene();
  $('editorHud').classList.remove('hidden');
  $('edName').value = ED.name;
  $('edTheme').innerHTML = THEMES.map(t => `<option value="${t}" ${t === ED.theme ? 'selected' : ''}>${themeName(t)}</option>`).join('');
  renderPalette();
  $('clickToPlay').classList.remove('hidden');
}
function edBuildScene() {
  if (ED.world) { scene.remove(ED.world); disposeWorld(ED.world); }
  if (ED.sky) scene.remove(ED.sky);
  ED.world = buildWorld(ED.map, atlas.tex); scene.add(ED.world);
  const def = SH.MAPS[ED.theme];
  ED.sky = buildSky(def); scene.add(ED.sky);
  scene.fog = new THREE.Fog(def.fog, 60, 200);
  if (!ED.hl) { ED.hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(ED.hl); }
  ED.hl.visible = true;
}
function exitEditor(toMenu) {
  ED.on = false;
  if (ED.world) { scene.remove(ED.world); disposeWorld(ED.world); ED.world = null; }
  if (ED.sky) { scene.remove(ED.sky); ED.sky = null; }
  if (ED.hl) ED.hl.visible = false;
  if (S.world) S.world.visible = true; if (S.sky) S.sky.visible = true;
  $('editorHud').classList.add('hidden'); $('blockPicker').classList.add('hidden'); $('edShare').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  $('clickToPlay').classList.add('hidden');
  if (toMenu !== false) showScreen('menu');
}
function renderPalette() {
  $('edPalette').innerHTML = ED.pal.map((b, i) => `<div class="eps ${i === ED.slot ? 'on' : ''}" data-i="${i}"><img src="${blockIcon(b)}"><b>${i + 1}</b></div>`).join('') + `<div class="eps more" id="edMore">B<br>블록</div>`;
  $('edPalette').querySelectorAll('[data-i]').forEach(d => d.onclick = () => { ED.slot = +d.dataset.i; renderPalette(); });
  $('edMore').onclick = openBlockPicker;
  $('edBlockName').textContent = BLOCK_NAMES[ED.pal[ED.slot]] || '';
}
function openBlockPicker() {
  ED.picker = true;
  if (document.pointerLockElement) document.exitPointerLock();
  const ids = Object.keys(FACES).map(Number).filter(b => b !== SH.B.BEDROCK).sort((a, b) => a - b);
  $('bpGrid').innerHTML = ids.map(b => `<div class="bpi" data-b="${b}" title="${BLOCK_NAMES[b] || b}"><img src="${blockIcon(b)}"><span>${BLOCK_NAMES[b] || b}</span></div>`).join('');
  $('bpGrid').querySelectorAll('[data-b]').forEach(d => d.onclick = () => { ED.pal[ED.slot] = +d.dataset.b; renderPalette(); closeBlockPicker(); });
  $('blockPicker').classList.remove('hidden');
}
function closeBlockPicker() { ED.picker = false; $('blockPicker').classList.add('hidden'); lockPointer(); }
$('bpClose').onclick = closeBlockPicker;

function edSet(x, y, z, b, noUndo) {
  const m = ED.map;
  if (x < 0 || z < 0 || x >= m.W || z >= m.D || y < 1 || y >= m.H) return false;
  const prev = m.get(x, y, z); if (prev === b) return false;
  m.set(x, y, z, b);
  if (!noUndo) { ED.undo.push([x, y, z, prev]); if (ED.undo.length > 400) ED.undo.shift(); }
  rebuildBlocks(ED.world, [[x, y, z]]);
  return true;
}
function edRemove() { const h = ED.hit; if (h && edSet(h.x, h.y, h.z, 0)) { A.sfxStep(1); for (let i = 0; i < 5; i++) spawnParticle(h.x + 0.5, h.y + 0.5, h.z + 0.5, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, BLOCK_COLOR[ED.map.get(h.x, h.y, h.z)] || 0x999999, 0.5, 0.1, 10); } }
function edPlace() {
  const h = ED.hit; if (!h) return;
  const x = h.x + h.nx, y = h.y + h.ny, z = h.z + h.nz;
  if (Math.floor(ED.x) === x && Math.floor(ED.z) === z && (Math.floor(ED.y) === y || Math.floor(ED.y - 1) === y)) return;
  if (edSet(x, y, z, ED.pal[ED.slot])) A.sfxPick();
}
function edPick() { const h = ED.hit; if (h) { const b = ED.map.get(h.x, h.y, h.z); if (b && b !== SH.B.BEDROCK) { ED.pal[ED.slot] = b; renderPalette(); } } }
function edUndo() { const u = ED.undo.pop(); if (u) edSet(u[0], u[1], u[2], u[3], true); }
function edSave(silent) {
  ED.name = ($('edName').value.trim() || '내 맵').slice(0, 16);
  const enc = SH.encodeMap(ED.map);
  const check = SH.mapFromData(Object.assign({ theme: ED.theme }, enc));
  const list = loadSavedMaps();
  if (!ED.id && list.length >= 8) { toast('맵은 8개까지 저장돼요. 시작 화면에서 하나 지워주세요'); return null; }
  const ent = Object.assign({ id: ED.id || 'm' + Date.now(), name: ED.name, theme: ED.theme, updated: Date.now() }, enc);
  const i = list.findIndex(e => e.id === ent.id); if (i >= 0) list[i] = ent; else list.unshift(ent);
  if (!storeSavedMaps(list)) return null;
  ED.id = ent.id;
  if (!silent) toast(check && check.spawns.length >= 2 ? `'${ED.name}' 저장했어요` : '저장했지만 스폰할 평지가 부족해요 (넓은 빈 땅을 남겨주세요)');
  A.sfxBuy();
  return check && check.spawns.length >= 2 ? ent : null;
}
function edTest() {
  const ent = edSave(true);
  if (!ent) { toast('플레이하려면 지면 높이에 넓은 빈 땅(3×3 이상)이 몇 군데 필요해요'); return; }
  exitEditor(false);
  S.afterRoom = () => { send({ t: 'cfg', cfg: { mode: 'ffa', bots: 5, time: 300, kills: 25, diff: 'normal', map: 'custom' }, custom: ent }); send({ t: 'start' }); };
  send(Object.assign({ t: 'create', cfg: { map: 'village', mode: 'ffa', bots: 5, time: 300, kills: 25, diff: 'normal' } }, joinInfo()));
}
function edShare() {
  const enc = SH.encodeMap(ED.map);
  const code = 'PXM1:' + JSON.stringify({ n: ($('edName').value.trim() || '내 맵'), t: ED.theme, W: enc.W, H: enc.H, D: enc.D, d: enc.data });
  if (document.pointerLockElement) document.exitPointerLock();
  $('edShareText').value = code; $('edShare').classList.remove('hidden');
  $('edShareText').select();
}
$('edSave').onclick = () => edSave();
$('edTest').onclick = edTest;
$('edCode').onclick = edShare;
$('edShareClose').onclick = () => $('edShare').classList.add('hidden');
$('edShareCopy').onclick = () => { $('edShareText').select(); (navigator.clipboard ? navigator.clipboard.writeText($('edShareText').value) : Promise.reject()).then(() => toast('코드를 복사했어요'), () => { document.execCommand('copy'); toast('코드를 복사했어요'); }); };
$('edExit').onclick = () => { if (confirm('저장하고 나갈까요? (취소 = 저장 안 하고 나가기)')) edSave(true); exitEditor(); };
$('edTheme').onchange = (e) => { ED.theme = e.target.value; edBuildScene(); };
function editorKey(e) {
  keys[e.code] = true;
  if (['Space', 'KeyC', 'Tab'].includes(e.code)) e.preventDefault();
  if (/^Digit[1-9]$/.test(e.code)) { ED.slot = +e.code.slice(5) - 1; renderPalette(); }
  else if (e.code === 'KeyQ') edPick();
  else if (e.code === 'KeyZ') edUndo();
  else if (e.code === 'KeyM') edSave();
  else if (e.code === 'KeyB') { if (ED.picker) closeBlockPicker(); else openBlockPicker(); }
}
document.addEventListener('mousemove', (e) => { if (!ED.on || !S.locked) return; const k = 0.0022 * CFG.sens; ED.yaw -= e.movementX * k; ED.pitch = clamp(ED.pitch - e.movementY * k, -1.55, 1.55); });
document.addEventListener('mousedown', (e) => { if (!ED.on || !S.locked) return; if (e.button === 0) edRemove(); else if (e.button === 2) edPlace(); else if (e.button === 1) { edPick(); e.preventDefault(); } });
document.addEventListener('wheel', (e) => { if (!ED.on || ED.picker) return; ED.slot = (ED.slot + (e.deltaY > 0 ? 1 : -1) + 9) % 9; renderPalette(); });
document.addEventListener('contextmenu', (e) => { if (ED.on) e.preventDefault(); });
cv.addEventListener('click', () => { if (ED.on && !S.locked && !ED.picker) lockPointer(); });
function editorFrame(dt) {
  const k = keys, sp = (k.ShiftLeft ? 22 : 9) * dt, m = ED.map;
  const fx = -Math.sin(ED.yaw), fz = -Math.cos(ED.yaw), rx = Math.cos(ED.yaw), rz = -Math.sin(ED.yaw);
  let mx = 0, mz = 0;
  if (k.KeyW) { mx += fx; mz += fz; } if (k.KeyS) { mx -= fx; mz -= fz; } if (k.KeyD) { mx += rx; mz += rz; } if (k.KeyA) { mx -= rx; mz -= rz; }
  ED.x = clamp(ED.x + mx * sp, -4, m.W + 4); ED.z = clamp(ED.z + mz * sp, -4, m.D + 4);
  if (k.Space) ED.y += sp; if (k.KeyC) ED.y -= sp;
  ED.y = clamp(ED.y, 1.5, m.H + 14);
  camera.position.set(ED.x, ED.y, ED.z); camera.rotation.set(ED.pitch, ED.yaw, 0); camera.fov = CFG.fov; camera.updateProjectionMatrix();
  const dx = -Math.sin(ED.yaw) * Math.cos(ED.pitch), dy = Math.sin(ED.pitch), dz = -Math.cos(ED.yaw) * Math.cos(ED.pitch);
  ED.hit = SH.raycast(m, ED.x, ED.y, ED.z, dx, dy, dz, 12);
  if (ED.hit && (ED.hit.x < 0 || ED.hit.z < 0 || ED.hit.x >= m.W || ED.hit.z >= m.D)) ED.hit = null;
  ED.hl.visible = !!ED.hit;
  if (ED.hit) ED.hl.position.set(ED.hit.x + 0.5, ED.hit.y + 0.5, ED.hit.z + 0.5);
  if (ED.sky) { ED.sky.position.set(ED.x, 0, ED.z); ED.sky.userData.clouds.position.x = (performance.now() / 1000 * 1.5) % 250; }
  $('clickToPlay').classList.toggle('hidden', S.locked || ED.picker || !$('edShare').classList.contains('hidden'));
  $('edPos').textContent = `x${Math.floor(ED.x)} y${Math.floor(ED.y)} z${Math.floor(ED.z)}${ED.hit ? ' · ' + (BLOCK_NAMES[m.get(ED.hit.x, ED.hit.y, ED.hit.z)] || '') : ''}`;
  updateParticles(dt);
  renderer.clear();
  renderer.render(scene, camera);
}

/* ---------- 대기실: 내 맵 카드 ---------- */
function refreshCustomCards(m) {
  const box = $('mapCards');
  box.querySelectorAll('.mapcard.custom').forEach(c => c.remove());
  const host = m.host === S.myId, md = m.cfg.mode;
  if (md === 'spike') return;
  const saved = loadSavedMaps();
  const add = (ent, sel) => {
    const d = document.createElement('div'); d.className = 'mapcard custom' + (sel ? ' on' : ''); d.dataset.map = 'custom';
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    try { const mm = SH.mapFromData(ent); if (mm) { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(mapThumbOf(mm), 0, 0, 64, 64); } } catch (e) { /* */ }
    d.appendChild(c); d.appendChild(document.createTextNode(ent.name));
    const sm = document.createElement('div'); sm.className = 'mdesc'; sm.textContent = '내 맵'; d.appendChild(sm);
    if (host && ent.data) d.onclick = () => send({ t: 'cfg', cfg: Object.assign({}, m.cfg, { map: 'custom' }), custom: ent });
    box.appendChild(d);
  };
  let shownCurrent = false;
  for (const ent of saved) { const sel = m.cfg.map === 'custom' && m.customName === ent.name; if (sel) shownCurrent = true; if (host || sel) add(ent, sel); }
  if (m.cfg.map === 'custom' && !shownCurrent) {
    const d = document.createElement('div'); d.className = 'mapcard custom on'; d.dataset.map = 'custom';
    d.innerHTML = `<canvas width="64" height="64"></canvas>${esc(m.customName || '커스텀 맵')}<div class="mdesc">친구의 맵</div>`; box.appendChild(d);
  }
}

/* ---------- 모바일 터치 ---------- */
function lookBy(dx, dy) {
  if (!me.alive) return;
  const zoom = lerp(1, (WEAPONS[WS.cur] && WEAPONS[WS.cur].zoom) || 1, WS.ads);
  const k = 0.0022 * CFG.sens / zoom;
  me.yaw -= dx * k; me.pitch = clamp(me.pitch - dy * k, -1.55, 1.55);
}
S.touch = initTouch({ keys, WS, look: lookBy, press: (c) => { if (S.inGame && !S.modal) onPress(c); }, key: (c) => { if (c === 'KeyB') toggleBuy(); }, cycle: (d) => cycleWeapon(d), pause: () => openPause(), inGame: () => S.inGame, modal: () => !!S.modal, mode: () => S.mode });

/* ================= 힐팩 / 갑옷 상자 ================= */
const PK_INFO = { hpS: { name: '힐팩', col: 0xe2483a }, hpL: { name: '대형 힐팩', col: 0xe2483a }, armor: { name: '갑옷 상자', col: 0x3d8bf0 } };
function makePickupModel(kind) {
  const g = new THREE.Group();
  const mat = (c, basic) => basic ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c });
  // 받침대 (항상 보임)
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), mat(0x3a3f46)); base.position.y = 0.06; g.add(base);
  const ring = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), mat(PK_INFO[kind].col, true)); ring.position.y = 0.13; g.add(ring);
  const item = new THREE.Group(); item.position.y = 0.75; g.add(item);
  const add = (w, h, d, x, y, z, c, basic) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, basic)); m.position.set(x, y, z); item.add(m); };
  if (kind === 'armor') {
    add(0.62, 0.46, 0.46, 0, 0, 0, 0x2f5fc0); add(0.66, 0.08, 0.5, 0, 0.12, 0, 0x9aa1ab); add(0.66, 0.08, 0.5, 0, -0.12, 0, 0x9aa1ab);
    add(0.2, 0.26, 0.04, 0, 0, -0.25, 0x8ac6ff, true); add(0.12, 0.08, 0.05, 0, -0.1, -0.26, 0x8ac6ff, true);
  } else {
    const s = kind === 'hpL' ? 1.35 : 0.9;
    add(0.55 * s, 0.4 * s, 0.4 * s, 0, 0, 0, 0xf0f0f0);
    add(0.14 * s, 0.32 * s, 0.42 * s, 0, 0, 0, 0xe2483a, true); add(0.38 * s, 0.11 * s, 0.42 * s, 0, 0, 0, 0xe2483a, true);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLASH, transparent: true, depthWrite: false, color: PK_INFO[kind].col, opacity: 0.35 }));
  glow.scale.setScalar(1.3); item.add(glow);
  g.userData = { item, ring };
  return g;
}
function setupPickups(list) {
  for (const p of S.pickups.values()) scene.remove(p.g);
  S.pickups.clear();
  const ready = new Map(list.map(([id, at]) => [id, at]));
  for (const p of (S.map && S.map.pickups) || []) {
    if (!ready.has(p.id)) continue; // 이 모드에선 없음
    const g = makePickupModel(p.kind); g.position.set(p.x, p.y, p.z); scene.add(g);
    S.pickups.set(p.id, Object.assign({}, p, { g, readyAt: ready.get(p.id) || 0 }));
  }
}
function updatePickups() {
  const now = serverNow(), t = performance.now() / 1000;
  for (const p of S.pickups.values()) {
    const ok = now >= p.readyAt;
    p.g.userData.item.visible = ok;
    p.g.userData.item.rotation.y = t * 1.6; p.g.userData.item.position.y = 0.75 + Math.sin(t * 2.5 + p.x) * 0.08;
    p.g.userData.ring.material.color.setHex(ok ? PK_INFO[p.kind].col : 0x2a2e33);
  }
}
function onPickup(m) {
  const p = S.pickups.get(m.id); if (p) p.readyAt = m.readyAt;
  if (m.by === S.myId) {
    if (m.kind === 'armor') { toast('갑옷 +50'); A.sfxPick(); }
    else { track('heal'); A.sfxHeal(); const v = $('vignette'); v.style.boxShadow = 'inset 0 0 120px 40px rgba(60, 220, 90, 0.7)'; v.style.opacity = 0.6; clearTimeout(v.t); v.t = setTimeout(() => { v.style.opacity = 0; v.style.boxShadow = ''; }, 250); }
  }
}

/* ================= 보급상자 ================= */
function makeCrateModel() {
  const g = new THREE.Group();
  const box = (w, h, d, x, y, z, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); g.add(m); return m; };
  box(1, 0.9, 1, 0, 0.45, 0, 0x2f6fd8);
  box(1.04, 0.14, 1.04, 0, 0.2, 0, 0xf4c22b); box(1.04, 0.14, 1.04, 0, 0.7, 0, 0xf4c22b);
  box(0.3, 0.3, 1.06, 0, 0.45, 0, 0xffffff); box(1.06, 0.3, 0.3, 0, 0.45, 0, 0xffffff);
  const chute = new THREE.Group(); g.add(chute);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.62), new THREE.MeshLambertMaterial({ color: (i + j) % 2 ? 0xffffff : 0xe2483a }));
    m.position.set(-0.93 + i * 0.62, 3.2 - (Math.abs(i - 1.5) + Math.abs(j - 1.5)) * 0.18, -0.93 + j * 0.62); chute.add(m);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.4, 0.03), new THREE.MeshBasicMaterial({ color: 0xdddddd })); l.position.set(x * 0.65, 1.95, z * 0.65); l.rotation.set(z * 0.25, 0, -x * 0.25); chute.add(l); }
  const mk = labelSprite('보급상자', '#6af0ff', false); mk.position.y = 4.2; g.add(mk);
  g.userData = { chute, mk };
  return g;
}
function onCrate(m) {
  if (S.crates.has(m.id)) return;
  const g = makeCrateModel(); g.position.set(m.x, m.landY + 36, m.z); scene.add(g);
  S.crates.set(m.id, { id: m.id, g, x: m.x, z: m.z, y: m.landY + 36, landY: m.landY, landed: false });
  showBig('보급상자 투하! 먼저 여는 사람이 임자', '#6af0ff', 2600); A.sfxPlane(0.5);
}
function syncCrates(list) {
  const seen = new Set();
  for (const [id, x, y, z, landed] of list) {
    seen.add(id);
    let c = S.crates.get(id);
    if (!c) { onCrate({ id, x, z, landY: landed ? y : y - 1 }); c = S.crates.get(id); }
    c.y = y; c.landed = !!landed;
  }
  for (const id of [...S.crates.keys()]) if (!seen.has(id)) removeCrate(id);
}
function removeCrate(id) { const c = S.crates.get(id); if (!c) return; scene.remove(c.g); S.crates.delete(id); }
function updateCrates(dt) {
  for (const c of S.crates.values()) {
    c.ry = c.ry == null ? c.y : lerp(c.ry, c.y, Math.min(1, dt * 8));
    c.g.position.set(c.x, c.ry, c.z);
    c.g.userData.chute.visible = !c.landed;
    if (!c.landed) c.g.rotation.y += dt * 0.6;
    c.g.userData.mk.position.y = (c.landed ? 1.8 : 4.2) + Math.sin(performance.now() / 300) * 0.1;
  }
}
function nearCrate() {
  for (const c of S.crates.values()) if (c.landed && Math.hypot(c.x - me.x, c.z - me.z) < 2.2 && Math.abs(c.landY - me.y) < 2.2) return c;
  return null;
}
const LOOT_NAMES = { money: '$1500', armorset: '방탄조끼+헬멧+체력', nades: '수류탄 2개', turret: '자동 포탑', air: '공습', gold: '골드 10', perk_speed: '퍽: 날쌘 발', perk_hp: '퍽: 강철 체력', perk_reload: '퍽: 빠른 손' };
function onCratePick(m) {
  const c = S.crates.get(m.id);
  if (c) { for (let i = 0; i < 20; i++) spawnParticle(c.x, c.landY + 0.6, c.z, (Math.random() - 0.5) * 5, Math.random() * 5, (Math.random() - 0.5) * 5, [0x6af0ff, 0xf4c22b, 0xffffff][i % 3], 0.9, 0.1, 10); }
  removeCrate(m.id);
  const names = (m.loot || []).map(l => l.startsWith('w:') ? (WEAPONS[l.slice(2)] || {}).name : LOOT_NAMES[l]).filter(Boolean).join(', ');
  if (m.by === S.myId) {
    track('crate');
    showBig(`보급 획득: ${names}`, '#6af0ff', 3000); A.sfxBuy();
    if ((m.loot || []).includes('gold')) { addGold(10); goldPop(10); }
  } else addChat(`<span style="color:#6af0ff">${esc((S.roster.get(m.by) || {}).name || '?')} 님이 보급상자를 열었어요 (${esc(names)})</span>`);
}

/* ================= 연습장 ================= */
function targetTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 16; const x = cv.getContext('2d');
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) { const d = Math.hypot(xx - 7.5, yy - 7.5); x.fillStyle = d > 7.6 ? '#3a2a1a' : ['#e2483a', '#ffffff', '#e2483a', '#ffffff', '#e2483a'][Math.min(4, Math.floor(d / 1.6))]; x.fillRect(xx, yy, 1, 1); }
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
let TARGET_TEX = null;
function setupPractice() {
  for (const t of S.targets) scene.remove(t.g);
  for (const o of S.rangeLabels) scene.remove(o);
  S.targets = []; S.rangeLabels = [];
  resetPracticeStats();
  if (S.mode !== 'practice' || !S.map.range) return;
  TARGET_TEX = TARGET_TEX || targetTex();
  for (const [x, z] of S.map.range.targets) {
    const g = new THREE.Group(); g.position.set(x, SH.G, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1).translate(0, 0.45, 0), new THREE.MeshLambertMaterial({ color: 0x3a3f46 })); g.add(post);
    const pivot = new THREE.Group(); pivot.position.y = 0.85; g.add(pivot);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.08).translate(0, 0.55, 0), [0, 0, 0, 0, 1, 1].map(i => i ? new THREE.MeshLambertMaterial({ map: TARGET_TEX }) : new THREE.MeshLambertMaterial({ color: 0x8a5a2e })));
    pivot.add(board); scene.add(g);
    S.targets.push({ x, z, g, pivot, up: false, ang: -1.5, upAt: 0 });
  }
  for (const [z, label] of [[30, '11m'], [20, '21m'], [7, '34m']]) { const sp = labelSprite(label, '#f4c22b'); sp.position.set(2.2, SH.G + 1.6, z + 0.5); scene.add(sp); S.rangeLabels.push(sp); }
  const dl = labelSprite('허수아비 구역', '#6ab0ff'); dl.position.set(52, SH.G + 3.5, 38); scene.add(dl); S.rangeLabels.push(dl);
  const pk = labelSprite('파쿠르', '#7df07d'); pk.position.set(50, SH.G + 4, 49); scene.add(pk); S.rangeLabels.push(pk);
  S.nextPop = performance.now() + 1500;
}
function resetPracticeStats() { S.pst = { shots: 0, hits: 0, heads: 0, kills: 0, react: [], best: 0 }; }
function updateTargets(dt) {
  if (!S.targets.length) return;
  const now = performance.now();
  if (!S.targets.some(t => t.up) && now > S.nextPop) {
    const t = S.targets[Math.floor(Math.random() * S.targets.length)];
    t.up = true; t.upAt = now; A.sfxReload(0);
  }
  for (const t of S.targets) { t.ang = lerp(t.ang, t.up ? 0 : -1.5, Math.min(1, dt * 14)); t.pivot.rotation.x = t.ang; }
}
function hitTarget(t) {
  if (!t.up) return;
  t.up = false;
  const rt = (performance.now() - t.upAt) / 1000;
  S.pst.react.push(rt); if (!S.pst.best || rt < S.pst.best) S.pst.best = rt;
  S.nextPop = performance.now() + 400 + Math.random() * 700;
  A.sfxHit(true); hitMarker('head');
}
function practiceHudText() {
  const p = S.pst, avg = p.react.length ? p.react.reduce((a, b) => a + b, 0) / p.react.length : 0;
  return `<div class="ph-t">사격 연습장</div>명중률 <b>${p.shots ? Math.round(p.hits / p.shots * 100) : 0}%</b> <span class="dim">(${p.hits}/${p.shots})</span><br>헤드샷 <b>${p.hits ? Math.round(p.heads / p.hits * 100) : 0}%</b> · 처치 <b>${p.kills}</b><br>과녁 <b>${p.react.length}</b>개 · 평균 반응 <b>${avg ? avg.toFixed(2) + '초' : '-'}</b><br>최고 반응 <b>${p.best ? p.best.toFixed(2) + '초' : '-'}</b><br><span class="dim">B: 모든 총 무료 · P: 기록 초기화</span>`;
}

/* ================= 스파이크 모드 ================= */
const SPK = SH.SPK;
function spState() {
  const a = S.spk; if (!a) return null;
  return { ph: a[0], pe: a[1], st: a[2], x: a[3], y: a[4], z: a[5], carrier: a[6], prog: a[7], atk: a[8], site: a[9], round: a[10], actor: a[11] };
}
function mySite() { if (!S.map || !S.map.spike) return null; for (const k of ['A', 'B']) if (SH.inRect(S.map.spike.sites[k].rect, me.x, me.z)) return k; return null; }
function spikeFrozen() {
  if (S.mode !== 'spike') return false;
  const s = spState(); if (!s) return false;
  return s.ph === 'buy' || S.plantOn || S.defOn;
}
function roundBanner(main, sub, color, ms) {
  const el = $('roundBanner');
  el.innerHTML = `<div class="rb-main" style="color:${color || '#fff'}">${esc(main)}</div>${sub ? `<div class="rb-sub">${esc(sub)}</div>` : ''}`;
  el.classList.add('on'); clearTimeout(el.t); el.t = setTimeout(() => el.classList.remove('on'), ms || 2800);
}
function onRound(m) {
  S.score = m.score;
  S.spk = [m.phase, m.phaseEnd, m.carrier ? 1 : 0, 0, 0, 0, m.carrier || 0, 0, m.atk, 0, m.round, 0];
  if (m.reset) {
    // 맵 초기화 (부서진 블록 복구)
    if (S.world) { scene.remove(S.world); disposeWorld(S.world); }
    S.map = SH.getMap(S.mapId).clone(); setGimMap(S.map);
    S.world = buildWorld(S.map, atlas.tex); scene.add(S.world);
    for (const id of [...S.projs.keys()]) removeProj(id);
    for (const id of [...S.drops.keys()]) removeDrop(id);
    for (const id of [...S.turrets.keys()]) removeTurret(id);
    for (const h of holes) h.visible = false;
    if (S.kc) { S.kc.done = true; S.kc.active = false; }
    $('killcam').classList.add('hidden'); $('death').classList.add('hidden');
    S.plantOn = false; S.defOn = false; S.specId = null;
    const iAtk = myTeam() === m.atk;
    const half = m.round === SPK.HALF + 1 ? ' · 공수 교대!' : '';
    roundBanner(`라운드 ${m.round}`, (iAtk ? '공격 — 스파이크를 A나 B에 설치하세요' : '수비 — 사이트를 지키고 해체하세요') + half, iAtk ? '#ff8a7a' : '#8ac6ff', 3200);
    A.sfxStreak();
  } else if (m.phase === 'live') { roundBanner('전투 시작!', '', '#ffd84a', 1200); A.sfxSiren(); }
}
function onRoundEnd(m) {
  S.score = m.score;
  const won = m.win === myTeam();
  roundBanner(won ? '라운드 승리!' : '라운드 패배', `${m.reason} · ${m.score[myTeam()] || 0} : ${m.score[1 - myTeam()] || 0}`, won ? '#7df07d' : '#ff6a5a', 4500);
  if (won) A.sfxStreak(); else A.sfxDeny();
}
function onSpikeEv(m) {
  if (m.id === S.myId && (m.ev === 'plant' || m.ev === 'defuse')) track(m.ev);
  const nm = m.id ? (S.roster.get(m.id) || {}).name || '?' : '';
  if (m.ev === 'plant') { showBig(`스파이크 설치됨! (사이트 ${m.site})`, '#ff6a5a', 2600); A.sfxSiren(); }
  else if (m.ev === 'defuse') { showBig(`${nm} 님이 스파이크를 해체했어요!`, '#6ab0ff', 2600); A.sfxPick(); }
  else if (m.ev === 'drop') { const s = spState(); if (s && myTeam() === s.atk) showBig('스파이크가 떨어졌어요! 주우세요', '#ffd84a', 2000); }
  else if (m.ev === 'pick') { if (m.id === S.myId) showBig('스파이크 획득 — 사이트로 가서 F 길게!', '#ffd84a', 2200); }
  else if (m.ev === 'boom') { S.shake = 2; }
}
let SPIKE_MESH = null, beepT = 0;
function setupSpike() {
  for (const o of S.spikeObjs) scene.remove(o);
  S.spikeObjs = [];
  if (S.mode !== 'spike' || !S.map.spike) return;
  for (const k of ['A', 'B']) {
    const c = S.map.spike.sites[k].c;
    const sp = labelSprite(`  ${k}  `, '#ffd84a', false); sp.scale.multiplyScalar(2.2); sp.position.set(c[0], c[1] + 5, c[2]); scene.add(sp); S.spikeObjs.push(sp);
    const rc = S.map.spike.sites[k].rect;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(rc[2] - rc[0] + 1, 0.04, rc[3] - rc[1] + 1), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.12, depthWrite: false }));
    pad.position.set((rc[0] + rc[2] + 1) / 2, SH.G + 0.03, (rc[1] + rc[3] + 1) / 2); scene.add(pad); S.spikeObjs.push(pad);
  }
  SPIKE_MESH = makeGun('spike', 0.05);
  const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLASH, transparent: true, depthWrite: false, color: 0xff3020 })); light.scale.setScalar(0.5); light.position.y = 0.55; SPIKE_MESH.add(light);
  SPIKE_MESH.userData.light = light;
  scene.add(SPIKE_MESH); S.spikeObjs.push(SPIKE_MESH);
}
function updateSpike(dt) {
  if (S.mode !== 'spike' || !SPIKE_MESH) return;
  const s = spState();
  if (!s || s.st === 0 || s.st >= 4) { SPIKE_MESH.visible = false; return; }
  SPIKE_MESH.visible = true;
  let x = s.x, y = s.y, z = s.z, sc = 1;
  if (s.st === 1) {
    if (s.carrier === S.myId) { SPIKE_MESH.visible = false; }
    else { const e = S.ents.get(s.carrier); if (e && e.alive) { x = e.rx + Math.sin(e.ryaw) * 0.32; y = e.ry + 0.8; z = e.rz + Math.cos(e.ryaw) * 0.32; sc = 0.5; } }
  }
  SPIKE_MESH.position.set(x, y, z); SPIKE_MESH.scale.setScalar(sc);
  const light = SPIKE_MESH.userData.light;
  if (s.st === 3) {
    const left = Math.max(0, s.pe - serverNow());
    const iv = clamp(left / SPK.FUSE, 0.08, 1) * 1.0;
    beepT -= dt;
    if (beepT <= 0) { beepT = iv; A.sfxBeep(left < 10000 ? 1400 : 1000, clamp(1 - Math.hypot(x - camera.position.x, z - camera.position.z) / 60, 0.08, 0.8)); light.visible = true; setTimeout(() => { light.visible = false; }, 90); }
  } else light.visible = s.st === 2 && Math.floor(performance.now() / 500) % 2 === 0;
}
function updateSpikeInput() {
  if (S.mode !== 'spike') return;
  const s = spState();
  const can = me.alive && s && s.ph === 'live';
  const wantP = !!(can && keys.KeyF && s.st === 1 && s.carrier === S.myId && mySite());
  if (wantP !== !!S.plantOn) { S.plantOn = wantP; send({ t: 'plant', on: wantP }); if (wantP) A.sfxReload(0); }
  const nearSpike = s && s.st === 3 && Math.hypot(s.x - me.x, s.z - me.z) < 1.8;
  const wantD = !!(can && keys.KeyE && nearSpike && myTeam() !== s.atk);
  if (wantD !== !!S.defOn) { S.defOn = wantD; send({ t: 'defuse', on: wantD }); if (wantD) A.sfxReload(1); }
}
function spikeHud(now) {
  const s = spState(); if (!s) return;
  const myT = myTeam(), iAtk = myT === s.atk;
  const side = (t) => `<b style="color:${TEAMS[t].css}">${S.score[t] || 0}</b><span>${t === s.atk ? '공격' : '수비'}${t === myT ? ' (우리)' : ''}</span>`;
  $('sbL').innerHTML = side(myT >= 0 ? myT : 0); $('sbR').innerHTML = side(myT >= 0 ? 1 - myT : 1);
  $('sbRound').textContent = `라운드 ${s.round} · 5승 선승`;
  const left = Math.max(0, (s.pe - now) / 1000);
  const tm = $('sbTime');
  tm.textContent = s.ph === 'buy' ? `구매 ${Math.ceil(left)}` : s.ph === 'end' ? '—' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  tm.classList.toggle('danger', s.st === 3 && s.ph !== 'end');
  $('sbIcon').textContent = s.st === 3 ? `스파이크 설치됨 · ${s.site}` : s.st === 2 ? '스파이크 떨어짐' : s.st === 1 && s.carrier === S.myId ? '스파이크 보유 중' : '';
  const pb = $('plantBar');
  if (s.actor && s.prog > 0 && s.ph === 'live') {
    pb.classList.remove('hidden'); pb.classList.toggle('def', s.st === 3);
    const who = s.actor === S.myId ? '' : `${(S.roster.get(s.actor) || {}).name || '?'} `;
    $('plantLbl').textContent = `${who}${s.st === 3 ? '스파이크 해체 중…' : '스파이크 설치 중…'}`;
    $('plantFill').style.width = Math.round(s.prog * 100) + '%';
  } else pb.classList.add('hidden');
  let hint = '';
  if (me.alive) {
    if (s.ph === 'buy') hint = 'B: 구매 · 라운드 시작까지 움직일 수 없어요';
    else if (s.st === 1 && s.carrier === S.myId) hint = mySite() ? 'F 길게 눌러 스파이크 설치 (4초)' : '스파이크 보유 중 — A나 B 사이트로 가세요';
    else if (s.st === 3 && !iAtk && Math.hypot(s.x - me.x, s.z - me.z) < 1.8) hint = 'E 길게 눌러 해체 (7초)';
    else if (s.st === 3 && !iAtk) hint = '스파이크를 찾아 해체하세요!';
  } else if (S.specId) hint = `관전 중: ${(S.roster.get(S.specId) || {}).name || ''} · Space: 다음 아군`;
  $('spikeHint').textContent = hint;
}
function nextSpectate() {
  const mates = [...S.ents.values()].filter(e => e.alive && (S.mode === 'br' ? !e.boss : isMate(e.id)));
  if (!mates.length) { S.specId = null; return; }
  const i = mates.findIndex(e => e.id === S.specId);
  S.specId = mates[(i + 1) % mates.length].id;
}

function specTarget() {
  if (!S.specId || !(S.ents.get(S.specId) || {}).alive) nextSpectate();
  return S.specId ? S.ents.get(S.specId) : null;
}

/* ================= 킬캠 ================= */
const KC_PRE = 3200, KC_POST = 500;
function kcTime() { return S.kc.at - KC_PRE + (performance.now() - S.kc.start); }
function updateKillcam() {
  const kc = S.kc;
  if (!kc || kc.done) return;
  if (me.alive) { endKc(); return; }
  if (!kc.active) {
    if (performance.now() < kc.start) return;
    const e = S.ents.get(kc.killer);
    if (!e) { kc.done = true; return; }
    kc.active = true; kc.lastT = kc.at - KC_PRE;
    $('death').classList.add('hidden');
    const icon = WEAPONS[kc.w] || kc.w === 'nade' ? `<img src="${gunIcon(kc.w, 1, e.gskin)}">` : '';
    $('kcWho').innerHTML = `<span style="color:${nameColor(kc.killer)}">${esc(e.name)}</span>${icon}${kc.hs ? '<span style="color:#ff6a5a">헤드샷</span>' : ''}`;
  }
  const rt = kcTime();
  if (rt > kc.at + KC_POST) { endKc(); return; }
  for (const sh of S.shotLog) if (sh.t > kc.lastT && sh.t <= rt) replayShot(sh, rt);
  kc.lastT = rt;
}
function endKc() {
  const kc = S.kc; if (!kc) return;
  kc.done = true; kc.active = false;
  $('killcam').classList.add('hidden');
  if (!me.alive && S.inGame) $('death').classList.remove('hidden');
  if (S.ghost) S.ghost.visible = false;
  setViewModel(WS.cur);
}
function replayShot(sh, rt) {
  const kc = S.kc;
  let st;
  if (sh.id === kc.killer) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    st = camera.position.clone().addScaledVector(right, 0.2).addScaledVector(up, -0.17).addScaledVector(fwd, 0.6);
    kc.kick = Math.min(1, kc.kick + 0.4); vm.flashT = 0.05;
    A.sfxShot(sh.w, 0.8, 0);
  } else if (sh.id === S.myId) {
    const g = sampleBuf(S.selfBuf, rt); if (!g) return;
    st = new THREE.Vector3(g.x, g.y + 1.3, g.z);
    A.sfxShot(sh.w, 0.4, 0);
  } else {
    if (String(sh.id)[0] === 't') { const tu = S.turrets.get(sh.id); if (!tu) return; st = turretMuzzle(tu); }
    else { const e = S.ents.get(sh.id); if (!e) return;
    st = muzzleOf(e); }
  }
  flashAt(st, 0.3);
  for (const p of sh.e || []) {
    const end = new THREE.Vector3(p[0], p[1], p[2]);
    tracer(st, end);
    if (p[3]) blood(end, end.clone().sub(st).normalize()); else puff(end, 0xcccccc, 4);
  }
}

/* ================= 메인 루프 ================= */
let lastT = performance.now();
function frame(dt) {
  if (S.inGame) {
    updateKillcam();
    updateMe(dt);
    updateWeapon(dt);
    updateEnts(dt);
    updateProjs(dt);
    updateDrops(dt);
    updateFlags(dt);
    updateTurrets(dt);
    updateShops(dt);
    updateCrates(dt); updatePickups(dt); updateZone(); updateSlamRings(); updateTargets(dt); updateSpike(dt); updateSpikeInput();
    updateStrikes(dt);
    updateParticles(dt);
    updateSmoke(dt);
    updateTracers(dt);
    updateFlashes(dt);
    updateCamera(dt);
    updateViewModel(dt);
    updateHud(dt);
    netSend(dt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    if ((me.alive && !S.selfEmote) || (S.kc && S.kc.active)) renderer.render(viewScene, viewCam);
  } else {
    if (ED.on) { editorFrame(dt); return; }
    renderer.clear();
    if (!$('menu').classList.contains('hidden') && (pv.ch || pv.gun)) {
      if (pv.ch) {
        animChar(pv.ch, dt, 0, 0, false, false, false);
        // 상점에서 고른 감정표현 미리보기
        if (pv.emote && performance.now() < pv.emote.until) { pv.ch.rotation.y = 0; applyEmote(pv.ch, pv.emote.anim, (performance.now() - pv.emote.t0) / 1000); }
        else { if (pv.emote) { clearEmotePose(pv.ch); pv.emote = null; } pv.ch.rotation.y += dt * 0.8; }
      }
      if (pv.gun) pv.gun.rotation.y += dt * 0.6;
      pv.r.render(pv.scene, pv.cam);
    }
  }
}
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  tickSkins(now / 1000); tickAuras(dt);
  if (S.inGame) updateGimmicks(dt);
  frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
initAuth({ send, onReady: onLoggedIn });
connect();

// 테스트/디버그 훅
window.__pf = { ED, edSet: (...a) => edSet(...a), edPlace: () => edPlace(), edRemove: () => edRemove(), doEmote: (i) => doEmote(i), doSpray: () => doSpray(), S, me, WS, ammo, send, frame, keys, onMsg, endKc, profile, switchTo, fullAmmo, setViewModel, camera, fire: () => { WS.trigger = true; WS.semiReady = true; frame(0.016); WS.trigger = false; }, step: (n, dt) => { for (let i = 0; i < (n || 1); i++) frame(dt || 1 / 60); } };
