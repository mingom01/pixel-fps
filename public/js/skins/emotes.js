// 감정표현 카탈로그 + 캐릭터 동작. free 는 처음부터 가짐, 나머지는 골드 뽑기에서 획득
// fx: 전설 감정표현은 캐릭터 주변에 입자 연출
export const EMOTES = [
  { id: 'wave', name: '손 흔들기', anim: 'wave', r: 'common', free: true },
  { id: 'gg', name: 'GG', anim: 'cheer', say: 'GG', r: 'common', free: true },
  { id: 'dance', name: '춤', anim: 'dance', r: 'common' },
  { id: 'cheer', name: '환호', anim: 'cheer', r: 'common' },
  { id: 'salute', name: '경례', anim: 'salute', r: 'common' },
  { id: 'lol', name: 'ㅋㅋㅋ', anim: 'laugh', say: 'ㅋㅋㅋ', r: 'common' },
  { id: 'thanks', name: '고마워!', anim: 'wave', say: '고마워!', r: 'common' },
  { id: 'help', name: '도와줘!', anim: 'wave', say: '도와줘!', r: 'common' },
  { id: 'clap', name: '박수', anim: 'clap', r: 'rare' },
  { id: 'bow', name: '정중한 인사', anim: 'bow', r: 'rare' },
  { id: 'flex', name: '근육 자랑', anim: 'flex', say: '힘!', r: 'rare' },
  { id: 'shrug', name: '으쓱', anim: 'shrug', say: '?', r: 'rare' },
  { id: 'point', name: '저기!', anim: 'point', say: '저기!', r: 'rare' },
  { id: 'facepalm', name: '이마 짚기', anim: 'facepalm', say: '하…', r: 'rare' },
  { id: 'robot', name: '로봇 춤', anim: 'robot', r: 'epic' },
  { id: 'floss', name: '플로스', anim: 'floss', r: 'epic' },
  { id: 'spin', name: '빙글빙글', anim: 'spin', r: 'epic' },
  { id: 'sleepy', name: '졸려…', anim: 'sleepy', say: 'zzZ', r: 'epic', fx: 'zzz' },
  { id: 'love', name: '사랑해', anim: 'heart', say: '♥', r: 'legend', fx: 'hearts' },
  { id: 'party', name: '축하 폭죽', anim: 'cheer', say: '축하해!', r: 'legend', fx: 'confetti' },
];
export const EMOTE_BY = Object.fromEntries(EMOTES.map(e => [e.id, e]));
export const FREE_EMOTES = EMOTES.filter(e => e.free).map(e => e.id);

// 캐릭터 모델에 감정표현 동작 덮어쓰기 (t: 시작 후 초)
export function applyEmote(model, anim, t) {
  const u = model.userData; if (!u.armL) return;
  const s = Math.sin(t * 9);
  switch (anim) {
    case 'dance': u.body.rotation.y = Math.sin(t * 5) * 0.6; u.armL.rotation.set(Math.PI * 0.85 + s * 0.5, 0, 0.3); u.armR.rotation.set(Math.PI * 0.85 - s * 0.5, 0, -0.3); u.legL.rotation.x = s * 0.5; u.legR.rotation.x = -s * 0.5; u.body.position.y = Math.abs(s) * 0.12; break;
    case 'wave': u.armR.rotation.set(Math.PI * 0.95, 0, -0.3 + Math.sin(t * 12) * 0.45); u.armL.rotation.set(0.15, 0, 0.1); break;
    case 'cheer': u.armL.rotation.set(Math.PI, 0, 0.35); u.armR.rotation.set(Math.PI, 0, -0.35); u.body.position.y = Math.abs(Math.sin(t * 7)) * 0.35; break;
    case 'salute': u.armR.rotation.set(Math.PI * 0.78, 0, -1.0); u.armL.rotation.set(0.05, 0, 0.05); break;
    case 'laugh': u.upper.rotation.x = 0.15 + Math.sin(t * 16) * 0.12; u.armL.rotation.set(0.9, 0, 0.6); u.armR.rotation.set(0.9, 0, -0.6); break;
    case 'clap': { const c = Math.abs(Math.sin(t * 10)); u.armL.rotation.set(1.3, 0, -0.2 - c * 0.5); u.armR.rotation.set(1.3, 0, 0.2 + c * 0.5); break; }
    case 'bow': u.upper.rotation.x = Math.min(1, t * 2) * 0.75; u.armL.rotation.set(0.1, 0, 0.1); u.armR.rotation.set(1.2, 0, 0.5); break;
    case 'flex': u.armL.rotation.set(Math.PI * 0.5, 0, 1.2 + Math.sin(t * 6) * 0.2); u.armR.rotation.set(Math.PI * 0.5, 0, -1.2 - Math.sin(t * 6) * 0.2); u.body.position.y = Math.abs(Math.sin(t * 3)) * 0.05; break;
    case 'shrug': { const k = Math.abs(Math.sin(t * 3)); u.armL.rotation.set(0.6, 0, 0.9 * k); u.armR.rotation.set(0.6, 0, -0.9 * k); u.head.rotation.z = Math.sin(t * 3) * 0.2; break; }
    case 'point': u.armR.rotation.set(Math.PI * 0.5, 0, 0); u.armL.rotation.set(0.2, 0, 0.6); u.body.rotation.y = Math.sin(t * 2) * 0.15; break;
    case 'facepalm': u.armR.rotation.set(2.6, 0, 0.5); u.upper.rotation.x = 0.25; u.head.rotation.x = 0.3; break;
    case 'robot': { const k = Math.floor(t * 4) % 4; u.armL.rotation.set([0, 1.6, 1.6, 0][k], 0, 0); u.armR.rotation.set([1.6, 0, 1.6, 0][k], 0, 0); u.head.rotation.y = [0, 0.5, 0, -0.5][k]; u.body.position.y = k % 2 ? 0.05 : 0; break; }
    case 'floss': { const k = Math.sin(t * 10); u.armL.rotation.set(0, 0, 0.5 + k * 0.4); u.armR.rotation.set(0, 0, -0.5 + k * 0.4); u.body.rotation.y = k * 0.25; u.legL.rotation.z = -k * 0.1; u.legR.rotation.z = -k * 0.1; break; }
    case 'spin': u.body.rotation.y = t * 9; u.armL.rotation.set(0, 0, 1.4); u.armR.rotation.set(0, 0, -1.4); u.body.position.y = Math.abs(Math.sin(t * 4)) * 0.2; break;
    case 'sleepy': u.head.rotation.x = 0.4 + Math.sin(t * 2) * 0.1; u.upper.rotation.x = 0.1; u.armL.rotation.set(0.1, 0, 0.15); u.armR.rotation.set(0.1, 0, -0.15); break;
    case 'heart': u.armL.rotation.set(Math.PI * 0.92, 0, -0.5); u.armR.rotation.set(Math.PI * 0.92, 0, 0.5); u.body.position.y = Math.abs(Math.sin(t * 4)) * 0.1; break;
  }
  if (u.gun) u.gun.visible = false;
}
export function clearEmotePose(model) {
  const u = model.userData; if (!u.armL) return;
  u.body.rotation.y = 0; u.body.position.y = 0; u.upper.rotation.x = 0;
  if (u.head) u.head.rotation.set(0, 0, 0);
  u.legL.rotation.z = 0; u.legR.rotation.z = 0;
  if (u.gun) u.gun.visible = true;
}

// 전설 감정표현 입자 (매 프레임 조금씩). spawn(x,y,z,vx,vy,vz,color,life,size,grav)
export function emoteFx(fx, x, y, z, spawn) {
  if (!fx || Math.random() > 0.35) return;
  if (fx === 'hearts') spawn(x + (Math.random() - 0.5) * 0.8, y + 1.6, z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, 1.4, (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? 0xff5a8a : 0xffb0c8, 1.2, 0.14, -0.3);
  else if (fx === 'confetti') spawn(x, y + 2, z, (Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5, [0xff5a5a, 0xffd84a, 0x5aff8a, 0x5ab8ff, 0xd85aff][Math.random() * 5 | 0], 1.2, 0.09, 8);
  else if (fx === 'zzz') spawn(x + 0.3, y + 2.1, z, 0.3, 0.6, 0, 0xc8d8ff, 1.4, 0.1, -0.2);
}

// 상점·뽑기용 아이콘 (말풍선 + 이름 첫 글자)
const iconCache = {};
export function emoteIcon(id, size) {
  const k = id + (size || 48); if (iconCache[k]) return iconCache[k];
  const e = EMOTE_BY[id] || EMOTES[0], n = size || 48;
  const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  const col = { common: '#c9ced9', rare: '#6ab0ff', epic: '#d68aff', legend: '#ffd84a' }[e.r];
  x.fillStyle = '#10131c'; x.fillRect(0, 0, n, n);
  x.fillStyle = col; x.fillRect(n * 0.12, n * 0.14, n * 0.76, n * 0.56); x.fillRect(n * 0.24, n * 0.7, n * 0.14, n * 0.14);
  x.fillStyle = '#10131c'; x.font = `bold ${Math.round(n * 0.32)}px Galmuri11, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText((e.say || e.name).slice(0, 2), n / 2, n * 0.43);
  return (iconCache[k] = c.toDataURL());
}
