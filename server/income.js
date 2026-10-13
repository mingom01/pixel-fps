// 시간 보너스: 킬을 못 해도 판이 길어질수록 돈이 쌓여서 좋은 총을 살 수 있게
// 살아있든 죽었든 10초마다 모두에게 지급, 판이 오래될수록 금액이 커짐
const EVERY = 10000;
// [시작 후 몇 초부터, 10초마다 지급액]
const STEPS = [[0, 50], [60, 100], [120, 150], [180, 250]];
const MODES = ['ffa', 'tdm', 'ctf'];

const amountAt = (sec) => { let a = 0; for (const [t, v] of STEPS) if (sec >= t) a = v; return a; };

function start(r, now) { r.income = { t0: now, next: now + EVERY }; }

// pay(e, amount): 돈 넣고 클라에 알리기 (server.js 에서 넘겨줌)
function tick(r, now, pay) {
  const inc = r.income;
  if (!inc || !MODES.includes(r.cfg.mode) || now < inc.next) return;
  inc.next += EVERY;
  const amt = amountAt((now - inc.t0) / 1000);
  for (const e of r.ents.values()) if (!e.boss) pay(e, amt);
}

module.exports = { start, tick, amountAt };
