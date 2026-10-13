// 시간 보너스 돈이 들어올 때 돈 표시 옆에 "+$250" 이 떠올랐다 사라짐
const pop = document.createElement('span');
pop.className = 'moneypop';

export function showIncome(amt) {
  const m = document.getElementById('money'); if (!m) return;
  if (pop.parentNode !== m) m.appendChild(pop);
  pop.textContent = `+$${amt} 시간 보너스`;
  pop.classList.remove('on'); void pop.offsetWidth; pop.classList.add('on');
}
