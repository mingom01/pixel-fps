// 픽셀 스트라이크 — 온라인 서버 (의존성 없음, Node 18+)
// 실행: node server.js  →  http://localhost:8230
// 모드: 개인전(ffa) / 팀 데스매치(tdm) / 깃발 뺏기(ctf), 서버 봇, 블록 파괴 동기화
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const SH = require('./public/js/shared.js');
const { WEAPONS, ITEMS, ECON, P } = SH;
const AUTH = require('./server/auth.js');
const STORE = require('./server/store.js');
const GIM = require('./server/gimmicks.js');
const INCOME = require('./server/income.js');
const USERMAPS = require('./server/maps.js');
// 맵 같이 만들기 세션 (함수들은 아래에 선언돼 있어서 화살표로 감싸서 넘김)
const EDIT = require('./server/editRooms.js')({
  SH, genCode: () => genCode(), log: (t) => log(t), cleanName: (n) => cleanName(n), leaveRoom: (c) => leaveRoom(c),
  gameCheck: (ent) => customFrom(ent).err, toGame: (host, members, ent) => editToGame(host, members, ent),
});
// 맵 파일 (public/js/maps/*.js) 등록
for (const f of fs.readdirSync(path.join(__dirname, 'public', 'js', 'maps')).sort()) if (f.endsWith('.js')) require(path.join(__dirname, 'public', 'js', 'maps', f));

const PORT = Number(process.env.PORT) || 8230;
const ROOT = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const TICK = 50, MAX_ROOM = 12;

function lanIPs() { return Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address); }

/* ---------- HTTP ---------- */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (p === '/auth-config') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); return res.end(JSON.stringify(AUTH.publicConfig())); }
  if (p === '/info') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); return res.end(JSON.stringify({ port: PORT, ips: lanIPs() })); }
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---------- 최소 WebSocket ---------- */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8'), len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x81;
  return Buffer.concat([head, payload]);
}
let nextId = 1;
class Client {
  constructor(socket) {
    this.socket = socket; this.buf = Buffer.alloc(0); this.alive = true;
    this.id = 'p' + (nextId++); this.room = null; this.user = null;
    socket.on('data', d => this.onData(d));
    socket.on('close', () => this.onClose());
    socket.on('error', () => this.onClose());
    this.send({ t: 'hello', id: this.id, ver: SERVER_VER });
  }
  send(obj) { if (!this.alive) return; try { this.socket.write(encodeFrame(typeof obj === 'string' ? obj : JSON.stringify(obj))); } catch (e) { /* */ } }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > 1 << 20) { this.close(); return; }
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1], opcode = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const maskLen = masked ? 4 : 0;
      if (this.buf.length < off + maskLen + len) return;
      const mask = masked ? this.buf.slice(off, off + 4) : null;
      let payload = this.buf.slice(off + maskLen, off + maskLen + len);
      if (masked) { payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
      this.buf = this.buf.slice(off + maskLen + len);
      if (opcode === 8) { this.close(); return; }
      if (opcode === 9) { const h = Buffer.alloc(2); h[0] = 0x8a; h[1] = payload.length; this.socket.write(Buffer.concat([h, payload])); continue; }
      // 큰 메시지(예: 복사해 온 맵 데이터)는 중간 프록시(Render 등)가 여러 조각으로 나눠 보낼 수 있음:
      // 첫 조각(opcode 1, FIN 없음) + 이어지는 조각(opcode 0) 들을 FIN 이 올 때까지 모았다가 한 번에 처리
      const fin = (b0 & 0x80) !== 0;
      if (opcode === 1 || opcode === 0) {
        if (opcode === 1) this.frag = [];
        else if (!this.frag) continue; // 시작 없이 온 이어지는 조각은 버림
        this.frag.push(payload);
        if (!fin) { if (this.frag.reduce((n, f) => n + f.length, 0) > 1 << 20) { this.close(); return; } continue; }
        const whole = Buffer.concat(this.frag); this.frag = null;
        let msg; try { msg = JSON.parse(whole.toString('utf8')); } catch (e) { continue; }
        try { handle(this, msg); } catch (e) { console.error(e); }
      }
    }
  }
  close() { if (!this.alive) return; try { this.socket.end(Buffer.from([0x88, 0x00])); } catch (e) { /* */ } this.onClose(); }
  onClose() { if (!this.alive) return; this.alive = false; leaveRoom(this); EDIT.leave(this, false); try { this.socket.destroy(); } catch (e) { /* */ } }
}
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  new Client(socket);
});

/* ---------- 유틸 ---------- */
const BOT_NAMES = ['픽셀킹', '블록헤드', '네모난총잡이', '도트전사', '큐브맨', '8비트', '조준왕', '헤드샷러', '캠핑족', '뉴비봇', '고인물', '야생의봇', '총알받이', '저격수김씨', '돌격대장', '숨바꼭질', '점프맨', '탄창부족'];
const BOT_SKINS = ['default', 'default', 'default', 'politician', 'student', 'doctor', 'detective', 'idol', 'seonbi', 'angel', 'demon', 'neon', 'soldier', 'ninja', 'robot', 'zombie', 'pirate', 'astro', 'pumpkin', 'king', 'police', 'clown', 'santa', 'firefighter', 'cowboy', 'skeleton', 'knight', 'panda', 'wizard', 'alien', 'samurai', 'hero', 'chef', 'diver', 'gamer', 'vampire', 'cyborg', 'pharaoh', 'masked'];
const BOT_GSKINS = ['default', 'default', 'default', 'camo', 'desert', 'arctic', 'urban', 'woodland', 'digital', 'navy', 'carbon', 'zebra', 'pink', 'mint', 'blood', 'gold', 'fire', 'ice', 'toxic', 'ocean', 'bone', 'tiger', 'redline', 'sunset', 'candy', 'ruby', 'sapphire', 'arcade', 'matrix', 'vapor', 'neon', 'cyber', 'diamond', 'void', 'thunder', 'inferno', 'plasma', 'oni', 'lava'];
const BOT_TITLES = ['rookie', 'rookie', 'lv5', 'k1', 'w1', 'pixel', 'camper', 'lv10', 'k100', 'hunter', 'shadow'];
const COLORS = 12;
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function cleanName(s) { return String(s || '').replace(/[<>&"'`]/g, '').trim().slice(0, 10) || '플레이어'; }
function cleanId(s) { return String(s || 'default').replace(/[^a-z0-9_]/gi, '').slice(0, 16) || 'default'; }
function num(v, d) { v = Number(v); return Number.isFinite(v) ? v : d; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function genCode() { let c; do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(c) || EDIT.has(c)); return c; }
function log(s) { console.log(new Date().toLocaleTimeString() + '  ' + s); }
const teamMode = (r) => ['tdm', 'ctf', 'spike', 'zombie', 'boss', 'ability'].includes(r.cfg.mode);
const isAbility = (r) => r.cfg.mode === 'ability';
const { HEROES, ABIL, RANKED } = SH;
const cleanHero = (h) => (HEROES[h] ? h : 'jett');
// 무기 숙련도 위장 (무기별): { rifle: 'm_gold', ... }
const MASTERY_CAMOS = ['m_bronze', 'm_silver', 'm_gold', 'm_diamond', 'm_dark'];
function cleanWc(o) {
  const out = {};
  if (o && typeof o === 'object') for (const k of Object.keys(o).slice(0, 30)) if (WEAPONS[k] && MASTERY_CAMOS.includes(o[k])) out[k] = o[k];
  return out;
}
const isZombie = (r) => r.cfg.mode === 'zombie';
const isGG = (r) => r.cfg.mode === 'gungame';
const isBR = (r) => r.cfg.mode === 'br';
const isBoss = (r) => r.cfg.mode === 'boss';
const SPK = SH.SPK;
const isSpike = (r) => r.cfg.mode === 'spike';
const isPractice = (r) => r.cfg.mode === 'practice';

// 서버가 새로 뜰 때마다 바뀌는 값 → 열려 있던 옛 화면에 새로고침하라고 알려줌
const SERVER_VER = Date.now().toString(36);
const rooms = new Map();

/* ---------- 랭킹 (계정 저장소의 '__rank' 칸에 저장: Supabase 또는 data/users.json) ---------- */
const RANK_ID = '__rank';
let rankDb = {};
STORE.get(RANK_ID).then(d => {
  if (d) rankDb = Object.assign(d, rankDb);
  else { try { Object.assign(rankDb, JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'rank.json'), 'utf8'))); } catch (e) { /* 옛 랭킹 파일 없음 */ } }
  STORE.set(RANK_ID, rankDb);
}).catch(e => console.log('랭킹 불러오기 실패: ' + e.message));
function saveRank() { STORE.set(RANK_ID, rankDb); }
// 경쟁전 점수는 서버가 계정별로 보관 (브라우저가 보낸 값은 처음 한 번만, 300점까지만 믿음)
const RP_ID = '__rp';
let rpDb = {};
STORE.get(RP_ID).then(d => { if (d) rpDb = Object.assign(d, rpDb); STORE.set(RP_ID, rpDb); }).catch(e => console.log('경쟁전 점수 불러오기 실패: ' + e.message));
function setRp(e, v) { e.rp = Math.max(0, Math.round(v)); if (e.sub) { rpDb[e.sub] = e.rp; STORE.set(RP_ID, rpDb); } }
function recordMatch(r, rank, win) {
  if (isPractice(r)) return;
  const first = rank[0] && rank[0].id;
  for (const e of r.ents.values()) {
    if (e.bot) continue;
    const rec = rankDb[e.name] || (rankDb[e.name] = { kills: 0, deaths: 0, wins: 0, games: 0, lv: 1, skin: 'default', color: 0 });
    rec.kills += e.kills; rec.deaths += e.deaths; rec.games++;
    const won = win != null ? e.team === win : e.id === first;
    if (won) rec.wins++;
    rec.lv = e.lv; rec.skin = e.skin; rec.color = e.color; rec.last = Date.now();
    if (r.cfg.ranked) { rec.rp = e.rp || 0; rec.rgames = (rec.rgames || 0) + 1; }
  }
  saveRank();
}
function rankLists() {
  const all = Object.entries(rankDb).map(([name, v]) => Object.assign({ name }, v));
  const top = (arr, f) => arr.slice().sort((a, b) => f(b) - f(a)).slice(0, 20);
  return {
    kills: top(all, v => v.kills),
    wins: top(all, v => v.wins),
    kd: top(all.filter(v => v.kills >= 20), v => v.kills / Math.max(1, v.deaths)),
    rp: top(all.filter(v => v.rgames), v => v.rp || 0),
    total: all.length,
  };
}

function newEnt(id, name, color, bot) {
  return {
    id, name, color, bot, team: -1, skin: 'default', gskin: 'default', lv: 1,
    hp: 100, armor: 0, money: ECON.START, kills: 0, deaths: 0, streak: 0, caps: 0,
    alive: false, respawnAt: 0, protUntil: 0, buyUntil: 0, primary: null, secondary: 'pistol', nades: 0,
    x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fl: 0, w: 'pistol', lastBuy: [],
    helmet: false, perks: {}, sup: { turret: 0, air: 0 }, maxHp: 100, multi: 0, lastKillT: 0,
  };
}

function cleanCfg(c, old) {
  c = c || {}; old = old || { map: 'village', bots: 5, time: 300, kills: 25, mode: 'ffa', diff: 'normal' };
  return {
    map: SH.MAPS[c.map] || c.map === 'custom' ? c.map : old.map,
    bots: clamp(Math.round(num(c.bots, old.bots)), 0, MAX_ROOM - 1),
    time: [180, 300, 600].includes(num(c.time, 0)) ? num(c.time, 0) : old.time,
    kills: [15, 25, 40].includes(num(c.kills, 0)) ? num(c.kills, 0) : old.kills,
    mode: SH.MODES[c.mode] ? c.mode : old.mode,
    diff: SH.DIFFS[c.diff] ? c.diff : old.diff,
    // 랜덤: 매 판 시작할 때 모드/맵을 새로 뽑음
    rmode: c.rmode != null ? !!c.rmode : !!old.rmode,
    rmap: c.rmap != null ? !!c.rmap : !!old.rmap,
    ranked: !!old.ranked, // 경쟁전 방은 서버가 정함 (사용자가 못 바꿈)
  };
}
const RANDOM_MODES = ['ffa', 'tdm', 'ctf', 'spike', 'zombie', 'gungame', 'br', 'boss', 'ability'];
const mapKind = (id) => id === 'custom' ? 'normal' : (SH.MAPS[id] && SH.MAPS[id].kind) || 'normal';
function rollRandom(r) {
  const c = r.cfg;
  if (c.mode === 'practice') return;
  if (c.rmode) c.mode = pick(RANDOM_MODES);
  const want = c.mode === 'spike' ? 'spike' : 'normal';
  if (c.rmap || c.rmode || mapKind(c.map) !== want) c.map = pick(Object.keys(SH.MAPS).filter(id => mapKind(id) === want));
}
function fixCfg(cfg) {
  const kind = cfg.map === 'custom' ? 'normal' : SH.MAPS[cfg.map].kind || 'normal';
  if (cfg.mode === 'spike' && kind !== 'spike') cfg.map = 'oasis';
  if (cfg.mode === 'practice') cfg.map = 'range';
  if (cfg.mode !== 'spike' && cfg.mode !== 'practice' && kind !== 'normal') cfg.map = 'village';
  return cfg;
}

// 클라가 보낸 내 맵 → 방에 넣을 형태 ({ custom } 또는 { err })
function customFrom(o) {
  const cm = SH.mapFromData(o);
  if (!cm) return { err: '맵 데이터가 이상해요' };
  if (cm.spawns.length < 2) return { err: '스폰할 곳이 부족해요. 위가 뚫린 3×3 이상 평평한 땅이 2곳 이상 필요해요' };
  const name = String(o.name || '내 맵').replace(/[<>&"'`]/g, '').slice(0, 16);
  return { custom: { id: /^[a-z0-9_-]{1,32}$/i.test(String(o.id || '')) ? String(o.id) : null, name, map: cm, obj: { W: o.W, H: o.H, D: o.D, data: o.data, theme: cm.theme, name } } };
}
// 맵 같이 만들기 → 다 같이 테스트: 그 맵으로 게임 방을 만들고 편집하던 사람 모두 들어가서 바로 시작
function editToGame(host, members, ent) {
  const cu = customFrom(ent); if (cu.err) return;
  const r = createRoom(host, { map: 'village', mode: 'ffa', bots: 5, time: 300, kills: 25, diff: 'normal' }, false);
  r.custom = cu.custom; r.cfg.map = 'custom';
  const hm = members.find(m => m.c === host);
  joinRoom(host, r, hm ? hm.info : {});
  for (const m of members) if (m.c !== host && m.c.alive) joinRoom(m.c, r, m.info);
  startMatch(r);
}
function createRoom(c, cfg, isPublic) {
  const code = genCode();
  const r = { code, hostId: c.id, cfg: fixCfg(cleanCfg(cfg)), state: 'wait', ents: new Map(), clients: new Set(), projs: [], drops: new Map(), pid: 1, endAt: 0, timer: null, pub: isPublic !== false, score: [0, 0], flags: null, broken: [] };
  rooms.set(code, r);
  log(`방 ${code} 생성`);
  return r;
}
function broadcast(r, obj, except) { const s = JSON.stringify(obj); for (const c of r.clients) if (c !== except) c.send(s); }
function roster(r) { return [...r.ents.values()].map(e => ({ id: e.id, name: e.name, color: e.color, bot: e.bot, k: e.kills, d: e.deaths, team: e.team, skin: e.skin, gskin: e.gskin, title: e.title, lv: e.lv, caps: e.caps, boss: !!e.boss, zombie: !!e.zombie, gg: e.gg || 0, hero: e.hero, rp: e.bot ? null : e.rp, wc: e.wc, charm: e.charm })); }
function roomMsg(r) { return { t: 'room', autoAt: r.autoAt || 0, waitSince: r.waitSince || 0, customName: r.custom ? r.custom.name : null, customId: r.custom ? r.custom.id : null, code: r.code, host: r.hostId, cfg: r.cfg, state: r.state, endAt: r.endAt, score: r.score, players: roster(r) }; }
function pushRoom(r) { broadcast(r, roomMsg(r)); }
function meMsg(e) { return { t: 'me', hp: Math.ceil(e.hp), armor: Math.ceil(e.armor), money: e.money, primary: e.primary, secondary: e.secondary, nades: e.nades, alive: e.alive, buyUntil: e.buyUntil, respawnAt: e.respawnAt, zombie: !!e.zombie, gg: e.gg || 0, helmet: e.helmet, perks: Object.keys(e.perks), sup: e.sup, maxHp: e.maxHp, hero: e.hero, qAt: e.qAt || 0, ult: Math.floor(e.ult || 0), haste: e.hasteUntil || 0, steel: e.steelUntil || 0, invis: e.invisUntil || 0 }; }
function clientOf(r, id) { for (const c of r.clients) if (c.id === id) return c; return null; }
function sendMe(r, e) { if (e.bot) return; const c = clientOf(r, e.id); if (c) c.send(meMsg(e)); }

function joinRoom(c, r, m) {
  leaveRoom(c); EDIT.leave(c);
  c.room = r; r.clients.add(c);
  const e = newEnt(c.id, cleanName(m.name), clamp(Math.round(num(m.color, 0)), 0, COLORS - 1), false);
  e.skin = cleanId(m.skin); e.gskin = cleanId(m.gskin); e.title = cleanId(m.title); e.lv = clamp(Math.round(num(m.lv, 1)), 1, 999);
  e.charm = m.charm ? cleanId(m.charm) : null;
  e.hero = cleanHero(m.hero); e.wc = cleanWc(m.wc);
  e.sub = c.user ? c.user.sub : null;
  e.rp = e.sub && rpDb[e.sub] != null ? rpDb[e.sub] : clamp(Math.round(num(m.rp, 0)), 0, 300);
  r.ents.set(c.id, e);
  fitBots(r);
  c.send(roomMsg(r));
  pushRoom(r);
  if (r.state === 'play') {
    c.send(startMsg(r));
    e.money = isSpike(r) ? SPK.START : ECON.START; e.respawnAt = isSpike(r) || isBR(r) ? 0 : Date.now() + 500;
    if (isZombie(r) && r.zb && r.zb.started) infect(r, e, false);
    if (isSpike(r) && r.sp) c.send(roundMsg(r, false));
  }
  broadcast(r, { t: 'sys', text: `${e.name} 님이 들어왔습니다` }, c);
}
function leaveRoom(c) {
  const r = c.room; if (!r) return;
  c.room = null; r.clients.delete(c);
  const e = r.ents.get(c.id);
  // 경쟁전 도중에 나가면 -15점
  if (e && r.cfg.ranked && r.state === 'play') setRp(e, (e.rp || 0) - 15);
  r.ents.delete(c.id);
  if (!r.clients.size) { clearTimeout(r.timer); rooms.delete(r.code); log(`방 ${r.code} 삭제`); return; }
  if (r.hostId === c.id) r.hostId = [...r.clients][0].id;
  if (e) broadcast(r, { t: 'sys', text: `${e.name} 님이 나갔습니다` });
  broadcast(r, { t: 'gone', id: c.id });
  fitBots(r);
  pushRoom(r);
}
function skillFor(r) {
  if (r.cfg.ranked && r.rankSkill != null) return clamp(r.rankSkill + (Math.random() - 0.5) * 0.16, 0.1, 0.97); // 경쟁전: 평균 점수에 맞춘 봇
  const [a, b] = SH.DIFFS[r.cfg.diff].skill; return a + Math.random() * (b - a);
}
function addBot(r, team) {
  const used = new Set([...r.ents.values()].filter(e => e.bot).map(b => b.name));
  let i = 1, id; do { id = 'b' + (i++); } while (r.ents.has(id));
  const name = pick(BOT_NAMES.filter(n => !used.has(n))) || ('봇' + i);
  const b = newEnt(id, name, Math.floor(Math.random() * COLORS), true);
  b.skin = pick(BOT_SKINS); b.gskin = pick(BOT_GSKINS); b.lv = 1 + Math.floor(Math.random() * 30); b.title = pick(BOT_TITLES);
  b.skill = skillFor(r);
  b.hero = pick(Object.keys(HEROES));
  if (team === 0 || team === 1) { b.team = team; b.teamLock = true; }
  if (isPractice(r)) { b.dummy = true; b.name = '허수아비 ' + i; b.skin = 'default'; }
  if (r.state === 'play') b.respawnAt = Date.now() + 1000;
  r.ents.set(id, b);
  return b;
}
function removeBot(r, b) {
  b.alive = false; r.ents.delete(b.id);
  broadcast(r, { t: 'gone', id: b.id });
  if (r.turrets) for (const t of r.turrets) if (t.owner === b.id) t.hp = 0;
}
// 봇 인원: cfg.bots = 혼자 할 때의 봇 수 → 전체 인원은 bots + 1 로 고정
// 대기실에는 사람만 있고, 게임이 시작되면 빈자리를 봇으로 채움.
// 게임 도중 사람이 들어오면 봇 한 명과 자리를 바꾸고, 나가면 다시 봇으로 채움
const botTarget = (r) => Math.max(0, Math.min(MAX_ROOM, r.cfg.bots + 1) - r.clients.size);
const botsOf = (r) => [...r.ents.values()].filter(e => e.bot && !e.boss && !e.minion);
function fitBots(r) {
  const want = r.state === 'wait' ? 0 : botTarget(r);
  ensureTeams(r); // 새로 들어온 사람 팀부터 정함
  let list = botsOf(r);
  while (list.length > want) {
    // 사람이 많은 팀(사람+봇) 쪽 봇부터, 죽어 있는 봇 우선으로 뺌
    const cnt = [0, 0]; for (const e of r.ents.values()) if (e.team >= 0 && !e.boss && !e.minion) cnt[e.team]++;
    const big = cnt[0] > cnt[1] ? 0 : cnt[1] > cnt[0] ? 1 : -2;
    const pool = list.filter(b => big === -2 || b.team === big);
    const pickb = (pool.length ? pool : list).sort((a, b) => (a.alive ? 1 : 0) - (b.alive ? 1 : 0))[0];
    removeBot(r, pickb); list = botsOf(r);
  }
  while (list.length < want) { list.push(addBot(r)); ensureTeams(r); }
}
// 팀 배정: 사람은 고른 팀 유지, 봇으로 인원 맞춤
function ensureTeams(r) {
  const all = [...r.ents.values()];
  if (!teamMode(r)) { for (const e of all) e.team = -1; return; }
  if (isZombie(r)) { for (const e of all) e.team = e.zombie ? 1 : 0; return; }
  if (isBoss(r)) { for (const e of all) e.team = e.boss || e.minion ? 1 : 0; return; }
  const play = r.state !== 'wait';
  const keep = (e) => e.team >= 0 && (!e.bot || e.teamLock || play);
  const cnt = [0, 0];
  for (const e of all) if (keep(e)) cnt[e.team]++;
  for (const e of all) if (!e.bot && !keep(e)) { e.team = cnt[0] <= cnt[1] ? 0 : 1; cnt[e.team]++; }
  for (const e of all) if (e.bot && !keep(e)) { e.team = cnt[0] <= cnt[1] ? 0 : 1; cnt[e.team]++; }
}

/* ---------- 매치 ---------- */
function startMsg(r) {
  return { t: 'start', custom: r.cfg.map === 'custom' && r.custom ? r.custom.obj : null, map: r.cfg.map, mode: r.cfg.mode, endAt: r.endAt, target: SH.targetOf(r.cfg), now: Date.now(), drops: [...r.drops.values()], broken: r.broken, score: r.score, pk: (r.pickups || []).map(p => [p.id, p.readyAt]), gim: GIM.snapshot(r) };
}
function startMatch(r) {
  rollRandom(r);
  r.state = 'play'; r.projs = []; r.drops.clear(); r.broken = []; r.walls = []; r.ultT = Date.now(); r.score = [0, 0]; r.turrets = []; r.strikes = []; r.crates = []; r.sp = null;
  r.nextCrate = Date.now() + 35000;
  if (r.cfg.map === 'custom' && !r.custom) r.cfg.map = 'village';
  r.map = r.cfg.map === 'custom' ? r.custom.map.clone() : SH.getMap(r.cfg.map).clone();
  GIM.start(r);
  r.pickups = isSpike(r) || isPractice(r) ? [] : r.map.pickups.map(p => Object.assign({ readyAt: 0 }, p));
  r.endAt = Date.now() + (isSpike(r) || isPractice(r) ? 3 * 3600 : Number(process.env.TEST_MATCH_SEC) || r.cfg.time) * 1000; // TEST_MATCH_SEC: 테스트 서버에서만 판 시간 줄이기
  INCOME.start(r, Date.now());
  fitBots(r);
  for (const e of r.ents.values()) if (e.bot) e.skill = skillFor(r);
  r.flags = r.cfg.mode === 'ctf' ? [0, 1].map(t => { const b = r.map.bases[t]; return { team: t, home: b.slice(), x: b[0], y: b[1], z: b[2], carrier: null, atHome: true, dropAt: 0 }; }) : null;
  const now = Date.now();
  for (const e of r.ents.values()) {
    Object.assign(e, { ult: 0, qAt: 0, hasteUntil: 0, steelUntil: 0, invisUntil: 0 });
    Object.assign(e, { hp: 100, armor: 0, money: ECON.START, kills: 0, deaths: 0, streak: 0, caps: 0, alive: false, primary: null, secondary: 'pistol', nades: 0, respawnAt: now + 200 + Math.random() * 300, helmet: false, perks: {}, sup: { turret: 0, air: 0 }, maxHp: 100 });
  }
  if (isSpike(r)) for (const e of r.ents.values()) { e.money = SPK.START; e.respawnAt = 0; }
  if (isPractice(r)) for (const e of r.ents.values()) e.money = 16000;
  log(`방 ${r.code} 매치 시작 (${r.cfg.map}, ${r.cfg.mode}, 봇 ${[...r.ents.values()].filter(e => e.bot).length} ${r.cfg.diff})`);
  broadcast(r, startMsg(r));
  pushRoom(r);
  if (isSpike(r)) spikeStart(r);
  modeStart(r);
}
function endMatch(r) {
  if (r.state !== 'play') return;
  if (isZombie(r)) { const humans = [...r.ents.values()].filter(e => !e.zombie).length; r.score = humans > 0 ? [1, 0] : [0, 1]; }
  if (isBoss(r)) { const b = r.ents.get('boss'); r.score = b && b.alive ? [0, 1] : [1, 0]; }
  r.state = 'end';
  const key = (e) => isGG(r) ? (e.gg || 0) * 1000 + e.kills : isBR(r) ? -(e.place || 99) * 1000 + e.kills : isBoss(r) ? (e.bossDmg || 0) : 0;
  const rank = [...r.ents.values()].filter(e => !e.boss && !e.minion).sort((a, b) => key(b) - key(a) || (b.caps - a.caps) * (r.cfg.mode === 'ctf' ? 1 : 0) || b.kills - a.kills || a.deaths - b.deaths)
    .map(e => ({ id: e.id, name: e.name, color: e.color, bot: e.bot, k: e.kills, d: e.deaths, team: e.team, caps: e.caps, lv: e.lv, title: e.title, gg: e.gg, place: e.place, dmg: Math.round(e.bossDmg || 0), zombie: !!e.zombie }));
  for (const e of r.ents.values()) if (e.origSkin) { e.skin = e.origSkin; e.origSkin = null; }
  for (const e of [...r.ents.values()]) if (e.boss || e.minion) { r.ents.delete(e.id); broadcast(r, { t: 'gone', id: e.id }); }
  const win = teamMode(r) ? (r.score[0] > r.score[1] ? 0 : r.score[1] > r.score[0] ? 1 : -1) : null;
  const rp = r.cfg.ranked ? rankedResult(r, rank, win) : null;
  try { recordMatch(r, rank, win); } catch (e) { console.error(e); }
  broadcast(r, { t: 'end', rank, mode: r.cfg.mode, win, score: r.score, ranked: !!r.cfg.ranked, rp });
  log(`방 ${r.code} 매치 종료 — ${teamMode(r) ? '점수 ' + r.score.join(':') : '1위 ' + (rank[0] && rank[0].name)}`);
  clearTimeout(r.timer);
  r.timer = setTimeout(() => { if (r.state !== 'end') return; r.state = 'wait'; r.waitSince = Date.now(); fitBots(r); pushRoom(r); }, 6000);
}
// 경쟁전 점수 변화: 이기면 크게, 져도 낮은 티어에선 조금 오름. 활약(킬·데스·순위)에 따라 보너스
function rankedResult(r, rank, win) {
  const out = {};
  rank.forEach((p, i) => {
    const e = r.ents.get(p.id); if (!e || e.bot) return;
    const won = win != null ? (win >= 0 && e.team === win) : i === 0;
    const draw = win === -1;
    const sk = e.sub ? rpDb['s:' + e.sub] || 0 : 0; // 연승(+)/연패(-) 기록
    const c = RANKED.calc({ rp: e.rp || 0, win: won, draw, kills: e.kills, deaths: e.deaths, place: i, streak: sk });
    if (e.sub) rpDb['s:' + e.sub] = c.streak;
    const before = e.rp || 0;
    setRp(e, before + c.d);
    out[e.id] = { d: c.d, before, after: e.rp, win: won, draw, base: c.base, perf: c.perf, str: c.str, streak: c.streak, kd: c.kd };
  });
  return out;
}
function addScore(r, team, n) {
  r.score[team] += n;
  broadcast(r, { t: 'score', s: r.score });
  if (r.score[team] >= SH.targetOf(r.cfg)) endMatch(r);
}

function pickSpawn(r, e) {
  if (isPractice(r) && r.map.range) return pick(e.dummy ? r.map.range.dummy : r.map.range.spawn);
  const sp = teamMode(r) && e.team >= 0 ? r.map.teamSpawns[e.team] : r.map.spawns;
  const enemies = [...r.ents.values()].filter(o => o !== e && o.alive && (e.team < 0 || o.team !== e.team));
  const scored = sp.map(s => {
    let md = 999;
    for (const o of enemies) md = Math.min(md, Math.hypot(o.x - s[0], o.z - s[2]) + (Math.abs(o.y - s[1]) * 0.5));
    return { s, md: md + Math.random() * 6 };
  }).sort((a, b) => b.md - a.md);
  return scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
}
function respawn(r, e) {
  const s = pickSpawn(r, e), now = Date.now();
  // 파괴로 바닥이 꺼졌으면 위쪽 빈 곳으로
  let y = s[1];
  while (y < r.map.H - 2 && SH.bodyHits(r.map, s[0], y, s[2], P.H)) y++;
  Object.assign(e, { alive: true, hp: e.maxHp || 100, x: s[0], y, z: s[2], protUntil: now + ECON.PROTECT, buyUntil: now + ECON.BUY_TIME, w: e.primary || e.secondary });
  e.yaw = Math.atan2(-(r.map.W / 2 - s[0]), -(r.map.D / 2 - s[2]));
  e.pitch = 0;
  if (isZombie(r) && e.zombie) { Object.assign(e, { primary: null, secondary: null, w: 'claw', hp: e.maxHp, armor: 0, helmet: false, buyUntil: 0 }); }
  else if (isZombie(r)) e.buyUntil = r.zb ? r.zb.infectAt : now + ECON.BUY_TIME;
  if (isGG(r)) { applyGG(r, e, true); e.buyUntil = 0; }
  if (isBR(r)) { Object.assign(e, { primary: null, secondary: null, w: 'knife', buyUntil: 0, brIn: true }); }
  if (e.bot) { botSpawn(r, e); return; }
  const c = clientOf(r, e.id);
  if (c) c.send({ t: 'spawn', x: e.x, y: e.y, z: e.z, yaw: e.yaw, prot: e.protUntil });
  sendMe(r, e);
}
const sameTeam = (r, a, b) => teamMode(r) && a && b && a !== b && a.team >= 0 && a.team === b.team;

function damage(r, v, a, dmg, w, part, splash) {
  if (!v || !v.alive || r.state !== 'play') return;
  const now = Date.now();
  if (now < v.protUntil) return;
  if (a && a !== v && a.alive === false && !splash) return;
  if (sameTeam(r, a, v)) return; // 아군 피해 없음
  dmg = Math.max(0, dmg);
  if (v.steelUntil > now) dmg *= 0.4; // 철벽 궁극기
  if (part === 'head' && v.helmet) dmg *= 0.65;
  if (v.armor > 0) { const ab = Math.min(v.armor, dmg * 0.5); v.armor -= ab; dmg -= ab; }
  v.hp -= dmg;
  if (v.boss && a) a.bossDmg = (a.bossDmg || 0) + dmg;
  if (!v.bot) { const c = clientOf(r, v.id); if (c) c.send({ t: 'dmg', from: a ? a.id : null, amt: Math.round(dmg), hp: Math.max(0, Math.ceil(v.hp)), armor: Math.ceil(v.armor), ax: a ? a.x : v.x, az: a ? a.z : v.z }); }
  else if (a && a !== v) { v.botAlert = a.id; }
  if (v.hp <= 0) kill(r, v, a, w, part === 'head');
}
function kill(r, v, a, w, hs) {
  const now = Date.now();
  v.alive = false; v.hp = 0; v.deaths++; v.streak = 0; v.multi = 0; v.invisUntil = 0; v.hasteUntil = 0; v.steelUntil = 0;
  v.respawnAt = isSpike(r) || isBR(r) ? 0 : isPractice(r) ? now + 1500 : isZombie(r) ? now + 3000 : now + ECON.RESPAWN;
  if (v.minion) { v.respawnAt = 0; setTimeout(() => { if (r.ents.get(v.id) === v && !v.alive) removeBot(r, v); }, 2500); }
  if (isBR(r)) { v.place = [...r.ents.values()].filter(e => e.alive).length + 1; }
  v.armor = 0; v.nades = 0; v.helmet = false;
  if (r.flags) for (const f of r.flags) if (f.carrier === v.id) dropFlag(r, f, v);
  const dropW = isGG(r) || v.zombie ? [] : isBR(r) ? [v.primary, v.secondary] : [v.primary];
  for (const dw of dropW) {
    if (!dw) continue;
    const id = 'd' + (r.pid++);
    const d = { id, w: dw, x: v.x + (Math.random() - 0.5), y: v.y + 0.3, z: v.z + (Math.random() - 0.5), until: now + (isBR(r) ? 1e9 : 40000) };
    r.drops.set(id, d);
    broadcast(r, { t: 'drop', d });
  }
  if (!isGG(r)) { v.primary = null; if (isBR(r)) v.secondary = null; }
  if (isZombie(r) && !v.zombie) infect(r, v, false);
  const MAXM = isSpike(r) ? SPK.MAX : ECON.MAX;
  if (!isSpike(r)) v.money = Math.min(MAXM, v.money + ECON.DEATH);
  let reward = 0;
  if (a && a !== v) {
    a.kills++; a.streak = (a.streak || 0) + 1;
    if (isAbility(r)) a.ult = Math.min(ABIL.ULT_MAX, (a.ult || 0) + 1);
    a.multi = now - (a.lastKillT || 0) < 4500 ? (a.multi || 0) + 1 : 1; a.lastKillT = now;
    reward = isSpike(r) ? SPK.KILL : (WEAPONS[w] ? WEAPONS[w].reward : 300) + (hs ? ECON.HEADSHOT : 0);
    a.money = Math.min(MAXM, a.money + reward);
    if (a.streak === 3 && !isSpike(r)) a.money = Math.min(MAXM, a.money + 500);
    if (isPractice(r)) a.money = 16000;
    sendMe(r, a);
  } else if (a === v) v.kills = Math.max(0, v.kills - 1);
  if (isGG(r) && a && a !== v) {
    if (w === 'knife' && (v.gg || 0) > 0) { v.gg--; broadcast(r, { t: 'sys', text: `${v.name} 님이 칼에 맞아 레벨 다운!` }); }
    a.gg = (a.gg || 0) + 1;
    if (a.gg >= SH.GG_LADDER.length) { sendMe(r, v); broadcast(r, { t: 'kill', k: a.id, v: v.id, w, hs: !!hs, reward, streak: a.streak, multi: a.multi }); endMatch(r); return; }
    applyGG(r, a, false);
  }
  if (isGG(r) && v.gg != null) applyGG(r, v, true);
  sendMe(r, v);
  broadcast(r, { t: 'kill', k: a ? a.id : null, v: v.id, w, hs: !!hs, reward, streak: a ? a.streak : 0, multi: a && a !== v ? a.multi : 0, infect: isZombie(r) && v.zombie && a && a.zombie });
  pushRoom(r);
  if (v.boss) { endMatch(r); return; }
  if (a && a !== v) {
    if ((r.cfg.mode === 'tdm' || isAbility(r)) && a.team >= 0) addScore(r, a.team, 1);
    else if (r.cfg.mode === 'ffa' && a.kills >= SH.targetOf(r.cfg)) endMatch(r);
  }
}

/* ---------- 깃발 ---------- */
function flagMsg(r, ev, f, id) { broadcast(r, { t: 'flag', ev, team: f.team, id: id || null }); }
function dropFlag(r, f, c) {
  f.carrier = null; f.atHome = false; f.dropAt = Date.now();
  if (c) { f.x = c.x; f.y = c.y; f.z = c.z; }
  if (f.y < 1) { returnFlag(r, f, null); return; }
  flagMsg(r, 'drop', f, c ? c.id : null);
}
function returnFlag(r, f, by) {
  f.carrier = null; f.atHome = true; f.x = f.home[0]; f.y = f.home[1]; f.z = f.home[2];
  flagMsg(r, 'return', f, by ? by.id : null);
  if (by) { by.money = Math.min(ECON.MAX, by.money + 300); sendMe(r, by); }
}
const near = (e, f, d) => Math.hypot(e.x - f.x, e.z - f.z) < d && Math.abs(e.y - f.y) < 2;
function ctfTick(r, now) {
  for (const f of r.flags) {
    if (f.carrier) {
      const c = r.ents.get(f.carrier);
      if (!c || !c.alive) { dropFlag(r, f, c); continue; }
      f.x = c.x; f.y = c.y; f.z = c.z;
    } else if (!f.atHome) {
      // 바닥이 사라졌으면 떨어짐
      while (f.y > 1 && !r.map.solid(Math.floor(f.x), Math.floor(f.y - 0.05), Math.floor(f.z))) f.y = Math.max(1, f.y - 0.5);
      if (now - f.dropAt > 20000) returnFlag(r, f, null);
    }
  }
  for (const e of r.ents.values()) {
    if (!e.alive || e.team < 0 || r.state !== 'play') continue;
    const own = r.flags[e.team], en = r.flags[1 - e.team];
    if (!en.carrier && near(e, en, 1.4)) { en.carrier = e.id; en.atHome = false; flagMsg(r, 'take', en, e.id); }
    if (!own.carrier && !own.atHome && near(e, own, 1.4)) returnFlag(r, own, e);
    if (en.carrier === e.id && own.atHome && near(e, own, 1.8)) {
      e.caps++; e.money = Math.min(ECON.MAX, e.money + 1000); sendMe(r, e);
      en.carrier = null; en.atHome = true; en.x = en.home[0]; en.y = en.home[1]; en.z = en.home[2];
      flagMsg(r, 'cap', en, e.id);
      pushRoom(r);
      addScore(r, e.team, 1);
    }
  }
}

/* ---------- 폭발 / 블록 파괴 ---------- */
function explode(r, x, y, z, owner, kind) {
  const W = ITEMS[kind] || ITEMS.nade;
  const rad = W.radius, w = kind;
  const a = r.ents.get(owner);
  for (const t of r.turrets || []) {
    if (a && teamMode(r) && t.team === a.team && t.owner !== owner) continue;
    const d = Math.hypot(t.x - x, t.y + 0.6 - y, t.z - z);
    if (d < rad) { t.hp -= W.dmg * (1 - d / rad * 0.7); if (t.owner !== owner) t.lastHitBy = owner; }
  }
  // 피해 판정은 블록 파괴 전 지형 기준
  const hits = [];
  for (const e of r.ents.values()) {
    if (!e.alive) continue;
    const cy = e.y + 0.9, d = Math.hypot(e.x - x, cy - y, e.z - z);
    if (d > rad) continue;
    const len = d || 0.001, h = SH.raycast(r.map, x, y, z, (e.x - x) / len, (cy - y) / len, (e.z - z) / len, d);
    if (h && h.t < d - 0.4) continue;
    let dmg = W.dmg * (1 - (d / rad) * 0.85);
    if (e.id === owner) dmg *= 0.45;
    hits.push([e, dmg]);
  }
  const protect = (bx, by, bz) => r.flags && r.flags.some(f => Math.abs(bx + 0.5 - f.home[0]) < 2.5 && Math.abs(bz + 0.5 - f.home[2]) < 2.5 && by < f.home[1] + 1);
  const removed = SH.blast(r.map, x, y, z, W.blast || 2.0, protect);
  if (removed.length) { r.broken.push(...removed); updateWalk(r.map, removed); }
  broadcast(r, { t: 'boom', x, y, z, r: rad, kind, by: owner, blk: removed });
  for (const [e, dmg] of hits) damage(r, e, a || null, dmg, w, 'body', true);
}

function buy(r, e, item) {
  const now = Date.now();
  const dead = !e.alive;
  if (r.state !== 'play') return 'dead';
  if (isGG(r) || isBR(r) || e.zombie || (dead && isZombie(r))) return 'mode';
  // 죽어 있는 동안에도 다음 부활 때 쓸 장비를 살 수 있어요 (스파이크는 라운드제라 제외)
  if (dead && (isSpike(r) || item === 'medkit' || item === 'ammo')) return 'dead';
  if (!dead && now > e.buyUntil && !nearShop(r, e) && !isPractice(r)) return 'time';
  const W = WEAPONS[item], I = ITEMS[item];
  if (!W && (!I || !I.price)) return 'bad';
  const price = isPractice(r) ? 0 : W ? W.price : I.price;
  if (e.money < price) return 'money';
  if (W) {
    if (W.slot === 'primary') { if (e.primary === item) return 'have'; e.primary = item; }
    else if (W.slot === 'secondary') { if (e.secondary === item) return 'have'; e.secondary = item; }
    else return 'bad';
  } else if (item === 'armor') { if (e.armor >= 100) return 'have'; e.armor = 100; }
  else if (item === 'nade') { if (e.nades >= I.max) return 'have'; e.nades++; }
  else if (item === 'helmet') { if (e.helmet) return 'have'; e.helmet = true; }
  else if (item === 'medkit') { if (e.hp >= e.maxHp) return 'have'; e.hp = e.maxHp; }
  else if (item === 'ammo') { /* 탄약은 클라가 채움 */ }
  else if (I.perk) { if (e.perks[item]) return 'have'; e.perks[item] = 1; if (item === 'perk_hp') { e.maxHp = 125; e.hp += 25; } }
  else if (item === 'uav') broadcast(r, { t: 'uav', by: e.id, team: e.team, until: now + 20000 });
  else if (item === 'turret' || item === 'air') { if (e.sup[item] >= I.max) return 'have'; e.sup[item]++; }
  else return 'bad';
  e.money -= price;
  return 'ok';
}

function nearShop(r, e) { return !!(r.map && r.map.shops && r.map.shops.some(s => Math.hypot(s[0] - e.x, s[2] - e.z) < ECON.SHOP_DIST && Math.abs(s[1] - e.y) < 2.5)); }
function groundY(m, x, y, z) {
  const fx = Math.floor(x), fz = Math.floor(z); let yy = Math.floor(y);
  while (yy > 1 && !m.solid(fx, yy - 1, fz)) yy--;
  while (yy < m.H - 1 && m.solid(fx, yy, fz)) yy++;
  return yy;
}
function topY(m, x, z) { const fx = Math.floor(x), fz = Math.floor(z); let y = m.H - 1; while (y > 0 && !m.solid(fx, y, fz)) y--; return y + 1; }

/* ---------- 포탑 / 공습 ---------- */
function placeTurret(r, e, x, y, z, yaw) {
  for (const t of r.turrets) if (t.owner === e.id) t.hp = 0;
  r.turrets.push({ id: 't' + (r.pid++), owner: e.id, team: e.team, x, y, z, yaw, hp: ITEMS.turret.hp, until: Date.now() + ITEMS.turret.life * 1000, cd: 0.6, scan: 0, target: null });
  broadcast(r, { t: 'sys', text: `${e.name} 님이 자동 포탑을 설치했어요` });
}
function callStrike(r, e, x, z) {
  x = clamp(x, 2, r.map.W - 3); z = clamp(z, 2, r.map.D - 3);
  const dx = -Math.sin(e.yaw), dz = -Math.cos(e.yaw), at = Date.now() + 2500;
  r.strikes.push({ owner: e.id, x, z, dx, dz, t0: at, i: 0 });
  broadcast(r, { t: 'strike', x, z, dx, dz, by: e.id, team: e.team, at });
}
function strikeTick(r, now) {
  for (let i = r.strikes.length - 1; i >= 0; i--) {
    const st = r.strikes[i];
    while (st.i < 6 && now >= st.t0 + st.i * 220 && r.state === 'play') {
      const k = (st.i - 2.5) * 2.8;
      const bx = clamp(st.x + st.dx * k + (Math.random() - 0.5) * 1.5, 1.5, r.map.W - 2.5), bz = clamp(st.z + st.dz * k + (Math.random() - 0.5) * 1.5, 1.5, r.map.D - 2.5);
      explode(r, bx, topY(r.map, bx, bz) + 0.3, bz, st.owner, 'air');
      st.i++;
    }
    if (st.i >= 6) r.strikes.splice(i, 1);
  }
}
function turretTick(r, dt, now) {
  for (let i = r.turrets.length - 1; i >= 0; i--) {
    const t = r.turrets[i], owner = r.ents.get(t.owner);
    if (t.hp <= 0 || now > t.until || !owner) {
      r.turrets.splice(i, 1);
      broadcast(r, { t: 'tgone', id: t.id, boom: t.hp <= 0, x: t.x, y: t.y, z: t.z });
      const k = t.hp <= 0 && t.lastHitBy && r.ents.get(t.lastHitBy);
      if (k) { k.money = Math.min(ECON.MAX, k.money + 500); sendMe(r, k); broadcast(r, { t: 'sys', text: `${k.name} 님이 포탑을 부쉈어요 (+$500)` }); }
      continue;
    }
    // 바닥이 사라지면 떨어짐
    if (!r.map.solid(Math.floor(t.x), t.y - 1, Math.floor(t.z))) t.y = Math.max(1, groundY(r.map, t.x, t.y, t.z));
    const hx = t.x, hy = t.y + 1.05, hz = t.z;
    t.scan -= dt;
    if (t.scan <= 0) {
      t.scan = 0.25;
      let best = null, bd = 28;
      for (const e of r.ents.values()) {
        if (!e.alive || e.id === t.owner || (teamMode(r) && e.team === t.team) || now < e.protUntil) continue;
        const d = Math.hypot(e.x - hx, e.y + 1.1 - hy, e.z - hz);
        if (d < bd && los(r.map, hx, hy, hz, e.x, e.y + 1.2, e.z)) { bd = d; best = e; }
      }
      t.target = best;
    }
    const tg = t.target && t.target.alive ? t.target : null;
    if (!tg) { t.yaw += dt * 0.8; continue; }
    const dx = tg.x - hx, dz = tg.z - hz, dist = Math.hypot(dx, dz) || 0.01;
    const dyaw = angDiff(Math.atan2(-dx, -dz), t.yaw);
    t.yaw += clamp(dyaw, -dt * 5, dt * 5);
    t.cd -= dt;
    if (Math.abs(dyaw) < 0.15 && t.cd <= 0) {
      t.cd = 0.13;
      const hit = Math.random() < clamp(0.6 - dist / 70, 0.15, 0.6);
      let end;
      if (hit) end = [+(tg.x + (Math.random() - 0.5) * 0.3).toFixed(2), +(tg.y + 1.1).toFixed(2), +(tg.z + (Math.random() - 0.5) * 0.3).toFixed(2), 1];
      else {
        let ddx = dx / dist + (Math.random() - 0.5) * 0.15, ddy = (tg.y + 1.1 - hy) / dist + (Math.random() - 0.5) * 0.1, ddz = dz / dist + (Math.random() - 0.5) * 0.15;
        const l = Math.hypot(ddx, ddy, ddz); ddx /= l; ddy /= l; ddz /= l;
        const h = SH.raycast(r.map, hx, hy, hz, ddx, ddy, ddz, 60), d = h ? h.t : 60;
        end = [+(hx + ddx * d).toFixed(2), +(hy + ddy * d).toFixed(2), +(hz + ddz * d).toFixed(2), 0];
      }
      broadcast(r, { t: 'shot', id: t.id, w: 'turret', e: [end] });
      if (hit) damage(r, tg, owner, ITEMS.turret.dmg * (dist > 20 ? 0.8 : 1), 'turret', 'body', true);
      if (r.state !== 'play') return;
    }
  }
}

/* ---------- 스파이크 모드 (발로란트식) ---------- */
function roundMsg(r, reset) {
  const sp = r.sp;
  return { t: 'round', round: sp.round, atk: sp.atk, phase: sp.phase, phaseEnd: sp.phaseEnd, score: r.score, carrier: sp.spike ? sp.spike.carrier : null, reset: !!reset, now: Date.now() };
}
function spikeStart(r) {
  r.sp = { round: 0, atk: Math.random() < 0.5 ? 0 : 1, phase: 'buy', phaseEnd: 0, spike: null, lossStreak: [0, 0], swapped: false, siteTarget: 'A' };
  spikeRound(r);
}
function spikeRound(r) {
  const sp = r.sp, now = Date.now();
  sp.round++;
  if (sp.round === SPK.HALF + 1 && !sp.swapped) {
    sp.swapped = true; sp.atk = 1 - sp.atk; sp.lossStreak = [0, 0];
    for (const e of r.ents.values()) Object.assign(e, { money: SPK.START, primary: null, secondary: 'pistol', armor: 0, helmet: false, nades: 0, sup: { turret: 0, air: 0 }, alive: false });
    broadcast(r, { t: 'sys', text: '전반전 종료 — 공수 교대!' });
  }
  sp.phase = 'buy'; sp.phaseEnd = now + SPK.BUY;
  // 맵/물건 초기화
  r.map = SH.getMap(r.cfg.map).clone(); r.broken = [];
  r.projs = []; r.turrets = []; r.strikes = [];
  for (const d of r.drops.values()) broadcast(r, { t: 'undrop', id: d.id });
  r.drops.clear();
  const used = new Set();
  for (const e of r.ents.values()) {
    if (!e.alive) { e.primary = null; e.secondary = 'pistol'; e.armor = 0; e.helmet = false; e.nades = 0; }
    const list = e.team === sp.atk ? r.map.spike.atk : r.map.spike.def;
    let cell = pick(list); for (let k = 0; k < 20 && used.has(cell); k++) cell = pick(list);
    used.add(cell);
    Object.assign(e, { alive: true, hp: e.maxHp || 100, x: cell[0], y: cell[1], z: cell[2], protUntil: 0, buyUntil: sp.phaseEnd, respawnAt: 0, streak: e.streak, w: e.primary || e.secondary, planting: false });
    const site = r.map.spike.sites.A.c;
    e.yaw = Math.atan2(-(site[0] - e.x), -(site[2] - e.z)); e.pitch = 0;
    if (e.bot) { botSpawn(r, e); e.holdSite = Math.random() < 0.5 ? 'A' : 'B'; }
    else { const c = clientOf(r, e.id); if (c) c.send({ t: 'spawn', x: e.x, y: e.y, z: e.z, yaw: e.yaw, prot: 0, freeze: sp.phaseEnd }); sendMe(r, e); }
  }
  const atks = [...r.ents.values()].filter(e => e.team === sp.atk);
  const carrier = atks.length ? pick(atks) : null;
  sp.spike = { state: carrier ? 'carried' : 'none', carrier: carrier ? carrier.id : null, x: 0, y: 0, z: 0, site: null, explodeAt: 0, planter: null, plantStart: 0, defuser: null, defStart: 0, px: 0, pz: 0 };
  sp.siteTarget = Math.random() < 0.5 ? 'A' : 'B';
  broadcast(r, roundMsg(r, true));
  pushRoom(r);
}
function endRound(r, win, reason) {
  const sp = r.sp; if (!sp || sp.phase === 'end') return;
  sp.phase = 'end'; sp.phaseEnd = Date.now() + SPK.END;
  r.score[win]++;
  const lose = 1 - win;
  sp.lossStreak[win] = 0; sp.lossStreak[lose]++;
  for (const e of r.ents.values()) {
    if (e.team === win) e.money = Math.min(SPK.MAX, e.money + SPK.WIN);
    else if (e.team === lose) e.money = Math.min(SPK.MAX, e.money + SPK.LOSE + SPK.LOSE_BONUS * Math.min(2, sp.lossStreak[lose] - 1));
    sendMe(r, e);
  }
  broadcast(r, { t: 'rend', win, reason, score: r.score, atk: sp.atk, round: sp.round });
  broadcast(r, { t: 'score', s: r.score });
  pushRoom(r);
}
function inSite(r, e) {
  for (const k of ['A', 'B']) if (SH.inRect(r.map.spike.sites[k].rect, e.x, e.z)) return k;
  return null;
}
function spikeEvent(r, ev, extra) { broadcast(r, Object.assign({ t: 'spike', ev }, extra || {})); }
function spikeTick(r, now) {
  const sp = r.sp; if (!sp) return;
  const s = sp.spike;
  if (sp.phase === 'end') {
    if (now >= sp.phaseEnd) { if (r.score[0] >= SPK.WINS || r.score[1] >= SPK.WINS) endMatch(r); else spikeRound(r); }
    return;
  }
  if (sp.phase === 'buy') { if (now >= sp.phaseEnd) { sp.phase = 'live'; sp.phaseEnd = now + SPK.ROUND; broadcast(r, roundMsg(r, false)); } return; }
  // 운반 / 떨어짐 / 줍기
  if (s.state === 'carried') {
    const c = r.ents.get(s.carrier);
    if (!c || !c.alive) { s.state = 'dropped'; s.planter = null; if (c) { s.x = c.x; s.y = c.y; s.z = c.z; } s.carrier = null; spikeEvent(r, 'drop'); }
    else { s.x = c.x; s.y = c.y; s.z = c.z; }
  } else if (s.state === 'dropped') {
    for (const e of r.ents.values()) if (e.alive && e.team === sp.atk && Math.hypot(e.x - s.x, e.z - s.z) < 1.4 && Math.abs(e.y - s.y) < 2) { s.state = 'carried'; s.carrier = e.id; spikeEvent(r, 'pick', { id: e.id }); break; }
  }
  // 설치
  if (s.state === 'carried' && s.planter) {
    const c = r.ents.get(s.planter);
    if (!c || !c.alive || c.id !== s.carrier || !inSite(r, c) || Math.hypot(c.x - s.px, c.z - s.pz) > 0.8) { s.planter = null; }
    else if (now - s.plantStart >= SPK.PLANT) {
      s.state = 'planted'; s.site = inSite(r, c); s.x = c.x; s.y = c.y; s.z = c.z; s.carrier = null; s.planter = null; s.planterId = c.id;
      s.explodeAt = now + SPK.FUSE; sp.phaseEnd = s.explodeAt;
      for (const e of r.ents.values()) if (e.team === sp.atk) { e.money = Math.min(SPK.MAX, e.money + SPK.PLANT_MONEY); sendMe(r, e); }
      spikeEvent(r, 'plant', { id: c.id, site: s.site, at: s.explodeAt });
    }
  }
  // 해체 / 폭발
  if (s.state === 'planted') {
    if (s.defuser) {
      const d = r.ents.get(s.defuser);
      if (!d || !d.alive || Math.hypot(d.x - s.x, d.z - s.z) > 1.9 || Math.hypot(d.x - s.px, d.z - s.pz) > 0.8) s.defuser = null;
      else if (now - s.defStart >= SPK.DEFUSE) { s.state = 'defused'; s.defuser = null; spikeEvent(r, 'defuse', { id: d.id }); endRound(r, 1 - sp.atk, '스파이크 해체'); return; }
    }
    if (now >= s.explodeAt) {
      s.state = 'exploded'; spikeEvent(r, 'boom', { x: s.x, y: s.y, z: s.z });
      explode(r, s.x, s.y + 0.6, s.z, s.planterId, 'spike');
      endRound(r, sp.atk, '스파이크 폭발'); return;
    }
  }
  // 전멸 / 시간 초과
  const atkAlive = [...r.ents.values()].filter(e => e.alive && e.team === sp.atk).length;
  const defAlive = [...r.ents.values()].filter(e => e.alive && e.team === 1 - sp.atk).length;
  if (defAlive === 0) { endRound(r, sp.atk, '수비팀 전멸'); return; }
  if (atkAlive === 0 && s.state !== 'planted') { endRound(r, 1 - sp.atk, '공격팀 전멸'); return; }
  if (s.state !== 'planted' && now >= sp.phaseEnd) endRound(r, 1 - sp.atk, '시간 초과');
}
function startPlant(r, e, on) {
  const sp = r.sp, s = sp && sp.spike;
  if (!s || sp.phase !== 'live') return;
  if (!on) { if (s.planter === e.id) s.planter = null; return; }
  if (s.state !== 'carried' || s.carrier !== e.id || !inSite(r, e) || s.planter === e.id) return;
  s.planter = e.id; s.plantStart = Date.now(); s.px = e.x; s.pz = e.z;
}
function startDefuse(r, e, on) {
  const sp = r.sp, s = sp && sp.spike;
  if (!s || s.state !== 'planted') return;
  if (!on) { if (s.defuser === e.id) s.defuser = null; return; }
  if (e.team === sp.atk || s.defuser || Math.hypot(e.x - s.x, e.z - s.z) > 1.9) return;
  s.defuser = e.id; s.defStart = Date.now(); s.px = e.x; s.pz = e.z;
}
function spikeSnap(r, now) {
  const sp = r.sp, s = sp.spike;
  const st = { none: 0, carried: 1, dropped: 2, planted: 3, defused: 4, exploded: 5 }[s.state];
  const prog = s.planter ? (now - s.plantStart) / SPK.PLANT : s.defuser ? (now - s.defStart) / SPK.DEFUSE : 0;
  return [sp.phase, sp.phaseEnd, st, +s.x.toFixed(2), +s.y.toFixed(2), +s.z.toFixed(2), s.carrier || 0, +Math.min(1, prog).toFixed(2), sp.atk, s.site || 0, sp.round, s.planter || s.defuser || 0];
}

/* ---------- 힐팩 / 갑옷 상자 (시간 지나면 다시 생김) ---------- */
function pickupTick(r, now) {
  if (!r.pickups || !r.pickups.length) return;
  for (const p of r.pickups) {
    if (now < p.readyAt) continue;
    for (const e of r.ents.values()) {
      if (!e.alive || e.zombie || e.boss || Math.hypot(e.x - p.x, e.z - p.z) > 1.0 || Math.abs(e.y - p.y) > 1.5) continue;
      const K = SH.PICKUP[p.kind];
      if (K.heal) { if (e.hp >= e.maxHp) continue; e.hp = Math.min(e.maxHp, e.hp + K.heal); }
      else { if (e.armor >= 100) continue; e.armor = Math.min(100, e.armor + K.armor); }
      p.readyAt = now + K.respawn;
      broadcast(r, { t: 'pk', id: p.id, readyAt: p.readyAt, by: e.id, kind: p.kind });
      sendMe(r, e);
      break;
    }
  }
}

function takeDrop(r, e, d) {
  r.drops.delete(d.id);
  broadcast(r, { t: 'undrop', id: d.id });
  const slot = WEAPONS[d.w].slot === 'secondary' ? 'secondary' : 'primary';
  if (e[slot]) { const nd = { id: 'd' + (r.pid++), w: e[slot], x: e.x, y: e.y + 0.3, z: e.z, until: Date.now() + (isBR(r) ? 1e9 : 40000) }; r.drops.set(nd.id, nd); broadcast(r, { t: 'drop', d: nd }); }
  e[slot] = d.w; e.w = d.w;
  if (e.bot) { e.mag = WEAPONS[d.w].mag; e.reloadT = 0; }
  sendMe(r, e);
}

/* ---------- 모드: 공통 시작 ---------- */
function modeStart(r) {
  const now = Date.now();
  r.zb = null; r.zone = null; r.bossInfo = null;
  for (const e of r.ents.values()) { e.zombie = false; e.gg = 0; e.place = 0; e.bossDmg = 0; }
  if (isZombie(r)) {
    r.zb = { infectAt: now + SH.ZB.PREP, started: false, lastHuman: false };
    ensureTeams(r);
    broadcast(r, { t: 'zb', ev: 'prep', at: r.zb.infectAt });
  }
  if (isBR(r)) {
    r.endAt = now + 3600 * 1000;
    // 바닥에 무기 뿌리기
    const pool = ['pistol', 'pistol', 'magnum', 'uzi', 'smg', 'smg', 'shotgun', 'shotgun', 'dbarrel', 'rifle', 'rifle', 'burst', 'carbine', 'dmr', 'scout', 'lmg', 'sniper', 'rail', 'rocket'];
    const cells = r.map.spawns.concat(r.map.pickups.map(p => [p.x, p.y, p.z]));
    for (let i = 0; i < 30; i++) {
      const c = pick(cells), x = c[0] + (Math.random() - 0.5) * 5, z = c[2] + (Math.random() - 0.5) * 5;
      if (topY(r.map, x, z) > SH.G + 1) continue;
      const d = { id: 'd' + (r.pid++), w: pick(pool), x, y: SH.G + 0.3, z, until: now + 1e9 };
      r.drops.set(d.id, d);
      broadcast(r, { t: 'drop', d });
    }
    const R0 = Math.hypot(r.map.W, r.map.D) / 2 + 2;
    r.zone = { cx: r.map.W / 2, cz: r.map.D / 2, r: R0, fx: r.map.W / 2, fz: r.map.D / 2, fr: R0, tx: r.map.W / 2, tz: r.map.D / 2, tr: R0, stage: -1, phase: 'wait', at: now + 25000, dmgT: 0 };
    nextZone(r);
    r.nextCrate = now + 12000;
  }
  if (isBoss(r)) {
    const humans = r.clients.size;
    const b = newEnt('boss', '거대 골렘', 9, true);
    b.boss = true; b.team = 1; b.skill = 0.6; b.skin = 'boss';
    const allies = [...r.ents.values()].filter(e => e.bot && !e.boss).length;
    b.maxHp = SH.BOSS.HP + SH.BOSS.PER * Math.max(1, humans) + 700 * allies; b.hp = b.maxHp;
    const sp = r.map.spawns.slice().sort((p, q) => Math.hypot(p[0] - r.map.W / 2, p[2] - r.map.D / 2) - Math.hypot(q[0] - r.map.W / 2, q[2] - r.map.D / 2))[0];
    Object.assign(b, { alive: true, x: sp[0], y: sp[1], z: sp[2], w: 'claw', respawnAt: 0 });
    b.body = { x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, h: P.H, ground: true };
    b.slamCD = 3; b.rockCD = 2; b.chargeCD = 6; b.phase2 = false; b.act = null;
    r.ents.set('boss', b);
    ensureTeams(r);
    r.bossInfo = { maxHp: b.maxHp };
  }
  pushRoom(r);
}

/* ---------- 좀비 감염 ---------- */
function infect(r, e, first) {
  if (e.zombie) return;
  e.zombie = true; e.team = 1;
  if (!e.origSkin) e.origSkin = e.skin;
  e.skin = 'zombie';
  e.maxHp = first ? SH.ZB.FIRST_HP : SH.ZB.HP;
  if (e.alive) {
    for (const dw of [e.primary]) if (dw) { const d = { id: 'd' + (r.pid++), w: dw, x: e.x, y: e.y + 0.3, z: e.z, until: Date.now() + 40000 }; r.drops.set(d.id, d); broadcast(r, { t: 'drop', d }); }
    Object.assign(e, { primary: null, secondary: null, w: 'claw', hp: e.maxHp, armor: 0, helmet: false, buyUntil: 0 });
    if (e.bot) { e.target = null; e.mag = undefined; }
  }
  sendMe(r, e);
}
function zombieTick(r, now) {
  const z = r.zb; if (!z) return;
  if (!z.started) {
    if (now < z.infectAt) return;
    z.started = true;
    const cand = [...r.ents.values()].filter(e => e.alive);
    const n = Math.max(1, Math.round(cand.length / 6));
    const ids = [];
    for (let i = 0; i < n && cand.length; i++) { const e = cand.splice(Math.floor(Math.random() * cand.length), 1)[0]; infect(r, e, true); ids.push(e.id); }
    broadcast(r, { t: 'zb', ev: 'start', ids });
    pushRoom(r);
    return;
  }
  const humans = [...r.ents.values()].filter(e => !e.zombie);
  if (!humans.length) { endMatch(r); return; }
  if (humans.length === 1 && !z.lastHuman && r.ents.size > 1) { z.lastHuman = true; broadcast(r, { t: 'zb', ev: 'last', id: humans[0].id }); }
}

/* ---------- 건게임 ---------- */
function applyGG(r, e, quiet) {
  const w = SH.GG_LADDER[Math.min(e.gg || 0, SH.GG_LADDER.length - 1)], W = WEAPONS[w];
  e.primary = W.slot === 'primary' ? w : null;
  e.secondary = W.slot === 'secondary' ? w : null;
  e.w = w;
  if (e.bot) { e.mag = W.mag; e.reloadT = 0; e.spinT = 0; }
  if (!quiet) broadcast(r, { t: 'gg', id: e.id, lv: e.gg, w });
  sendMe(r, e);
}

/* ---------- 배틀로얄 자기장 ---------- */
const BR_STAGES = [[25000, 20000, 0.62], [20000, 18000, 0.38], [18000, 15000, 0.2], [15000, 15000, 0.09], [10000, 15000, 0.0]];
function nextZone(r) {
  const z = r.zone;
  z.stage++;
  const st = BR_STAGES[Math.min(z.stage, BR_STAGES.length - 1)];
  const R0 = Math.hypot(r.map.W, r.map.D) / 2 + 2;
  z.fx = z.cx; z.fz = z.cz; z.fr = z.r;
  const nr = Math.max(0, R0 * st[2]);
  const ang = Math.random() * Math.PI * 2, off = Math.random() * Math.max(0, Math.min(z.r - nr, z.r * 0.5) * 0.8);
  z.tx = clamp(z.cx + Math.cos(ang) * off, 6, r.map.W - 6); z.tz = clamp(z.cz + Math.sin(ang) * off, 6, r.map.D - 6); z.tr = nr;
  z.phase = 'wait'; z.at = Date.now() + st[0]; z.shrinkMs = st[1];
}
function brTick(r, now, dt) {
  const z = r.zone; if (!z) return;
  if (z.phase === 'wait' && now >= z.at) { z.phase = 'shrink'; z.t0 = now; z.at = now + z.shrinkMs; broadcast(r, { t: 'zone', ev: 'shrink' }); }
  if (z.phase === 'shrink') {
    const k = clamp((now - z.t0) / z.shrinkMs, 0, 1);
    z.cx = z.fx + (z.tx - z.fx) * k; z.cz = z.fz + (z.tz - z.fz) * k; z.r = z.fr + (z.tr - z.fr) * k;
    if (k >= 1) { if (z.stage < BR_STAGES.length - 1) nextZone(r); else { z.phase = 'final'; z.at = 0; } }
  }
  z.dmgT -= dt;
  if (z.dmgT <= 0) {
    z.dmgT = 0.5;
    for (const e of r.ents.values()) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - z.cx, e.z - z.cz) > z.r) damage(r, e, null, (3 + Math.max(0, z.stage) * 2.5) * 0.5, 'zone', 'body', true);
    }
  }
  const alive = [...r.ents.values()].filter(e => e.alive);
  const joined = [...r.ents.values()].filter(e => e.brIn);
  if (joined.length >= 2 && alive.length <= 1) { if (alive[0]) alive[0].place = 1; endMatch(r); }
}

/* ---------- 보스 (거대 골렘) ---------- */
function bossThink(r, b, dt, now) {
  const bd = b.body, m = r.map;
  if (!b.phase2 && b.hp < b.maxHp * 0.5) {
    b.phase2 = true;
    broadcast(r, { t: 'boss', act: 'enrage' });
    for (let i = 0; i < 4; i++) {
      const mn = addBot(r, 1); mn.minion = true; mn.zombie = true; mn.name = '골렘 졸개 ' + (i + 1); mn.skin = 'zombie'; mn.maxHp = 150; mn.skill = 0.5;
      const sp = pick(r.map.spawns); mn.respawnAt = 0;
      Object.assign(mn, { alive: true, hp: 150, x: sp[0], y: sp[1], z: sp[2], primary: null, secondary: null, w: 'claw' });
      botSpawn(r, mn);
    }
    ensureTeams(r); pushRoom(r);
  }
  // 목표: 가장 가까운 플레이어
  let t = null, td = 1e9;
  for (const e of r.ents.values()) { if (!e.alive || e.team === 1) continue; const d = Math.hypot(e.x - bd.x, e.z - bd.z); if (d < td) { td = d; t = e; } }
  b.slamCD -= dt; b.rockCD -= dt; b.chargeCD -= dt;
  let mvx = 0, mvz = 0, speed = b.phase2 ? SH.BOSS.SPEED2 : SH.BOSS.SPEED;
  if (b.act) {
    // 동작 중
    if (b.act.kind === 'slam') {
      if (now >= b.act.at) {
        const R = 6.5, dmg = b.phase2 ? 60 : 45;
        for (const e of r.ents.values()) if (e.alive && e.team !== 1 && Math.hypot(e.x - bd.x, e.z - bd.z) < R && Math.abs(e.y - bd.y) < 3) damage(r, e, b, dmg * (1 - Math.hypot(e.x - bd.x, e.z - bd.z) / R * 0.5), 'slam', 'body', true);
        broadcast(r, { t: 'boss', act: 'slamhit', x: bd.x, y: bd.y, z: bd.z, r: R });
        b.act = null;
      }
      speed = 0;
    } else if (b.act.kind === 'charge') {
      if (now >= b.act.until) b.act = null;
      else {
        mvx = b.act.dx; mvz = b.act.dz; speed = 15;
        for (const e of r.ents.values()) if (e.alive && e.team !== 1 && !b.act.hit.has(e.id) && Math.hypot(e.x - bd.x, e.z - bd.z) < 2.2) { b.act.hit.add(e.id); damage(r, e, b, 50, 'charge', 'body', true); broadcast(r, { t: 'boss', act: 'chargehit', id: e.id, dx: b.act.dx, dz: b.act.dz }); }
      }
    }
  } else if (t) {
    const dx = t.x - bd.x, dz = t.z - bd.z;
    b.yaw = Math.atan2(-dx, -dz);
    if (td < 5 && b.slamCD <= 0) { b.act = { kind: 'slam', at: now + 900 }; b.slamCD = b.phase2 ? 2.6 : 3.6; broadcast(r, { t: 'boss', act: 'slam', at: b.act.at, x: bd.x, z: bd.z }); }
    else if (b.phase2 && td > 8 && td < 26 && b.chargeCD <= 0) { b.act = { kind: 'charge', until: now + 1100, dx: dx / td, dz: dz / td, hit: new Set() }; b.chargeCD = 7; broadcast(r, { t: 'boss', act: 'charge' }); }
    else if (td > 7 && b.rockCD <= 0 && los(m, bd.x, bd.y + 4, bd.z, t.x, t.y + 1, t.z)) {
      b.rockCD = b.phase2 ? 1.5 : 2.4;
      const sx = bd.x, sy = bd.y + 4.6, sz = bd.z, ddx = t.x - sx, ddy = t.y + 1 - sy, ddz = t.z - sz, l = Math.hypot(ddx, ddy, ddz);
      const sp = 24, tof = l / sp;
      const pr = { id: r.pid++, kind: 'rock', owner: b.id, x: sx, y: sy, z: sz, vx: ddx / tof, vy: ddy / tof + 4.5 * tof * (m.grav || 1), vz: ddz / tof, fuse: 9, life: 5 };
      r.projs.push(pr);
      broadcast(r, { t: 'proj', p: [pr.id, 'rock', pr.x, pr.y, pr.z, pr.vx, pr.vy, pr.vz, b.id] });
    }
    if (td > 3) {
      // 길찾기
      b.pathT = (b.pathT || 0) - dt;
      if (!b.path || b.pathT <= 0) { b.pathT = 0.8; const s0 = cellOf(m, bd.x, bd.y, bd.z), g = cellOf(m, t.x, t.y, t.z); b.path = findPath(m, s0[0], s0[1], s0[2], g[0], g[1], g[2]); }
      if (b.path && b.path.length) {
        const n = b.path[0], ex = n[0] + 0.5 - bd.x, ez = n[2] + 0.5 - bd.z, d = Math.hypot(ex, ez);
        if (d < 0.5) b.path.shift(); else { mvx = ex / d; mvz = ez / d; }
      } else { mvx = dx / td; mvz = dz / td; }
    }
  }
  bd.vx += clamp(mvx * speed - bd.vx, -30 * dt, 30 * dt);
  bd.vz += clamp(mvz * speed - bd.vz, -30 * dt, 30 * dt);
  bd.vy -= P.GRAV * dt * (m.grav || 1);
  SH.moveBody(m, bd, dt);
  if (b.stuckCheck == null) b.stuckCheck = 0;
  b.stuckCheck += dt; if (b.stuckCheck > 0.7) { if (Math.hypot(bd.x - (b.lx || 0), bd.z - (b.lz || 0)) < 0.2 && (mvx || mvz) && bd.ground) bd.vy = P.JUMP; b.lx = bd.x; b.lz = bd.z; b.stuckCheck = 0; }
  if (bd.y < -5) { const sp = pick(m.spawns); bd.x = sp[0]; bd.y = sp[1]; bd.z = sp[2]; }
  b.x = bd.x; b.y = bd.y; b.z = bd.z;
  b.fl = 1 | (b.act ? 128 : 0) | (bd.ground ? 0 : 64) | (b.phase2 ? 256 : 0);
}

/* ---------- 보급상자 ---------- */
const LOOT = [
  ['weapon', 30], ['money', 20], ['armorset', 15], ['nades', 10], ['turret', 8], ['perk', 8], ['air', 4], ['gold', 5],
];
function rollLoot() {
  const tot = LOOT.reduce((a, b) => a + b[1], 0); let x = Math.random() * tot;
  for (const [k, w] of LOOT) { if ((x -= w) < 0) return k; }
  return 'money';
}
function crateTick(r, now) {
  if (isSpike(r) || isPractice(r) || isGG(r)) return;
  if (now >= r.nextCrate && r.crates.filter(c => !c.opened).length < 2) {
    r.nextCrate = now + (isBR(r) ? 20000 : 45000 + Math.random() * 15000);
    // 누구나 걸어서 닿는 낮은 땅에만 떨어뜨림
    let x = 0, z = 0, landY = 99;
    for (let k = 0; k < 20 && landY > SH.G + 1; k++) { const sp = pick(r.map.spawns); x = sp[0] + (Math.random() - 0.5) * 3; z = sp[2] + (Math.random() - 0.5) * 3; landY = topY(r.map, x, z); }
    if (landY > SH.G + 1) { const sp = pick(r.map.spawns); x = sp[0]; z = sp[2]; landY = topY(r.map, x, z); }
    const c = { id: 'c' + (r.pid++), x, z, landY, y: landY + 36, landAt: now + 7200, opened: false };
    r.crates.push(c);
    broadcast(r, { t: 'crate', id: c.id, x, z, landY, landAt: c.landAt });
  }
  for (const c of r.crates) c.y = Math.max(c.landY, c.landY + 36 * (c.landAt - now) / 7200);
  r.crates = r.crates.filter(c => !c.opened && now < c.landAt + 90000);
}
function openCrate(r, e, id) {
  const c = r.crates.find(o => o.id === id);
  if (!c || c.opened || !e.alive || e.zombie || e.boss || Date.now() < c.landAt || Math.hypot(c.x - e.x, c.z - e.z) > 2.5 || Math.abs(c.landY - e.y) > 2.5) return;
  c.opened = true;
  const got = [];
  const kinds = new Set([rollLoot(), rollLoot()]);
  for (const k of kinds) {
    if (k === 'weapon') {
      const w = pick(['rocket', 'minigun', 'lmg', 'sniper', 'carbine', 'rail', 'dmr']);
      if (e.primary && e.primary !== w) { const nd = { id: 'd' + (r.pid++), w: e.primary, x: e.x, y: e.y + 0.3, z: e.z, until: Date.now() + 40000 }; r.drops.set(nd.id, nd); broadcast(r, { t: 'drop', d: nd }); }
      e.primary = w; e.w = w; got.push('w:' + w);
      const cl = clientOf(r, e.id); if (cl) cl.send({ t: 'got', w });
    } else if (k === 'money') { e.money = Math.min(ECON.MAX, e.money + 1500); got.push('money'); }
    else if (k === 'armorset') { e.armor = 100; e.helmet = true; e.hp = e.maxHp; got.push('armorset'); }
    else if (k === 'nades') { e.nades = ITEMS.nade.max; got.push('nades'); }
    else if (k === 'turret') { e.sup.turret = Math.max(e.sup.turret, 1); got.push('turret'); }
    else if (k === 'air') { e.sup.air = Math.max(e.sup.air, 1); got.push('air'); }
    else if (k === 'perk') { const pk = pick(['perk_speed', 'perk_hp', 'perk_reload'].filter(p => !e.perks[p])); if (pk) { e.perks[pk] = 1; if (pk === 'perk_hp') { e.maxHp = 125; e.hp += 25; } got.push(pk); } else { e.money = Math.min(ECON.MAX, e.money + 1500); got.push('money'); } }
    else if (k === 'gold') got.push('gold');
  }
  broadcast(r, { t: 'cratepick', id: c.id, by: e.id, loot: got });
  sendMe(r, e);
}

/* ---------- 메시지 ---------- */
// 로그인 전에는 'auth' 만 받아요
function handleAuth(c, m) {
  if (m.t === 'logout') { if (c.user) AUTH.logout(c.user.token); c.user = null; leaveRoom(c); return; }
  if (m.t === 'profile') { if (c.user && !AUTH.saveProfile(c.user.sub, m.p)) c.send({ t: 'err', text: '프로필 저장 실패' }); return; }
  AUTH.login(m).then(u => {
    if (!c.alive) return;
    c.user = u;
    c.send({ t: 'authed', sub: u.sub, token: u.token, email: u.email, name: u.name, profile: u.profile });
    log(`로그인: ${u.email || u.sub}`);
  }).catch(e => c.send({ t: 'autherr', text: e.message || '로그인 실패', token: !!m.token }));
}

function handle(c, m) {
  if (m.t === 'auth' || m.t === 'logout' || m.t === 'profile') return handleAuth(c, m);
  if (!c.user) { c.send({ t: 'needauth' }); return; }
  if (USERMAPS.handle(c, m)) return;
  if (EDIT.handle(c, m)) return;
  const r = c.room;
  switch (m.t) {
    case 'list':
      c.send({ t: 'rooms', list: [...rooms.values()].filter(x => x.pub && x.clients.size < MAX_ROOM).map(x => ({ code: x.code, n: x.clients.size, map: x.cfg.map, mode: x.cfg.mode, rmode: !!x.cfg.rmode, rmap: !!x.cfg.rmap, state: x.state, ranked: !!x.cfg.ranked, closed: !!x.cfg.ranked && x.state !== 'wait', host: (x.ents.get(x.hostId) || {}).name })) });
      break;
    case 'create': {
      const nr = createRoom(c, m.cfg, !m.quick);
      joinRoom(c, nr, m);
      if (m.quick) startMatch(nr);
      break;
    }
    case 'join': {
      const code = String(m.code || '').trim(), nr = rooms.get(code);
      if (!nr && EDIT.has(code)) { leaveRoom(c); EDIT.join(c, EDIT.get(code), m); break; } // 맵 같이 만들기 코드
      if (!nr) { c.send({ t: 'err', text: '방을 찾을 수 없어요' }); break; }
      if (nr.clients.size >= MAX_ROOM) { c.send({ t: 'err', text: '방이 꽉 찼어요' }); break; }
      if (nr.cfg.ranked && nr.state !== 'wait') { c.send({ t: 'err', text: '이미 시작한 경쟁전에는 들어갈 수 없어요' }); break; }
      joinRoom(c, nr, m);
      break;
    }
    case 'leave': leaveRoom(c); c.send({ t: 'left' }); break;
    case 'ranked': rankedQueue(c, m); break;
    case 'rank': c.send(Object.assign({ t: 'rank' }, rankLists())); break;
    case 'cfg':
      if (!r || r.hostId !== c.id || r.state === 'play' || r.cfg.ranked) break;
      if (m.custom && typeof m.custom === 'object') {
        const cu = customFrom(m.custom);
        if (cu.err) { c.send({ t: 'err', text: cu.err }); break; }
        r.custom = cu.custom;
        m.cfg = Object.assign({}, m.cfg, { map: 'custom' });
      }
      r.cfg = fixCfg(cleanCfg(m.cfg, r.cfg));
      if (r.cfg.map === 'custom' && !r.custom) r.cfg.map = 'village';
      fitBots(r); pushRoom(r);
      break;
    case 'hero': {
      if (!r) break;
      const e = r.ents.get(c.id); if (!e) break;
      const h = cleanHero(m.h);
      // 죽어 있거나, 매치 전이거나, 부활 직후 구매 시간 안에만 바꿀 수 있어요
      if (r.state === 'play' && e.alive && Date.now() > e.buyUntil) { c.send({ t: 'err', text: '능력자는 죽어 있거나 부활 직후(구매 시간)에만 바꿀 수 있어요' }); break; }
      if (e.hero !== h) { e.hero = h; e.qAt = 0; e.hasteUntil = 0; e.steelUntil = 0; e.invisUntil = 0; }
      sendMe(r, e); pushRoom(r);
      break;
    }
    case 'team': {
      if (!r || r.state === 'play' || !teamMode(r)) break;
      if (r.cfg.ranked) { c.send({ t: 'err', text: '경쟁전에서는 팀을 바꿀 수 없어요 (자동 배정)' }); break; }
      const e = r.ents.get(c.id); if (!e) break;
      e.team = e.team === 0 ? 1 : 0; ensureTeams(r); pushRoom(r);
      break;
    }
    case 'start':
      // 경쟁전: 방장이 시작. 방장이 1분 넘게 안 누르면 아무나 시작 가능
      if (r && r.cfg.ranked && r.state === 'wait' && (r.hostId === c.id || Date.now() - (r.waitSince || 0) > 60000)) { rankedStart(r); break; }
      if (!r || r.hostId !== c.id || r.state === 'play') break; // 경쟁전: 설정은 그대로, 방장이 시작
      if (m.cfg) r.cfg = fixCfg(cleanCfg(m.cfg, r.cfg));
      startMatch(r);
      break;
    case 'stop':
      if (!r || r.hostId !== c.id || r.cfg.ranked) break;
      endMatch(r);
      break;
    case 'bot': {
      if (!r || r.hostId !== c.id || r.cfg.ranked) break;
      const bots = botsOf(r), hum = r.clients.size;
      if (r.state === 'wait') { // 대기실: 시작할 때 채울 봇 수만 조절
        if (m.op === 'add') r.cfg.bots = Math.min(MAX_ROOM - 1, r.cfg.bots + 1);
        else if (m.op === 'clear') r.cfg.bots = 0;
        pushRoom(r);
        break;
      }
      if (m.op === 'add') {
        if (r.ents.size >= MAX_ROOM) { c.send({ t: 'err', text: '방이 꽉 찼어요 (최대 12명)' }); break; }
        const b = addBot(r, teamMode(r) ? num(m.team, -1) : -1);
        r.cfg.bots = bots.length + 1 + hum - 1;
        broadcast(r, { t: 'sys', text: `봇 ${b.name} 추가` });
      } else if (m.op === 'kick') {
        const b = r.ents.get(String(m.id)); if (!b || !b.bot || b.boss || b.minion) break;
        removeBot(r, b); r.cfg.bots = Math.max(0, bots.length - 1 + hum - 1);
        broadcast(r, { t: 'sys', text: `봇 ${b.name} 퇴장` });
      } else if (m.op === 'clear') {
        for (const b of bots) removeBot(r, b);
        r.cfg.bots = Math.max(0, hum - 1);
        broadcast(r, { t: 'sys', text: '봇을 모두 뺐어요' });
      }
      ensureTeams(r); pushRoom(r);
      break;
    }
    case 'chat': {
      if (!r) break;
      const e = r.ents.get(c.id), text = String(m.text || '').replace(/[<>]/g, '').slice(0, 80).trim();
      if (e && text) broadcast(r, { t: 'chat', id: c.id, name: e.name, color: e.color, team: e.team, text });
      break;
    }
  }
  if (!r || r.state !== 'play') return;
  const e = r.ents.get(c.id);
  if (!e) return;
  switch (m.t) {
    case 'st':
      if (!e.alive) break;
      e.x = num(m.x, e.x); e.y = num(m.y, e.y); e.z = num(m.z, e.z);
      e.yaw = num(m.yaw, 0); e.pitch = num(m.pitch, 0); e.fl = num(m.fl, 0) | 0;
      if (m.w === e.primary || m.w === e.secondary || m.w === 'knife' || m.w === 'nade') e.w = m.w;
      if ((m.fl & 128) && e.invisUntil) e.invisUntil = 0;
      if ((m.fl & 128) && Date.now() < e.protUntil) e.protUntil = 0; // 공격하면 보호 해제
      break;
    case 'shot':
      if (!e.alive) break;
      if (Date.now() < e.protUntil) e.protUntil = 0;
      e.invisUntil = 0;
      broadcast(r, { t: 'shot', id: c.id, w: String(m.w || ''), e: Array.isArray(m.e) ? m.e.slice(0, 12) : [] }, c);
      break;
    case 'hit': {
      if (!e.alive) break;
      const v = r.ents.get(String(m.id)), w = String(m.w || '');
      if (!v || v === e || !WEAPONS[w]) break;
      if (!(w === 'knife' && !e.zombie) && !(w === 'claw' && e.zombie) && w !== e.primary && w !== e.secondary) break;
      const dmg = clamp(num(m.dmg, 0), 0, SH.maxShotDamage(w));
      damage(r, v, e, dmg, w, m.part === 'head' ? 'head' : 'body');
      break;
    }
    case 'proj': {
      if (!e.alive) break;
      const kind = m.kind === 'rocket' ? 'rocket' : 'nade';
      if (kind === 'rocket' && e.primary !== 'rocket') break;
      if (kind === 'nade') { if (e.nades <= 0) break; e.nades--; sendMe(r, e); }
      if (Date.now() < e.protUntil) e.protUntil = 0;
      const sp = kind === 'rocket' ? 34 : 17;
      let dx = num(m.dx, 0), dy = num(m.dy, 0), dz = num(m.dz, -1); const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      const pr = { id: r.pid++, kind, owner: e.id, x: num(m.x, e.x), y: num(m.y, e.y + 1.5), z: num(m.z, e.z), vx: dx * sp, vy: dy * sp + (kind === 'nade' ? 3 : 0), vz: dz * sp, fuse: ITEMS.nade.fuse, life: 6 };
      r.projs.push(pr);
      broadcast(r, { t: 'proj', p: [pr.id, kind, pr.x, pr.y, pr.z, pr.vx, pr.vy, pr.vz, e.id] });
      break;
    }
    case 'buy': {
      const res = buy(r, e, String(m.item || ''));
      c.send({ t: 'buyres', item: m.item, res });
      sendMe(r, e);
      break;
    }
    case 'pick': {
      const d = r.drops.get(String(m.id));
      if (!d || !e.alive || e.zombie || isGG(r) || Math.hypot(d.x - e.x, d.z - e.z) > 3 || Math.abs(d.y - e.y) > 3) break;
      takeDrop(r, e, d);
      c.send({ t: 'got', w: d.w });
      break;
    }
    case 'suicide':
      if (e.alive) kill(r, e, e, 'knife', false);
      break;
    case 'deploy': {
      if (!e.alive || e.sup.turret <= 0) break;
      let x = num(m.x, e.x), z = num(m.z, e.z);
      if (Math.hypot(x - e.x, z - e.z) > 3 || r.map.solid(Math.floor(x), Math.floor(e.y + 0.5), Math.floor(z))) { x = e.x; z = e.z; }
      e.sup.turret--; sendMe(r, e);
      placeTurret(r, e, x, groundY(r.map, x, e.y + 1, z), z, num(m.yaw, e.yaw));
      break;
    }
    case 'strike':
      if (!e.alive || e.sup.air <= 0) break;
      e.sup.air--; sendMe(r, e);
      callStrike(r, e, num(m.x, e.x), num(m.z, e.z));
      break;
    case 'plant': startPlant(r, e, !!m.on); break;
    case 'ab': useAbility(r, e, m); break;
    case 'swing':
      if (!e.alive) break;
      if (Date.now() < e.protUntil) e.protUntil = 0;
      e.invisUntil = 0;
      broadcast(r, { t: 'swing', id: c.id }, c);
      break;
    case 'emote':
      if (!e.alive || Date.now() - (e.emoteT || 0) < 1500) break;
      e.emoteT = Date.now();
      broadcast(r, { t: 'emote', id: e.id, e: cleanId(m.e) });
      break;
    case 'spray': {
      if (!e.alive || Date.now() - (e.sprayT || 0) < 1500) break;
      const p = Array.isArray(m.p) ? m.p.map(v => num(v, 0)) : null, nn = Array.isArray(m.n) ? m.n.map(v => clamp(Math.round(num(v, 0)), -1, 1)) : null;
      if (!p || !nn || p.length !== 3 || nn.length !== 3 || Math.hypot(p[0] - e.x, p[2] - e.z) > 8) break;
      e.sprayT = Date.now();
      broadcast(r, { t: 'spray', id: e.id, s: cleanId(m.s), p, n: nn });
      break;
    }
    case 'defuse': startDefuse(r, e, !!m.on); break;
    case 'open': openCrate(r, e, String(m.id)); break;
    case 'hitt': {
      if (!e.alive) break;
      const t = r.turrets.find(o => o.id === m.id), w = String(m.w || '');
      if (!t || !WEAPONS[w] || t.owner === e.id || (teamMode(r) && t.team === e.team)) break;
      if (!(w === 'knife' && !e.zombie) && !(w === 'claw' && e.zombie) && w !== e.primary && w !== e.secondary) break;
      t.hp -= clamp(num(m.dmg, 0), 0, SH.maxShotDamage(w)); t.lastHitBy = e.id;
      break;
    }
  }
}

/* ---------- 봇 AI ---------- */
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function walkGrid(m) {
  if (m._walk) return m._walk;
  const g = new Uint8Array(m.W * m.H * m.D);
  for (let y = 1; y < m.H - 1; y++) for (let z = 0; z < m.D; z++) for (let x = 0; x < m.W; x++) if (SH.walkable(m, x, y, z)) g[(y * m.D + z) * m.W + x] = 1;
  m._walk = g;
  return g;
}
function updateWalk(m, list) {
  const g = walkGrid(m);
  for (const [x, by, z] of list) for (let y = Math.max(1, by - 2); y <= Math.min(m.H - 2, by + 1); y++) g[(y * m.D + z) * m.W + x] = SH.walkable(m, x, y, z) ? 1 : 0;
}
function findPath(m, sx, sy, sz, tx, ty, tz) {
  const g = walkGrid(m), W = m.W, D = m.D;
  const key = (x, y, z) => (y * D + z) * W + x;
  const wk = (x, y, z) => x >= 0 && z >= 0 && x < W && z < D && y > 0 && y < m.H - 1 && g[key(x, y, z)] === 1;
  if (!wk(sx, sy, sz) || !wk(tx, ty, tz)) return null;
  const goal = key(tx, ty, tz);
  const open = [], gS = new Map(), came = new Map();
  const h = (x, y, z) => Math.hypot(x - tx, (y - ty) * 1.5, z - tz);
  const push = (n) => { open.push(n); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p].f <= open[i].f) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, rr = l + 1; let s = i; if (l < open.length && open[l].f < open[s].f) s = l; if (rr < open.length && open[rr].f < open[s].f) s = rr; if (s === i) break; [open[s], open[i]] = [open[i], open[s]]; i = s; } } return top; };
  const sk = key(sx, sy, sz);
  gS.set(sk, 0); push({ x: sx, y: sy, z: sz, k: sk, f: h(sx, sy, sz) });
  let it = 0;
  while (open.length && it++ < 6000) {
    const n = pop();
    if (n.k === goal) {
      const out = []; let k = goal;
      while (k !== undefined && k !== sk) { const x = k % W, z = Math.floor(k / W) % D, y = Math.floor(k / (W * D)); out.push([x, y, z]); k = came.get(k); }
      return out.reverse();
    }
    const gc = gS.get(n.k);
    for (const [dx, dz] of DIRS) {
      const nx = n.x + dx, nz = n.z + dz, diag = dx && dz;
      if (diag && (m.solid(n.x + dx, n.y, n.z) || m.solid(n.x + dx, n.y + 1, n.z) || m.solid(n.x, n.y, n.z + dz) || m.solid(n.x, n.y + 1, n.z + dz))) continue;
      let ny = null, cost = diag ? 1.414 : 1;
      if (wk(nx, n.y, nz)) ny = n.y;
      else if (!diag && wk(nx, n.y + 1, nz) && !m.solid(n.x, n.y + 2, n.z)) { ny = n.y + 1; cost = 1.6; }
      else if (!m.solid(nx, n.y, nz) && !m.solid(nx, n.y + 1, nz)) {
        for (let k = 1; k <= 6; k++) { if (wk(nx, n.y - k, nz)) { ny = n.y - k; cost += k * 0.3; break; } if (m.solid(nx, n.y - k, nz)) break; }
      }
      if (ny === null) continue;
      const nk = key(nx, ny, nz), ng = gc + cost;
      if (gS.has(nk) && gS.get(nk) <= ng) continue;
      gS.set(nk, ng); came.set(nk, n.k);
      push({ x: nx, y: ny, z: nz, k: nk, f: ng + h(nx, ny, nz) });
    }
  }
  return null;
}
function cellOf(m, x, y, z) {
  const cx = clamp(Math.floor(x), 0, m.W - 1), cy = Math.floor(y + 0.05), cz = clamp(Math.floor(z), 0, m.D - 1);
  const g = walkGrid(m);
  for (let k = 0; k < 8; k++) { const yy = cy - k; if (yy > 0 && yy < m.H && g[(yy * m.D + cz) * m.W + cx]) return [cx, yy, cz]; }
  for (let k = 1; k < 4; k++) { const yy = cy + k; if (yy < m.H - 1 && g[(yy * m.D + cz) * m.W + cx]) return [cx, yy, cz]; }
  return [cx, cy, cz];
}

function botSpawn(r, b) {
  b.body = { x: b.x, y: b.y, z: b.z, vx: 0, vy: 0, vz: 0, h: P.H, ground: true };
  b.path = null; b.pathT = 0; b.target = null; b.react = 0; b.fireCD = 0.6; b.reloadT = 0; b.strafe = Math.random() < 0.5 ? 1 : -1; b.strafeT = 1;
  b.stuckT = 0; b.lastX = b.x; b.lastZ = b.z; b.seeT = 0; b.botAlert = null; b.spinT = 0; b.lastSeen = null;
  b.role = Math.random() < 0.6 ? 'att' : 'def';
  if (isGG(r) || isBR(r) || b.zombie) { b.w = b.zombie ? 'claw' : b.primary || b.secondary || 'knife'; b.mag = WEAPONS[b.w].mag; return; }
  // 구매 (어려울수록 좋은 총)
  const rich = b.skill > 0.7 ? 1.4 : 1;
  const prefs = [];
  if (b.money >= 4750 && Math.random() < 0.22 * rich) prefs.push('sniper');
  if (b.money >= 3600 && Math.random() < 0.25 * rich) prefs.push(pick(['dmr', 'rail']));
  if (b.money >= 2300 && Math.random() < 0.3) prefs.push(pick(['burst', 'scout']));
  if (b.money >= 4200 && Math.random() < 0.25) prefs.push('lmg');
  if (b.money >= 3100 && Math.random() < 0.5 * rich) prefs.push('carbine');
  if (b.money >= 2700) prefs.push('rifle');
  if (b.money >= 1600 && Math.random() < 0.4) prefs.push(pick(['shotgun', 'dbarrel']));
  if (b.money >= 1250) prefs.push('smg');
  if (!b.primary && prefs.length) buy(r, b, prefs[0]);
  if (b.money >= 650 + 1000 && Math.random() < 0.7) buy(r, b, 'armor');
  if (b.secondary === 'pistol' && b.money >= 1500 && Math.random() < 0.4) buy(r, b, pick(['magnum', 'uzi']));
  if (b.money >= 900 && Math.random() < 0.5) buy(r, b, 'helmet');
  if (b.money >= 3500 && Math.random() < 0.35) buy(r, b, pick(['perk_speed', 'perk_hp', 'perk_reload']));
  if (b.money >= 4500 && Math.random() < 0.18) { buy(r, b, 'turret'); b.deployAt = Date.now() + 2000 + Math.random() * 4000; }
  if (b.money >= 6500 && Math.random() < 0.15) buy(r, b, 'air');
  b.w = b.primary || b.secondary;
  b.mag = WEAPONS[b.w].mag;
}

function los(m, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
  if (d < 0.01) return true;
  return !SH.raycast(m, ax, ay, az, dx / d, dy / d, dz / d, d);
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
const isEnemy = (r, b, e) => e !== b && e.alive && (!teamMode(r) || e.team !== b.team);

function rndIn(rc) { return { x: rc[0] + 1 + Math.random() * (rc[2] - rc[0] - 1), y: SH.G, z: rc[1] + 1 + Math.random() * (rc[3] - rc[1] - 1) }; }
function botGoal(r, b) {
  const bd = b.body;
  let nearest = null, nd = 1e9;
  for (const e of r.ents.values()) { if (!isEnemy(r, b, e)) continue; const d = Math.hypot(e.x - bd.x, e.z - bd.z); if (d < nd) { nd = d; nearest = e; } }
  if (isSpike(r) && r.sp) {
    const sp = r.sp, s = sp.spike, sites = r.map.spike.sites;
    if (b.team === sp.atk) {
      const site = sites[s.site || sp.siteTarget];
      if (s.state === 'carried' && s.carrier === b.id) { const c = site.c; return { x: c[0], y: c[1], z: c[2] }; }
      if (s.state === 'dropped') return s;
      if (s.state === 'planted') return { x: s.x + (Math.random() - 0.5) * 8, y: s.y, z: s.z + (Math.random() - 0.5) * 8 };
      return rndIn(site.rect);
    }
    if (s.state === 'planted') return s;
    if (nearest && nd < 12) return nearest;
    return rndIn(sites[b.holdSite || 'A'].rect);
  }
  if (isBR(r) && r.zone) {
    const z = r.zone;
    if (Math.hypot(bd.x - z.tx, bd.z - z.tz) > z.tr * 0.85 + 1) return { x: z.tx + (Math.random() - 0.5) * z.tr * 0.6, y: SH.G, z: z.tz + (Math.random() - 0.5) * z.tr * 0.6 };
    if (!b.primary) { let best = null, bdd = 40; for (const d of r.drops.values()) { if (WEAPONS[d.w].slot !== 'primary') continue; const dd = Math.hypot(d.x - bd.x, d.z - bd.z); if (dd < bdd) { bdd = dd; best = d; } } if (best) return best; }
  }
  if (b.zombie && nearest) return nearest;
  if (isBoss(r)) { const bb = r.ents.get('boss'); if (bb && bb.alive && b.team === 0) return { x: bb.x + (Math.random() - 0.5) * 16, y: bb.y, z: bb.z + (Math.random() - 0.5) * 16 }; }
  // 다쳤으면 힐팩, 갑옷이 없으면 갑옷 상자
  if (r.pickups && r.pickups.length && b.hp < 55) {
    let best = null, bd2 = 30;
    for (const p of r.pickups) {
      if (Date.now() < p.readyAt || p.kind === 'armor') continue;
      const d = Math.hypot(p.x - bd.x, p.z - bd.z); if (d < bd2) { bd2 = d; best = p; }
    }
    if (best) return best;
  }
  // 보급상자 노리기
  if (r.crates && !t0(b)) for (const c of r.crates) if (!c.opened && Date.now() > c.landAt - 2000 && Math.hypot(c.x - bd.x, c.z - bd.z) < 30) return { x: c.x, y: c.landY, z: c.z };
  if (r.cfg.mode === 'ctf' && r.flags) {
    const own = r.flags[b.team], en = r.flags[1 - b.team];
    const home = { x: own.home[0], y: own.home[1], z: own.home[2] };
    if (en.carrier === b.id) return home;
    if (!own.atHome && !own.carrier) return own;
    if (own.carrier) { const c = r.ents.get(own.carrier); if (c) return c; }
    if (b.role === 'att') { if (en.carrier) { const c = r.ents.get(en.carrier); if (c) return c; } return en; }
    if (nearest && nd < 18) return nearest;
    return { x: home.x + (Math.random() - 0.5) * 12, y: home.y, z: home.z + (Math.random() - 0.5) * 12 };
  }
  if (b.lastSeen && Math.random() < 0.7) return b.lastSeen;
  if (nearest && Math.random() < 0.75) return nearest;
  const sp = pick(r.map.spawns);
  return { x: sp[0], y: sp[1], z: sp[2] };
}

function t0(b) { return b.target && b.target.alive; }
function dummyThink(r, b, dt, now) {
  const bd = b.body;
  if (!b.anchor) b.anchor = { x: bd.x, z: bd.z, ph: Math.random() * 6 };
  const t = now / 1000 + b.anchor.ph;
  const tx = b.anchor.x + Math.sin(t * 0.9) * 2.5, tz = b.anchor.z + Math.cos(t * 0.6) * 1.2;
  bd.vx = clamp((tx - bd.x) * 3, -P.WALK, P.WALK); bd.vz = clamp((tz - bd.z) * 3, -P.WALK, P.WALK);
  if (bd.ground && Math.random() < 0.004) bd.vy = P.JUMP;
  bd.vy -= P.GRAV * dt * (r.map.grav || 1);
  SH.moveBody(r.map, bd, dt);
  b.x = bd.x; b.y = bd.y; b.z = bd.z;
  b.yaw = Math.atan2(-(b.anchor.x - bd.x + 0.01), -(b.anchor.z + 30 - bd.z)) + Math.PI;
  b.fl = 1 | (bd.ground ? 0 : 64) | (Math.sin(t * 0.4) > 0.7 ? 2 : 0);
}
function botThink(r, b, dt, now) {
  if (b.dummy) { dummyThink(r, b, dt, now); return; }
  if (r.sp && r.sp.phase === 'buy') { b.fl = 1; return; }
  const m = r.map, bd = b.body, W = WEAPONS[b.w];
  const eyeY = bd.y + P.EYE;
  // 타겟 탐색
  b.seeT -= dt;
  if (b.seeT <= 0) {
    b.seeT = 0.2;
    let best = null, bdist = 1e9;
    for (const e of r.ents.values()) {
      if (!isEnemy(r, b, e)) continue;
      const d = Math.hypot(e.x - bd.x, e.y - bd.y, e.z - bd.z);
      if (d > 75) continue;
      if (now < (e.invisUntil || 0) && d > 4) continue;
      const alerted = b.botAlert === e.id;
      const yawTo = Math.atan2(-(e.x - bd.x), -(e.z - bd.z));
      if (!alerted && !b.zombie && !e.boss && d > 6 && Math.abs(angDiff(yawTo, b.yaw)) > 1.25) continue;
      if (!los(m, bd.x, eyeY, bd.z, e.x, e.y + 1.3, e.z)) continue;
      const score = d - (alerted ? 20 : 0);
      if (score < bdist) { bdist = score; best = e; }
    }
    if (best && (!b.target || b.target.id !== best.id)) { b.react = 0.6 - b.skill * 0.45 + Math.random() * 0.25; }
    b.target = best;
    if (best) b.lastSeen = { x: best.x, y: best.y, z: best.z };
    b.botAlert = null;
  }
  const t = b.target && b.target.alive ? b.target : null;
  if (isAbility(r)) botAbility(r, b, t, now);
  if (b.sup.turret > 0 && now > (b.deployAt || 0) && bd.ground) { b.sup.turret--; placeTurret(r, b, bd.x, Math.round(bd.y), bd.z, b.yaw); }
  if (b.sup.air > 0 && t && Math.hypot(t.x - bd.x, t.z - bd.z) > 14 && Math.random() < 0.02) { b.sup.air--; callStrike(r, b, t.x, t.z); }
  const carrying = !!(r.flags && r.flags.some(f => f.carrier === b.id)) || !!(r.sp && r.sp.spike && r.sp.spike.carrier === b.id);
  let holding = false;
  if (r.sp && r.sp.phase === 'live') {
    const s = r.sp.spike;
    if (s.state === 'carried' && s.carrier === b.id && inSite(r, b) && !t) { startPlant(r, b, true); holding = s.planter === b.id; }
    if (s.state === 'planted' && b.team !== r.sp.atk && Math.hypot(b.x - s.x, b.z - s.z) < 1.6 && (!t || b.skill > 0.6)) { startDefuse(r, b, true); holding = s.defuser === b.id; }
    if (holding) { bd.vx = 0; bd.vz = 0; }
  }
  let mvx = 0, mvz = 0, wantRun = true, rushing = false;
  if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.mag = W.mag; }

  if (t) {
    const dx = t.x - bd.x, dz = t.z - bd.z, dist = Math.hypot(dx, dz) || 0.01;
    // 조준
    const tyaw = Math.atan2(-dx, -dz), tpitch = Math.atan2(t.y + 1.25 - eyeY, dist);
    const turn = (2.5 + b.skill * 8) * dt;
    const dyaw = angDiff(tyaw, b.yaw);
    b.yaw += clamp(dyaw, -turn, turn); b.pitch += clamp(tpitch - b.pitch, -turn, turn);
    b.react -= dt;
    b.fireCD -= dt;
    if (W.melee) {
      // 근접: 가까우면 휘두르기
      if (dist < W.melee && b.fireCD <= 0 && Math.abs(dyaw) < 0.6) {
        b.fireCD = 60 / W.rpm * (1.1 + Math.random() * 0.4);
        broadcast(r, { t: 'swing', id: b.id });
        if (Math.random() < 0.55 + b.skill * 0.35) damage(r, t, b, W.dmg, b.w, 'body');
      }
    } else if (b.reloadT <= 0 && b.react <= 0 && Math.abs(dyaw) < 0.12 && b.fireCD <= 0) {
      let ok = true;
      if (W.spin) { b.spinT += dt; if (b.spinT < W.spin) ok = false; }
      if (ok) {
        const semi = !W.auto;
        b.fireCD = 60 / W.rpm * (semi ? 1.6 + Math.random() * 0.8 : 1) * (W.scope ? 1.5 : 1);
        if (W.auto && Math.random() < 0.08) b.fireCD += 0.35;
        botFire(r, b, t, dist, W);
        b.mag--;
        if (b.mag <= 0) b.reloadT = W.shell ? W.reload * W.mag : W.reload;
      }
    }
    rushing = r.cfg.mode === 'ctf' && b.role === 'att' && dist > 7;
    if (!carrying && !rushing) {
      const pref = W.melee ? 0.9 : W.pellets ? 5 : W.cat === 'smg' ? 9 : W.scope ? 28 : 16;
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafe = -b.strafe; b.strafeT = 0.5 + Math.random() * 1.3; if (Math.random() < 0.1 + b.skill * 0.15 && bd.ground) bd.vy = P.JUMP; }
      const fx = dx / dist, fz = dz / dist;
      const app = dist > pref * 1.4 ? 1 : dist < pref * 0.6 ? -0.7 : 0;
      mvx = fx * app + (-fz) * b.strafe * 0.9; mvz = fz * app + fx * b.strafe * 0.9;
      wantRun = false;
    }
  } else {
    b.spinT = 0;
    if (b.reloadT <= 0 && b.mag < W.mag * 0.5) b.reloadT = W.shell ? W.reload * (W.mag - b.mag) : W.reload;
  }
  if ((!t || carrying || rushing) && !holding) {
    // 길찾기
    b.pathT -= dt;
    if (!b.path || b.pathT <= 0) {
      b.pathT = (carrying ? 0.8 : r.cfg.mode === 'ctf' ? 1.2 : 1.5) + Math.random() * 0.8;
      const goal = botGoal(r, b);
      const s = cellOf(m, bd.x, bd.y, bd.z), g = cellOf(m, goal.x, goal.y, goal.z);
      b.path = findPath(m, s[0], s[1], s[2], g[0], g[1], g[2]);
      b.lastSeen = null;
      if (!b.path) { const sp = pick(m.spawns); b.path = findPath(m, s[0], s[1], s[2], Math.floor(sp[0]), sp[1], Math.floor(sp[2])); }
    }
    if (b.path && b.path.length) {
      const n = b.path[0], tx = n[0] + 0.5, tz = n[2] + 0.5, dx = tx - bd.x, dz = tz - bd.z, d = Math.hypot(dx, dz);
      if (d < 0.35 && Math.abs(n[1] - bd.y) < 1.2) b.path.shift();
      else { mvx = dx / d; mvz = dz / d; }
      if (!t) { b.yaw += clamp(angDiff(Math.atan2(-mvx, -mvz), b.yaw), -6 * dt, 6 * dt); b.pitch *= 0.9; }
    } else if (b.path) b.path = null;
  }

  // 이동
  const sp = holding ? 0 : (wantRun || W.melee ? P.RUN * 0.92 : P.WALK) * (W.speed || 1) * (b.perks.perk_speed ? 1.12 : 1) * (b.zombie ? SH.ZB.SPEED : 1) * (now < (b.hasteUntil || 0) ? 1.35 : 1);
  // 배틀로얄: 근처 무기 줍기
  if (isBR(r) && (!b.primary || !b.secondary)) for (const d of r.drops.values()) { if (Math.hypot(d.x - bd.x, d.z - bd.z) < 1.5 && Math.abs(d.y - bd.y) < 2) { const sl = WEAPONS[d.w].slot === 'secondary' ? 'secondary' : 'primary'; if (!b[sl]) { takeDrop(r, b, d); b.w = b.primary || b.secondary; break; } } }
  const l = Math.hypot(mvx, mvz);
  if (l > 0.01) { mvx /= l; mvz /= l; }
  // 낭떠러지 맵: 앞에 발 디딜 곳이 없으면 멈춤 (구름 바다로 떨어지지 않게)
  if (m.gim && m.gim.voidY && l > 0.01 && !(bd.launchT > 0)) {
    const fx = Math.floor(bd.x + mvx * 0.9), fz = Math.floor(bd.z + mvz * 0.9);
    let safe = false; for (let y = Math.floor(bd.y) - 1; y >= Math.floor(bd.y) - 4 && y > 1; y--) if (m.solid(fx, y, fz) && !SH.HAZARD_FLOOR.has(m.get(fx, y, fz))) { safe = true; break; }
    if (!safe) { mvx = 0; mvz = 0; bd.vx *= 0.3; bd.vz *= 0.3; b.path = null; }
  }
  const acc = bd.ground ? 40 : 10;
  bd.vx += clamp(mvx * sp - bd.vx, -acc * dt, acc * dt);
  bd.vz += clamp(mvz * sp - bd.vz, -acc * dt, acc * dt);
  bd.vy -= P.GRAV * dt * (m.grav || 1);
  SH.moveBody(m, bd, dt);
  b.stuckT += dt;
  if (b.stuckT > 0.6) {
    const moved = Math.hypot(bd.x - b.lastX, bd.z - b.lastZ);
    if (moved < 0.3 && l > 0.1) { if (bd.ground) bd.vy = P.JUMP; if (moved < 0.1) b.path = null; }
    b.stuckT = 0; b.lastX = bd.x; b.lastZ = bd.z;
  }
  if (bd.y < -5) { kill(r, b, b, 'knife', false); return; }
  if (r.crates) for (const c of r.crates) if (!c.opened && now > c.landAt && Math.hypot(c.x - bd.x, c.z - bd.z) < 1.6) openCrate(r, b, c.id);
  b.x = bd.x; b.y = bd.y; b.z = bd.z;
  b.fl = 1 | (b.reloadT > 0 ? 8 : 0) | (now < b.protUntil ? 16 : 0) | (bd.ground ? 0 : 64);
}

function botFire(r, b, t, dist, W) {
  if (Date.now() < b.protUntil) b.protUntil = 0;
  const bd = b.body, ex = bd.x, ey = bd.y + P.EYE, ez = bd.z;
  const pellets = W.pellets || 1, ends = [];
  const moving = Math.hypot(b.body.vx, b.body.vz) > 1;
  let total = 0, head = false;
  for (let i = 0; i < pellets; i++) {
    let p = b.skill * 1.05 - dist / (W.scope ? 160 : 70) - W.spread * (W.pellets ? 2 : 6) - (moving ? 0.08 : 0);
    if (t.fl & 2) p -= 0.05;
    p = clamp(p, 0.05, 0.9);
    if (Math.random() < p) {
      const hr = Math.random(), part = hr < 0.08 + b.skill * 0.15 ? 'head' : hr > 0.85 ? 'legs' : 'body';
      const pm = (W.partMul || SH.PART_MUL)[part];
      total += W.dmg * SH.falloff(W, dist) * pm;
      if (part === 'head') head = true;
      const hy = part === 'head' ? 1.6 : part === 'legs' ? 0.4 : 1.1;
      ends.push([+(t.x + (Math.random() - 0.5) * 0.3).toFixed(2), +(t.y + hy).toFixed(2), +(t.z + (Math.random() - 0.5) * 0.3).toFixed(2), 1]);
    } else {
      let dx = t.x - ex, dy = t.y + 1.1 - ey, dz = t.z - ez; const l = Math.hypot(dx, dy, dz);
      dx = dx / l + (Math.random() - 0.5) * 0.12; dy = dy / l + (Math.random() - 0.5) * 0.1; dz = dz / l + (Math.random() - 0.5) * 0.12;
      const l2 = Math.hypot(dx, dy, dz); dx /= l2; dy /= l2; dz /= l2;
      const h = SH.raycast(r.map, ex, ey, ez, dx, dy, dz, 90), d = h ? h.t : 90;
      ends.push([+(ex + dx * d).toFixed(2), +(ey + dy * d).toFixed(2), +(ez + dz * d).toFixed(2), 0]);
    }
  }
  broadcast(r, { t: 'shot', id: b.id, w: b.w, e: ends });
  if (total > 0) damage(r, t, b, total, b.w, head ? 'head' : 'body');
}

GIM.init({ broadcast, explode, damage, topY });

/* ---------- 능력전 ---------- */
function teamOf(r, e) { return [...r.ents.values()].filter(o => o.alive && (o === e || sameTeam(r, e, o))); }
function enemiesOf(r, e) { return [...r.ents.values()].filter(o => o.alive && o !== e && !sameTeam(r, e, o) && !o.dummy); }
// k: 'q' 스킬 / 'x' 궁극기. 움직임(돌진·순간이동)은 시전자 클라가 직접 처리하고 서버는 확인만
function useAbility(r, e, m) {
  if (!isAbility(r) || !e.alive || r.state !== 'play') return false;
  const H = HEROES[e.hero], now = Date.now(), k = m.k === 'x' ? 'x' : 'q';
  if (!H) return false;
  if (k === 'q' && now < (e.qAt || 0)) return false;
  if (k === 'x' && (e.ult || 0) < H.x.cost) return false;
  const fx = -Math.sin(e.yaw) * Math.cos(e.pitch), fy = Math.sin(e.pitch), fz = -Math.cos(e.yaw) * Math.cos(e.pitch);
  const ev = { t: 'ab', id: e.id, h: e.hero, k };
  if (k === 'q') {
    let cd = H.q.cd;
    if (e.hero === 'jett' && now < (e.hasteUntil || 0)) cd = 1.5;
    e.qAt = now + cd * 1000;
    if (e.hero === 'sage') { for (const o of teamOf(r, e)) if (Math.hypot(o.x - e.x, o.z - e.z) < 6) { o.hp = Math.min(o.maxHp || 100, o.hp + 50); sendMe(r, o); } }
    else if (e.hero === 'sova') { ev.ids = enemiesOf(r, e).filter(o => Math.hypot(o.x - e.x, o.z - e.z) < 30).map(o => o.id); ev.until = now + 4000; ev.team = e.team; }
    else if (e.hero === 'raze') {
      const pr = { id: r.pid++, kind: 'sticky', owner: e.id, x: e.x + fx * 0.6, y: e.y + 1.5 + fy * 0.6, z: e.z + fz * 0.6, vx: fx * 19, vy: fy * 19 + 3, vz: fz * 19, fuse: ITEMS.sticky.fuse, life: 6 };
      r.projs.push(pr);
      broadcast(r, { t: 'proj', p: [pr.id, 'sticky', pr.x, pr.y, pr.z, pr.vx, pr.vy, pr.vz, e.id] });
    } else if (e.hero === 'wall') ev.blk = placeWall(r, e);
    else if (e.hero === 'ghost') { ev.from = [+e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)]; }
  } else {
    e.ult -= H.x.cost;
    if (e.hero === 'jett') e.hasteUntil = now + H.x.dur * 1000;
    else if (e.hero === 'sage') { for (const o of teamOf(r, e)) if (Math.hypot(o.x - e.x, o.z - e.z) < 8) { o.armor = Math.max(o.armor, 100); o.hp = o.maxHp || 100; sendMe(r, o); } }
    else if (e.hero === 'sova') { ev.ids = enemiesOf(r, e).map(o => o.id); ev.until = now + H.x.dur * 1000; ev.team = e.team; }
    else if (e.hero === 'raze') {
      const pr = { id: r.pid++, kind: 'rocket', owner: e.id, x: e.x + fx * 0.8, y: e.y + 1.5 + fy * 0.8, z: e.z + fz * 0.8, vx: fx * 34, vy: fy * 34, vz: fz * 34, fuse: 9, life: 6 };
      r.projs.push(pr);
      broadcast(r, { t: 'proj', p: [pr.id, 'rocket', pr.x, pr.y, pr.z, pr.vx, pr.vy, pr.vz, e.id] });
    } else if (e.hero === 'ghost') e.invisUntil = now + H.x.dur * 1000;
    else if (e.hero === 'wall') e.steelUntil = now + H.x.dur * 1000;
  }
  if (now < e.protUntil) e.protUntil = 0;
  broadcast(r, ev);
  sendMe(r, e);
  return true;
}
// 철벽 방벽: 바라보는 방향 2.5m 앞에 가로 5 × 높이 3 블록 (팀 색 양털)
function placeWall(r, e) {
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), px = -fz, pz = fx;
  const cx = e.x + fx * 2.6, cz = e.z + fz * 2.6, by = Math.floor(e.y);
  const b = e.team === 1 ? SH.B.WOOL_B : e.team === 0 ? SH.B.WOOL_R : SH.B.WOOL_W;
  const set = [], seen = new Set();
  for (let i = -2.5; i <= 2.5; i += 0.5) for (let h = 0; h < 3; h++) {
    const x = Math.floor(cx + px * i), y = by + h, z = Math.floor(cz + pz * i), k = x + ',' + y + ',' + z;
    if (seen.has(k) || x < 1 || z < 1 || x >= r.map.W - 1 || z >= r.map.D - 1 || y >= r.map.H - 1) continue;
    seen.add(k);
    if (r.map.get(x, y, z)) continue;
    // 사람이 서 있는 칸은 비워 둠
    if ([...r.ents.values()].some(o => o.alive && Math.floor(o.x) === x && Math.floor(o.z) === z && y >= Math.floor(o.y) - 1 && y <= o.y + 1.9)) continue;
    r.map.set(x, y, z, b); set.push([x, y, z, b]);
  }
  if (!set.length) return [];
  updateWalk(r.map, set);
  r.walls.push({ until: Date.now() + ABIL.WALL_LIFE, cells: set });
  broadcast(r, { t: 'blk', set });
  return set.length;
}
function abilityTick(r, now) {
  // 30초마다 궁극기 1점
  if (now - (r.ultT || now) >= ABIL.ULT_SEC * 1000) {
    r.ultT = now;
    for (const e of r.ents.values()) { e.ult = Math.min(ABIL.ULT_MAX, (e.ult || 0) + 1); sendMe(r, e); }
  }
  // 방벽 사라짐
  for (let i = r.walls.length - 1; i >= 0; i--) {
    const w = r.walls[i]; if (now < w.until) continue;
    r.walls.splice(i, 1);
    const gone = w.cells.filter(([x, y, z, b]) => r.map.get(x, y, z) === b);
    for (const [x, y, z] of gone) r.map.set(x, y, z, 0);
    if (gone.length) { updateWalk(r.map, gone); broadcast(r, { t: 'blk', set: gone.map(([x, y, z]) => [x, y, z, 0]) }); }
  }
}
// 봇 능력 사용 (간단한 규칙)
function botAbility(r, b, t, now) {
  if (Math.random() > 0.15) return; // 매 틱마다는 아니고 가끔 판단
  const H = HEROES[b.hero]; if (!H) return;
  const d = t ? Math.hypot(t.x - b.x, t.z - b.z) : 99;
  const hurt = b.hp < 65;
  if ((b.ult || 0) >= H.x.cost) {
    const go = { jett: !!t, sage: hurt, sova: true, raze: t && d > 6 && d < 30, ghost: !!t && d > 10, wall: !!t && hurt }[b.hero];
    if (go && (b.hero !== 'raze' || aimAt(b, t))) { useAbility(r, b, { k: 'x' }); return; }
  }
  if (now < (b.qAt || 0)) return;
  const go = { sage: hurt, sova: !!t || Math.random() < 0.05, raze: t && d > 5 && d < 20, wall: !!t && hurt && d > 6, jett: t && d > 9 && d < 30, ghost: t && d > 10 && d < 40 }[b.hero];
  if (go && (b.hero !== 'raze' || aimAt(b, t)) && useAbility(r, b, { k: 'q' })) botMoveAbility(r, b, t);
}
// 봇 돌진(질풍) · 순간이동(유령): 적 쪽으로
function botMoveAbility(r, b, t) {
  const bd = b.body; if (!bd || !t) return;
  const dx = t.x - bd.x, dz = t.z - bd.z, l = Math.hypot(dx, dz) || 1, fx = dx / l, fz = dz / l;
  if (b.hero === 'jett') { bd.vx = fx * ABIL.DASH; bd.vz = fz * ABIL.DASH; bd.vy = Math.max(bd.vy, 2.5); bd.ground = false; }
  else if (b.hero === 'ghost') {
    const h = SH.raycast(r.map, bd.x, bd.y + 1, bd.z, fx, 0, fz, ABIL.BLINK);
    for (let dd = h ? Math.max(0, h.t - 0.6) : Math.min(ABIL.BLINK, l - 3); dd > 0; dd -= 0.25) { const nx = bd.x + fx * dd, nz = bd.z + fz * dd; if (!SH.bodyHits(r.map, nx, bd.y, nz, P.H)) { bd.x = nx; bd.z = nz; b.x = nx; b.z = nz; break; } }
  }
}
function aimAt(b, t) { if (!t) return false; const dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz); b.yaw = Math.atan2(-dx, -dz); b.pitch = Math.atan2(t.y - b.y, d) + 0.12; return true; }

/* ---------- 경쟁전 ---------- */
// 대기 중인 경쟁전 방이 있으면 들어가고, 없으면 새로 만듦 (10초 뒤 자동 시작, 빈자리는 실력 맞춘 봇)
function rankedQueue(c, m) {
  // 경쟁전은 시작 전 방에만 들어갈 수 있음 (중간 입장 X)
  let r = [...rooms.values()].find(x => x.cfg.ranked && x.clients.size < 6 && x.state === 'wait');
  if (!r) {
    const mode = pick(RANKED.MODES);
    r = createRoom(c, { mode, map: 'village', bots: 9, time: 300, kills: 25, diff: 'hard' }, false);
    r.cfg.ranked = true; r.cfg.rmap = true; r.pub = true; r.waitSince = Date.now();
    rollRandom(r); r.cfg.rmap = false;
  }
  joinRoom(c, r, m);
  pushRoom(r);
}
function rankedStart(r) {
  const hum = [...r.ents.values()].filter(e => !e.bot);
  const avg = hum.reduce((s, e) => s + (e.rp || 0), 0) / Math.max(1, hum.length);
  r.rankSkill = RANKED.botSkill(avg);
  r.autoAt = 0;
  r.cfg.rmap = true; rollRandom(r); r.cfg.rmap = false;
  startMatch(r);
}

/* ---------- 틱 ---------- */
setInterval(() => {
  const now = Date.now(), dt = TICK / 1000;
  for (const r of rooms.values()) {
    if (r.state !== 'play') continue;
    if (isAbility(r)) abilityTick(r, now);
    if (!isSpike(r)) for (const e of r.ents.values()) if (!e.alive && e.respawnAt && now >= e.respawnAt) respawn(r, e);
    for (const e of [...r.ents.values()]) if (e.bot && e.alive && r.state === 'play') { if (e.boss) bossThink(r, e, dt, now); else botThink(r, e, dt, now); }
    if (r.state !== 'play') continue;
    if (isZombie(r)) zombieTick(r, now);
    if (isBR(r)) brTick(r, now, dt);
    if (r.state !== 'play') continue;
    if (r.state !== 'play') continue;
    if (r.flags) ctfTick(r, now);
    if (r.state !== 'play') continue;
    turretTick(r, dt, now);
    if (r.state !== 'play') continue;
    strikeTick(r, now);
    if (r.state !== 'play') continue;
    GIM.tick(r, now, dt);
    if (r.state !== 'play') continue;
    if (isSpike(r)) { spikeTick(r, now); if (r.state !== 'play') continue; }
    crateTick(r, now);
    pickupTick(r, now);
    INCOME.tick(r, now, (e, amt) => {
      if (e.money >= ECON.MAX) return;
      e.money = Math.min(ECON.MAX, e.money + amt); sendMe(r, e);
      if (!e.bot) { const c = clientOf(r, e.id); if (c) c.send({ t: 'income', amt }); }
    });
    for (let i = r.projs.length - 1; i >= 0; i--) {
      const pr = r.projs[i];
      pr.life -= dt;
      let ex = SH.stepProjectile(r.map, pr, dt);
      if (!ex && (pr.kind === 'rocket' || pr.kind === 'rock')) {
        for (const e of r.ents.values()) {
          if (!e.alive || (e.id === pr.owner && pr.life > 5.85)) continue;
          if (Math.abs(pr.x - e.x) < 0.5 && Math.abs(pr.z - e.z) < 0.5 && pr.y > e.y && pr.y < e.y + 1.9) { ex = { x: pr.x, y: pr.y, z: pr.z }; break; }
        }
      }
      if (!ex && pr.life <= 0) ex = { x: pr.x, y: pr.y, z: pr.z };
      if (ex) { r.projs.splice(i, 1); explode(r, ex.x, ex.y, ex.z, pr.owner, pr.kind); if (r.state !== 'play') break; }
    }
    if (r.state !== 'play') continue;
    for (const d of r.drops.values()) if (now > d.until) { r.drops.delete(d.id); broadcast(r, { t: 'undrop', id: d.id }); }
    const p = [];
    for (const e of r.ents.values()) {
      if (!e.alive) { p.push([e.id, 0, 0, 0, 0, 0, 0, '', 0]); continue; }
      p.push([e.id, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(3), +e.pitch.toFixed(3), e.fl | 1 | (now < e.protUntil ? 16 : 0) | (now < (e.invisUntil || 0) ? 256 : 0) | (now < (e.steelUntil || 0) ? 512 : 0) | (now < (e.hasteUntil || 0) ? 1024 : 0), e.w, Math.ceil(e.hp)]);
    }
    const j = r.projs.map(pr => [pr.id, pr.kind, +pr.x.toFixed(2), +pr.y.toFixed(2), +pr.z.toFixed(2)]);
    const msg = { t: 's', now, p, j };
    msg.tu = r.turrets.map(t => [t.id, +t.x.toFixed(2), t.y, +t.z.toFixed(2), +t.yaw.toFixed(2), t.team, t.owner, Math.ceil(t.hp)]);
    if (r.sp) msg.sp = spikeSnap(r, now);
    if (r.zone) { const z = r.zone; msg.z = [+z.cx.toFixed(1), +z.cz.toFixed(1), +z.r.toFixed(2), +z.tx.toFixed(1), +z.tz.toFixed(1), +z.tr.toFixed(1), z.at, z.phase, [...r.ents.values()].filter(e => e.alive).length]; }
    if (r.zb) msg.zb = [r.zb.started ? 1 : 0, r.zb.infectAt, [...r.ents.values()].filter(e => !e.zombie).length, [...r.ents.values()].filter(e => e.zombie).length];
    if (r.crates.length) msg.cr = r.crates.map(c => [c.id, +c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2), now >= c.landAt ? 1 : 0]);
    if (r.flags) msg.f = r.flags.map(f => [+f.x.toFixed(2), +f.y.toFixed(2), +f.z.toFixed(2), f.carrier || 0, f.atHome ? 1 : 0]);
    broadcast(r, msg);
    if (now >= r.endAt) endMatch(r);
  }
}, TICK);

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { console.log('종료 중... 저장'); await STORE.flush(); process.exit(0); });

server.listen(PORT, () => {
  console.log(`픽셀 스트라이크 서버: http://localhost:${PORT}`);
  console.log(AUTH.publicConfig().clientId ? '구글 로그인: 켜짐' : '구글 로그인: 클라이언트 ID 없음 (README 참고)');
  STORE.check().then(k => console.log('계정 저장소: ' + (k === 'supabase' ? 'Supabase (DB)' : 'data/users.json (이 컴퓨터)'))).catch(e => console.log('계정 저장소 연결 실패: ' + e.message));
  const ips = lanIPs();
  if (ips.length) console.log('같은 와이파이 친구는: ' + ips.map(ip => `http://${ip}:${PORT}`).join('  '));
});

module.exports = { findPath, rooms, handle, botGoal, cellOf, buy };
