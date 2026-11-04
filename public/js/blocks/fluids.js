// 물·용암 텍스처 (16×16, 출렁이며 움직임) — world.js 의 액체 메시가 씀
import * as THREE from '../../lib/three.module.min.js';

const T = 16;
function makeTex(draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = T;
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  return { cv, ctx: cv.getContext('2d'), tex, draw };
}
// 물: 파란 바탕 + 흘러가는 밝은 물결
const water = makeTex((x, t) => {
  for (let y = 0; y < T; y++) for (let i = 0; i < T; i++) {
    const w = Math.sin((i + t * 3) * 0.7 + Math.sin((y + t * 2) * 0.5) * 1.6) + Math.sin((y - t * 2.5) * 0.9 + i * 0.3);
    const k = w > 1.2 ? 1.25 : w > 0.4 ? 1.08 : w < -1.1 ? 0.86 : 1;
    x.fillStyle = `rgb(${Math.min(255, 48 * k) | 0},${Math.min(255, 118 * k) | 0},${Math.min(255, 220 * k) | 0})`; x.fillRect(i, y, 1, 1);
  }
});
// 용암: 주황 바탕 + 천천히 꿈틀대는 노란·검붉은 무늬
const lava = makeTex((x, t) => {
  for (let y = 0; y < T; y++) for (let i = 0; i < T; i++) {
    const w = Math.sin(i * 0.8 + t * 0.9 + Math.sin(y * 0.6 + t * 0.7) * 2) + Math.cos(y * 0.7 - t * 0.6 + i * 0.25);
    const c = w > 1.1 ? [255, 228, 90] : w > 0.2 ? [255, 140, 30] : w > -0.9 ? [220, 80, 20] : [150, 40, 15];
    x.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; x.fillRect(i, y, 1, 1);
  }
});
for (const f of [water, lava]) { f.draw(f.ctx, 0); f.tex.needsUpdate = true; }

export const waterTex = water.tex, lavaTex = lava.tex;

// 매 프레임 호출: 0.12초마다 다시 그림 (출렁임)
let last = 0;
export function tickFluidTex(sec) {
  if (sec - last < 0.12) return;
  last = sec;
  for (const f of [water, lava]) { f.draw(f.ctx, sec); f.tex.needsUpdate = true; }
}
