// Подсчёт очков броска в Зонке по правилам (для виртуальных кубиков).
// Возвращает лучший вариант очков для набора костей.

export function scoreZonkRoll(dice) {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d] += 1;
  const n = dice.length;
  const options = [];

  // Большой стрит 1–6
  if (n === 6 && counts.slice(1).every(c => c === 1)) {
    options.push({ score: 1500, label: 'Большой стрит 1–6' });
  }

  // Три пары (ровно три значения по две кости)
  if (n === 6 && counts.filter(c => c === 2).length === 3) {
    options.push({ score: 1500, label: 'Три пары' });
  }

  // Малые стриты используют 5 костей; шестая — одиночка (1 или 5 дают очки)
  const smallStraight = (from, to, base, name) => {
    for (let f = from; f <= to; f++) if (counts[f] < 1) return;
    const rest = [...counts];
    for (let f = from; f <= to; f++) rest[f] -= 1;
    const extra = rest[1] * 100 + rest[5] * 50;
    options.push({ score: base + extra, label: name + (extra ? ` +${extra}` : '') });
  };
  if (n === 6) {
    smallStraight(1, 5, 500, 'Малый стрит 1–5');
    smallStraight(2, 6, 750, 'Малый стрит 2–6');
  }

  // Общий подсчёт: тройки и больше + одиночные «1» и «5»
  {
    let score = 0;
    for (let f = 1; f <= 6; f++) {
      const c = counts[f];
      if (c >= 3) {
        const base = f === 1 ? 1000 : f * 100;
        const mult = c === 3 ? 1 : c === 4 ? 2 : c === 5 ? 4 : 8;
        score += base * mult;
      } else if (f === 1) {
        score += c * 100;
      } else if (f === 5) {
        score += c * 50;
      }
    }
    options.push({ score, label: 'Комбинации' });
  }

  const best = options.reduce((a, b) => (b.score > a.score ? b : a), { score: 0, label: '' });
  return { score: best.score, label: best.label, isZonk: best.score === 0 };
}
