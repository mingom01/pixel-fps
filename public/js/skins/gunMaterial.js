// 영웅·전설 총 스킨 재질: 램버트 재질에 빛(emissive)을 덧그려서 맥박·흐르는 띠·무지개·별빛 효과
import * as THREE from '../../lib/three.module.min.js';

const uTime = { value: 0 };
export function tickSkins(t) { uTime.value = t; }

const MODES = { pulse: 0, flow: 1, rainbow: 2, stars: 3, glitch: 4, scan: 5 };
const cache = {};

// 박스 색 키별 빛 세기 (강조 부품이 가장 밝게)
const GLOW_W = { r: 1, y: 1, c: 1, R: 0.9, l: 0.85, k: 0.35, m: 0.3, w: 0.45, t: 0.45, g: 0.45, s: 0.45, o: 0.45, W: 0.35, G: 0.35, d: 0.12, b: 0.08 };
export const glowWeight = (ck) => GLOW_W[ck] != null ? GLOW_W[ck] : 0.3;

const FRAG_HEAD = `
varying vec3 vLocal;
varying float vGlow;
uniform float uTime, uMode, uSpeed, uInv;
uniform vec3 uC1, uC2;
vec3 hue2rgb(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float hash(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
vec3 skinGlow() {
  vec3 p = vLocal * uInv;            // 총 픽셀 단위 좌표 (z = 총구 방향, 음수)
  float t = uTime * uSpeed;
  if (uMode < 0.5) {                  // pulse: 숨쉬듯 밝아졌다 어두워짐 + 두 색 교차
    float k = 0.55 + 0.45 * sin(t * 3.0);
    return mix(uC1, uC2, 0.5 + 0.5 * sin(t * 1.3)) * k * vGlow * 0.9;
  } else if (uMode < 1.5) {           // flow: 총구 쪽으로 흘러가는 빛 띠
    float band = pow(0.5 + 0.5 * sin(-p.z * 0.45 + t * 3.0 + p.y * 0.3), 6.0);
    float base = 0.35 + 0.15 * sin(t * 2.0 - p.z * 0.2);
    return (mix(uC1, uC2, band) * base + uC2 * band * 1.3) * vGlow;
  } else if (uMode < 2.5) {           // rainbow: 무지개가 총을 따라 흐름
    vec3 c = hue2rgb(fract(-p.z * 0.03 + p.y * 0.02 + t * 0.25));
    float band = pow(0.5 + 0.5 * sin(-p.z * 0.35 + t * 4.0), 8.0);
    return c * (0.55 + 0.25 * vGlow) + vec3(1.0) * band * 0.6 * vGlow;
  }
  if (uMode > 3.5 && uMode < 4.5) {   // glitch: 블록이 지지직 깜빡임
    float g = step(0.82, hash(floor(p * 0.5) + floor(t * 9.0)));
    return mix(uC1, uC2, g) * (0.35 + 0.9 * g) * vGlow;
  }
  if (uMode > 4.5) {                  // scan: 위아래로 훑는 스캔 라인
    float line = pow(0.5 + 0.5 * sin(p.y * 0.9 - t * 5.0), 14.0);
    return (uC1 * 0.35 + uC2 * line * 1.6) * vGlow;
  }
  // stars: 깊은 색 위에 반짝이는 별
  float h = hash(p * 1.3);
  float tw = step(0.93, h) * (0.5 + 0.5 * sin(t * 5.0 + h * 40.0));
  return mix(uC1, uC2, 0.5 + 0.5 * sin(p.z * 0.15 + t)) * 0.45 * vGlow + vec3(1.0) * tw * 1.4;
}
`;

// skin.glow 가 있는 스킨의 재질 (같은 스킨·크기면 재사용)
export function glowMaterial(skinId, glow, scale) {
  const key = skinId + '|' + scale;
  if (cache[key]) return cache[key];
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uni = {
    uTime, uMode: { value: MODES[glow.mode] || 0 }, uSpeed: { value: glow.speed || 1 }, uInv: { value: 1 / scale },
    uC1: { value: new THREE.Color(glow.c1) }, uC2: { value: new THREE.Color(glow.c2 != null ? glow.c2 : glow.c1) },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying vec3 vLocal;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;\nvGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + skinGlow();');
  };
  mat.customProgramCacheKey = () => 'skinglow';
  return (cache[key] = mat);
}
