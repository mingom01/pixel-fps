// 모바일 터치 조작: 왼쪽 조이스틱(이동), 오른쪽 드래그(시점), 버튼들
// main.js 가 window.__pfTouch 로 필요한 함수를 넘겨줌
export function initTouch(T) {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!coarse && !('ontouchstart' in window) && !/[?&]touch=1/.test(location.search)) return false;
  document.body.classList.add('touch');
  const ui = document.createElement('div'); ui.id = 'touchUI'; ui.className = 'hidden';
  ui.innerHTML = `
    <div id="tStickZone"><div id="tStickBase"><div id="tStickKnob"></div></div></div>
    <div id="tLookZone"></div>
    <button class="tb big" data-b="fire">발사</button>
    <button class="tb" data-b="ads">조준</button>
    <button class="tb" data-b="jump">점프</button>
    <button class="tb" data-b="crouch">앉기</button>
    <button class="tb" data-b="reload">장전</button>
    <button class="tb" data-b="swap">무기</button>
    <button class="tb" data-b="nade">수류탄</button>
    <button class="tb" data-b="use">E 사용</button>
    <button class="tb" data-b="plant">F 설치</button>
    <button class="tb small" data-b="buy">상점</button>
    <button class="tb small" data-b="emote">감정</button>
    <button class="tb small" data-b="spray">스프레이</button>
    <button class="tb small" data-b="menu">메뉴</button>
    <button class="tb" data-b="abq">Q 스킬</button>
    <button class="tb" data-b="abx">X 궁극</button>
    <button class="tb small" data-b="inspect">살펴보기</button>`;
  document.body.appendChild(ui);
  const K = T.keys;
  // 조이스틱
  const zone = ui.querySelector('#tStickZone'), base = ui.querySelector('#tStickBase'), knob = ui.querySelector('#tStickKnob');
  let stickId = null, sx = 0, sy = 0;
  const setMove = (x, y) => {
    K.KeyW = y < -0.3; K.KeyS = y > 0.3; K.KeyA = x < -0.3; K.KeyD = x > 0.3;
    K.ShiftLeft = Math.hypot(x, y) > 0.95 && y < -0.5;
  };
  zone.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; stickId = t.identifier; sx = t.clientX; sy = t.clientY;
    base.style.left = (sx - 60) + 'px'; base.style.top = (sy - 60) + 'px'; base.classList.add('on'); e.preventDefault();
  }, { passive: false });
  // 시점 드래그 (오른쪽 화면 + 발사 버튼)
  const lookIds = new Map();
  const lookZone = ui.querySelector('#tLookZone');
  lookZone.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) lookIds.set(t.identifier, [t.clientX, t.clientY]); e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = (t.clientX - sx) / 55, dy = (t.clientY - sy) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        knob.style.transform = `translate(${dx * 45}px, ${dy * 45}px)`; setMove(dx, dy);
      } else if (lookIds.has(t.identifier)) {
        const [px, py] = lookIds.get(t.identifier);
        T.look((t.clientX - px) * 1.6, (t.clientY - py) * 1.6);
        lookIds.set(t.identifier, [t.clientX, t.clientY]);
      }
    }
  }, { passive: true });
  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; setMove(0, 0); knob.style.transform = ''; base.classList.remove('on'); }
      lookIds.delete(t.identifier);
    }
  };
  window.addEventListener('touchend', endTouch); window.addEventListener('touchcancel', endTouch);
  // 버튼
  ui.querySelectorAll('.tb').forEach(btn => {
    const b = btn.dataset.b;
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation(); btn.classList.add('down');
      const t = e.changedTouches[0];
      if (b === 'fire') { T.WS.trigger = true; T.WS.semiReady = true; lookIds.set(t.identifier, [t.clientX, t.clientY]); }
      else if (b === 'ads') T.WS.adsHeld = !T.WS.adsHeld;
      else if (b === 'jump') T.press('Space');
      else if (b === 'crouch') { if (!K.KeyC) T.press('KeyC'); K.KeyC = true; }
      else if (b === 'reload') T.press('KeyR');
      else if (b === 'swap') T.cycle(1);
      else if (b === 'nade') T.press('KeyG');
      else if (b === 'use') { T.press('KeyE'); K.KeyE = true; }
      else if (b === 'plant') K.KeyF = true;
      else if (b === 'buy') T.key('KeyB');
      else if (b === 'emote') T.press('KeyY');
      else if (b === 'spray') T.press('KeyT');
      else if (b === 'menu') T.pause();
      else if (b === 'abq') T.press('KeyQ');
      else if (b === 'abx') T.press('KeyX');
      else if (b === 'inspect') T.press('KeyF');
    }, { passive: false });
    const up = (e) => {
      btn.classList.remove('down');
      if (b === 'fire') { T.WS.trigger = false; for (const t of e.changedTouches) lookIds.delete(t.identifier); }
      else if (b === 'crouch') K.KeyC = false;
      else if (b === 'use') K.KeyE = false;
      else if (b === 'plant') K.KeyF = false;
    };
    btn.addEventListener('touchend', up); btn.addEventListener('touchcancel', up);
  });
  // 게임 중에만 보이기 (메뉴/상점 열리면 숨김)
  setInterval(() => {
    const show = T.inGame() && !T.modal();
    ui.classList.toggle('hidden', !show);
    ui.querySelector('[data-b="ads"]').classList.toggle('on', !!T.WS.adsHeld);
    ui.querySelector('[data-b="plant"]').style.display = T.mode() === 'spike' ? '' : 'none';
    for (const k of ['abq', 'abx']) ui.querySelector('[data-b="' + k + '"]').style.display = T.mode() === 'ability' ? '' : 'none';
  }, 200);
  return true;
}
