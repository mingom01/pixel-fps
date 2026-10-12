// 공중 항구 (스파이크 전용) — 기믹: 구름 위 플랫폼(떨어지면 즉사) + 사이트 사이를 넘나드는 점프대
(function (SH) {
  const { VMap, B, G, rng, house } = SH.MAPKIT;
  const PADS = [
    { at: [22, 6, 23, 7], to: [10.5, G, 20.5], h: 6 }, // 수비 진영 → A
    { at: [40, 6, 41, 7], to: [52.5, G, 20.5], h: 6 }, // 수비 진영 → B
    { at: [17, 28, 18, 29], to: [46.5, G, 28.5], h: 8 }, // A 앞 → B 앞 (공중 회전)
    { at: [45, 28, 46, 29], to: [17.5, G, 26.5], h: 8 }, // B 앞 → A 앞
    { at: [26, 52, 27, 53], to: [31.5, G, 38.5], h: 6 }, // 공격 진영 → 가운데 다리
  ];

  function deck(m, x0, z0, x1, z1, top) {
    m.fill(x0, 1, z0, x1, 2, z1, B.METAL);
    m.fill(x0, 3, z0, x1, 3, z1, top || B.PLANKS);
  }

  function build() {
    const m = new VMap(64, 26, 64), r = rng(281);
    m.fill(0, 0, 0, 63, 0, 63, B.VOIDB);
    // 진영
    deck(m, 18, 1, 45, 11, B.CONCRETE); // 수비
    deck(m, 18, 48, 45, 62, B.CONCRETE); // 공격
    // 사이트 (넓은 갑판)
    deck(m, 2, 12, 20, 30, B.DARKWOOD); deck(m, 43, 12, 61, 30, B.DARKWOOD);
    // 길: 수비 진영 ↔ 사이트, 공격 진영 → 레인 → 사이트
    deck(m, 10, 7, 17, 11); deck(m, 46, 7, 53, 11);
    deck(m, 4, 31, 12, 52); deck(m, 51, 31, 59, 52); deck(m, 4, 49, 17, 56); deck(m, 46, 49, 59, 56);
    // 가운데 좁은 다리 (공격 진영 → 수비 진영)
    deck(m, 30, 12, 33, 47);
    m.fill(28, 3, 28, 35, 3, 35, B.PLANKS); m.fill(28, 1, 28, 35, 2, 35, B.METAL);
    // 난간
    const rail = (x0, z0, x1, z1) => m.fill(x0, G, z0, x1, G, z1, B.METAL);
    rail(29, 12, 29, 27); rail(34, 12, 34, 27); rail(29, 36, 29, 47); rail(34, 36, 34, 47);
    // 비행선 (진영 뒤 엄폐물·지붕)
    house(m, { x: 24, z: 2, w: 16, d: 5, h: 3, wall: B.PANEL, corner: B.METAL, floor: B.CONCRETE, roof: B.METAL, doors: ['s'], doorW: 4, parapet: false });
    house(m, { x: 24, z: 56, w: 16, d: 5, h: 3, wall: B.PANEL, corner: B.METAL, floor: B.CONCRETE, roof: B.METAL, doors: ['n'], doorW: 4, parapet: false });
    // 사이트 화물 상자
    for (const [x, z] of [[5, 15], [14, 24], [16, 15], [5, 26], [9, 20], [47, 15], [56, 24], [58, 15], [47, 26], [53, 20]]) m.fill(x, G, z, x + 1, G + (r() < 0.5 ? 1 : 0), z + 1, B.CRATE);
    for (const [x, z] of [[7, 38], [9, 45], [54, 38], [56, 45], [31, 20], [32, 42]]) m.fill(x, G, z, x, G, z, B.CRATE);
    // 점프대
    for (const p of PADS) m.fill(p.at[0], 3, p.at[1], p.at[2], 3, p.at[3], B.JUMPPAD);
    return m;
  }

  SH.registerMap('skyport', {
    name: '공중 항구', kind: 'spike', build, sky: [0x5aa8f0, 0xf0f8ff], fog: 0xe0f0ff, sun: 1.1, fogFar: 170,
    desc: '스파이크 · 점프대 · 추락 주의',
    spike: { atk: [24, 50, 39, 54], def: [24, 8, 39, 10], A: [3, 13, 19, 29], B: [44, 13, 60, 29] },
    gim: { voidY: 1.6, pads: PADS },
  });
})(typeof module === 'object' && module.exports ? require('../shared.js') : window.SH);
