// Анимация броска виртуальных кубиков: несколько случайных кадров, затем итог.

// onFrame(vals, isFinal) — isFinal=true на последнем (итоговом) кадре.
export function rollDice(count, onFrame, frames = 9) {
  let left = frames;
  const tick = () => {
    const vals = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6));
    left -= 1;
    onFrame(vals, left <= 0);
    if (left > 0) setTimeout(tick, 55 + (frames - left) * 8);
  };
  tick();
}
