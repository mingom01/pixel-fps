// 매치 기록 · 리플레이
// - 기록(점수판 요약)은 프로필에 저장 (계정 따라감) · 14일 지나면 사라짐
// - 리플레이는 이 브라우저(IndexedDB)에만 저장 · 3일 지나면 사라짐 · 최대 12개
import { profile, saveProfile } from './cosmetics.js';

export const HISTORY_DAYS = 14, REPLAY_DAYS = 3, MAX_HISTORY = 30, MAX_REPLAYS = 12;
const DAY = 864e5;

export function history() {
  if (!Array.isArray(profile.history)) profile.history = [];
  const cut = Date.now() - HISTORY_DAYS * DAY;
  if (profile.history.some(h => h.at < cut)) { profile.history = profile.history.filter(h => h.at >= cut); saveProfile(); }
  return profile.history;
}
export function addHistory(h) {
  const list = history();
  list.unshift(h);
  if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
  saveProfile();
}

/* ---------- 리플레이 녹화 ---------- */
// 서버에서 받은 메시지를 시간과 함께 그대로 모아 둠 (위치 스냅샷은 초당 10번으로 줄임)
const KEEP = new Set(['start', 's', 'shot', 'swing', 'kill', 'boom', 'proj', 'drop', 'undrop', 'score', 'flag', 'round', 'rend', 'spike', 'crate', 'cratepick', 'pk', 'emote', 'spray', 'zb', 'gg', 'boss', 'zone', 'gim', 'ab', 'blk', 'strike', 'tgone', 'gone']);
let rec = null;
export function recStart(startMsg, roomMsg, myId, now) {
  rec = { t0: now, msgs: [[now, startMsg]], room: JSON.parse(JSON.stringify(roomMsg)), myId, snapN: 0 };
}
export function recMsg(m, now) {
  if (!rec || !KEEP.has(m.t) || m.t === 'start') return;
  if (m.t === 's') { if (rec.snapN++ % 2) return; now = m.now; }
  if (m.t === 'room') rec.room = m;
  rec.msgs.push([now, m]);
  if (rec.msgs.length > 40000) rec = null; // 너무 길면 포기
}
export function recRoom(m) { if (rec) rec.room = JSON.parse(JSON.stringify(m)); }
export const recording = () => !!rec;
export function recStop() { const r = rec; rec = null; return r; }

/* ---------- IndexedDB ---------- */
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    try {
      const q = indexedDB.open('pf_replays', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('r', { keyPath: 'id' });
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    } catch (e) { rej(e); }
  });
  return dbp;
}
function tx(mode, fn) { return db().then(d => new Promise((res, rej) => { const t = d.transaction('r', mode), st = t.objectStore('r'); const out = fn(st); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); })); }
async function pack(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return { raw: json };
  const s = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return { gz: await new Response(s).blob() };
}
async function unpack(d) {
  if (d.raw) return JSON.parse(d.raw);
  const s = d.gz.stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(s).text());
}
export async function saveReplay(id, data) {
  try {
    const p = await pack(data);
    await tx('readwrite', st => st.put(Object.assign({ id, at: Date.now() }, p)));
    await purgeReplays();
    return true;
  } catch (e) { console.warn('리플레이 저장 실패', e); return false; }
}
export async function loadReplay(id) {
  try {
    const d = await tx('readonly', st => st.get(id));
    if (!d || Date.now() - d.at > REPLAY_DAYS * DAY) return null;
    return await unpack(d);
  } catch (e) { return null; }
}
export async function replayIds() {
  try {
    const all = await tx('readonly', st => st.getAll());
    return new Map((all || []).filter(d => Date.now() - d.at <= REPLAY_DAYS * DAY).map(d => [d.id, d.at]));
  } catch (e) { return new Map(); }
}
// 오래된 것 / 너무 많은 것 지우기
export async function purgeReplays() {
  try {
    const all = (await tx('readonly', st => st.getAll())) || [];
    all.sort((a, b) => b.at - a.at);
    const del = all.filter((d, i) => i >= MAX_REPLAYS || Date.now() - d.at > REPLAY_DAYS * DAY);
    if (del.length) await tx('readwrite', st => { for (const d of del) st.delete(d.id); });
  } catch (e) { /* */ }
}
