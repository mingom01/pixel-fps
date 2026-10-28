// 맵 에디터 같이 만들기 (온라인 편집 세션)
// 방장이 '온라인 열기' → 4자리 코드, 친구들은 메인 화면 '방 코드'로 참가해서 같이 블록을 놓고 부숨
// 서버가 맵 원본을 들고 있고, 블록 변경은 받은 순서대로 적용해서 모두(보낸 사람 포함)에게 돌려줌 → 모두 같은 맵이 됨
const MAX_MEMBERS = 8, MAX_SETS_PER_SEC = 80;

// deps: { SH, genCode, log, cleanName, leaveRoom, gameCheck(ent) → 오류 문구, toGame(host, members, ent) }
module.exports = function makeEditRooms(deps) {
  const { SH } = deps;
  const sessions = new Map(); // code → 세션
  const MAXB = Math.max(...Object.values(SH.B));

  const memberList = (s) => [...s.members.values()].map(m => ({ id: m.c.id, name: m.name, color: m.color, host: m.c.id === s.hostId }));
  const send = (s, msg, except) => { const j = JSON.stringify(msg); for (const m of s.members.values()) if (m.c !== except) m.c.send(j); };
  const snapshot = (s) => Object.assign({ name: s.name, theme: s.theme, cb: s.map.cb || {}, mk: s.map.mk || {} }, SH.encodeMap(s.map));
  const pushMembers = (s) => send(s, { t: 'edmembers', code: s.code, host: s.hostId, members: memberList(s) });

  function addMember(s, c, m) {
    s.members.set(c.id, { c, name: deps.cleanName(m.name), color: Math.max(0, Math.min(11, Math.round(Number(m.color) || 0))), info: m, setT: 0, setN: 0 });
    c.edit = s;
  }

  // 방장이 지금 편집 중인 맵으로 세션 열기
  function open(c, m) {
    leave(c);
    const ent = m.ent || {};
    const map = SH.mapFromData(ent);
    if (!map) { c.send({ t: 'err', text: '맵이 너무 커서 온라인으로 열 수 없어요' }); return; }
    const s = { code: deps.genCode(), hostId: c.id, map, name: String(ent.name || '내 맵').slice(0, 16), theme: map.theme, members: new Map() };
    sessions.set(s.code, s);
    addMember(s, c, m);
    deps.log(`맵 편집 ${s.code} 열림 (${s.name})`);
    c.send({ t: 'edopened', code: s.code, host: s.hostId, members: memberList(s) });
  }

  // 친구가 코드로 참가 → 지금 맵 전체를 받음
  function join(c, s, m) {
    if (s.members.size >= MAX_MEMBERS) { c.send({ t: 'err', text: `같이 만들기는 ${MAX_MEMBERS}명까지예요` }); return; }
    leave(c);
    addMember(s, c, m);
    c.send({ t: 'edjoined', code: s.code, host: s.hostId, ent: snapshot(s), members: memberList(s) });
    pushMembers(s);
    send(s, { t: 'sys', text: `${s.members.get(c.id).name} 님이 맵 만들기에 들어왔어요` }, c);
  }

  function close(s, text) {
    sessions.delete(s.code);
    for (const m of s.members.values()) { m.c.edit = null; if (text) m.c.send({ t: 'edclosed', text }); }
    deps.log(`맵 편집 ${s.code} 닫힘`);
  }

  // 나가기 (방장이 나가면 세션 끝)
  function leave(c, quiet) {
    const s = c.edit; if (!s) return;
    const me = s.members.get(c.id);
    s.members.delete(c.id); c.edit = null;
    if (c.id === s.hostId || !s.members.size) { close(s, quiet ? null : '방장이 맵 만들기를 끝냈어요'); return; }
    pushMembers(s);
    send(s, { t: 'sys', text: `${me ? me.name : '누군가'} 님이 나갔어요` });
  }

  function setBlock(c, s, m) {
    const me = s.members.get(c.id), now = Date.now();
    if (now - me.setT > 1000) { me.setT = now; me.setN = 0; }
    if (++me.setN > MAX_SETS_PER_SEC) return; // 너무 빠른 연속 입력은 무시
    const x = m.x | 0, y = m.y | 0, z = m.z | 0, b = m.b | 0, map = s.map;
    if (x < 0 || z < 0 || x >= map.W || z >= map.D || y < 1 || y >= map.H || b < 0 || (b > MAXB && !(map.cb && map.cb[b])) || b === SH.B.BEDROCK) return;
    if (map.get(x, y, z) === b) return;
    map.set(x, y, z, b);
    send(s, { t: 'edset', x, y, z, b, by: c.id });
  }

  // 내가 만든 블록을 이 맵에 등록 (같은 '내 블록'이면 번호 재사용하고 그림만 갱신) → 모두에게 번호와 그림 전달
  function defineBlock(c, s, m) {
    const def = SH.cleanCb({ [SH.CB_MIN]: m.def })[SH.CB_MIN];
    if (!def) return;
    const cb = s.map.cb || (s.map.cb = {});
    let id = Object.keys(cb).map(Number).find(k => def.lib && cb[k].lib === def.lib);
    if (id == null) for (let k = SH.CB_MIN; k <= SH.CB_MAX; k++) if (!cb[k]) { id = k; break; }
    if (id == null) { c.send({ t: 'err', text: `한 맵에는 내가 만든 블록을 ${SH.CB_MAX - SH.CB_MIN + 1}종까지 쓸 수 있어요` }); return; }
    cb[id] = def;
    send(s, { t: 'edcb', id, def, by: c.id });
  }

  // 스폰·깃발·힐팩·보급 표시: 바뀐 표시 목록 전체를 받아서 검사하고 모두에게 전달
  function setMarkers(c, s, m) {
    s.map.mk = SH.cleanMk(m.mk, s.map);
    send(s, { t: 'edmk', mk: s.map.mk, by: c.id }, c);
  }

  // 메시지 처리 (맵 편집 관련이면 true)
  function handle(c, m) {
    if (m.t === 'edopen') { deps.leaveRoom(c); open(c, m); return true; }
    if (!String(m.t).startsWith('ed')) return false;
    const s = c.edit;
    if (m.t === 'edleave') { leave(c); return true; }
    if (!s) return true;
    if (m.t === 'edset') setBlock(c, s, m);
    else if (m.t === 'edcb') defineBlock(c, s, m);
    else if (m.t === 'edmk') setMarkers(c, s, m);
    else if (m.t === 'edresize' && c.id === s.hostId) { // 방장이 맵 높이를 바꿈 (모두 같은 방식으로 자름/늘림)
      const H = Math.max(12, Math.min(SH.MAP_MAX.H, m.H | 0));
      if (H !== s.map.H) { s.map = SH.resizeMapH(s.map, H); send(s, { t: 'edresize', H }, c); }
    }
    else if (m.t === 'edpos') send(s, { t: 'edpos', id: c.id, p: [m.x, m.y, m.z, m.yaw].map(v => Math.round((Number(v) || 0) * 100) / 100) }, c);
    else if (m.t === 'edmeta' && c.id === s.hostId) {
      s.name = String(m.name || s.name).slice(0, 16);
      if (SH.MAPS[m.theme] && (SH.MAPS[m.theme].kind || 'normal') === 'normal') s.theme = m.theme;
      send(s, { t: 'edmeta', name: s.name, theme: s.theme }, c);
    } else if (m.t === 'edtest' && c.id === s.hostId) {
      // 다 같이 테스트: 지금 맵으로 게임 방을 만들고 모두 데려감 (세션은 끝)
      const ent = Object.assign({ id: String(m.id || '') }, snapshot(s));
      const err = deps.gameCheck(ent);
      if (err) { c.send({ t: 'err', text: err }); return true; }
      const members = [...s.members.values()];
      close(s, null); // 먼저 세션을 닫아야 게임 방에 들어갈 때 '방장이 끝냈어요' 안내가 안 감
      deps.toGame(c, members, ent);
    }
    return true;
  }

  return { handle, join, leave, has: (code) => sessions.has(code), get: (code) => sessions.get(code) };
};
