// 내가 만든 블록(200~255번)을 블록 아틀라스에 그려 넣고 FACES 에 등록 → 에디터·게임에서 보통 블록처럼 보임
// 면 데이터: 16×16 RGB = 768바이트 → base64 1024글자. 면 순서(저장): 위, 아래, 앞(+z), 뒤(-z), 왼쪽(-x), 오른쪽(+x)
import { FACES, BLOCK_COLOR, ATLAS_COLS, CUSTOM_TILE0 } from '../tex.js';

const T = 16;
export const FACE_NAMES = ['위', '아래', '앞', '뒤', '왼쪽', '오른쪽'];
// 저장 순서 → 메시(world.js DIRS) 순서 [+x, -x, +y, -y, +z, -z]
const TO_DIRS = [5, 4, 0, 1, 2, 3];

export function faceToBytes(b64) {
  const s = atob(b64), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
export function bytesToFace(u) {
  let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}
// 한 가지 색으로 채운 면
export function solidFace(rgb) {
  const u = new Uint8Array(T * T * 3);
  for (let i = 0; i < T * T; i++) { u[i * 3] = rgb[0]; u[i * 3 + 1] = rgb[1]; u[i * 3 + 2] = rgb[2]; }
  return bytesToFace(u);
}
// 면 → 캔버스 (미리보기·아이콘용)
export function faceCanvas(b64, scale) {
  const k = scale || 1, c = document.createElement('canvas'); c.width = c.height = T * k;
  const x = c.getContext('2d'), u = faceToBytes(b64);
  for (let i = 0; i < T * T; i++) { x.fillStyle = `rgb(${u[i * 3]},${u[i * 3 + 1]},${u[i * 3 + 2]})`; x.fillRect((i % T) * k, Math.floor(i / T) * k, k, k); }
  return c;
}

// atlas = makeAtlas() 결과 { tex, cv }, cb = 맵의 cb. 그린 번호 목록을 돌려줌
export function installCustomBlocks(atlas, cb) {
  const ctx = atlas.cv.getContext('2d'), done = [];
  for (const k of Object.keys(cb || {})) {
    const id = Number(k), def = cb[k], slot = CUSTOM_TILE0 + (id - window.SH.CB_MIN) * 6;
    const tiles = [];
    let r = 0, g = 0, b = 0;
    def.f.forEach((f, fi) => {
      const ti = slot + fi, u = faceToBytes(f), img = ctx.createImageData(T, T);
      for (let i = 0; i < T * T; i++) { img.data[i * 4] = u[i * 3]; img.data[i * 4 + 1] = u[i * 3 + 1]; img.data[i * 4 + 2] = u[i * 3 + 2]; img.data[i * 4 + 3] = 255; if (fi === 2) { r += u[i * 3]; g += u[i * 3 + 1]; b += u[i * 3 + 2]; } }
      ctx.putImageData(img, (ti % ATLAS_COLS) * T, Math.floor(ti / ATLAS_COLS) * T);
      tiles[fi] = ti;
    });
    FACES[id] = TO_DIRS.map(i => tiles[i]);
    BLOCK_COLOR[id] = (Math.round(r / 256) << 16) | (Math.round(g / 256) << 8) | Math.round(b / 256);
    done.push(id);
  }
  if (done.length) atlas.tex.needsUpdate = true;
  return done;
}
