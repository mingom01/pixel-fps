// 물·용암 속 화면: 눈(카메라)이 물 안에 있으면 마크처럼 파랗게 물들고 안개가 가까워짐 (용암은 주황·거의 안 보임)
import * as THREE from '../../lib/three.module.min.js';

const el = document.createElement('div');
el.id = 'underwater';
document.body.appendChild(el);
const FOGS = { 1: new THREE.Fog(0x1e4fa8, 0.5, 24), 2: new THREE.Fog(0xc8501a, 0.1, 3.5) };
const isFluidFog = (f) => f === FOGS[1] || f === FOGS[2];
let saved = null, cur = 0;

// 매 프레임 (게임·에디터): map 이 없으면 끔
export function updateUnderwater(scene, map, pos) {
  const t = map ? window.SH.FL_TYPE[map.get(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z))] : 0;
  if (t) { if (!isFluidFog(scene.fog)) saved = scene.fog; scene.fog = FOGS[t]; }
  else if (isFluidFog(scene.fog)) scene.fog = saved;
  if (t !== cur) { cur = t; el.className = t === 1 ? 'water' : t === 2 ? 'lava' : ''; }
}
