// Звуки генерируются на лету через Web Audio API — без аудиофайлов,
// чтобы не ломать офлайн-кэш и не тащить лишние ресурсы.

import { store } from './store.js';

let ctx = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

function tone(freq, start, dur, type = 'sine', gain = 0.2) {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

const PATTERNS = {
  tap:    () => tone(520, 0, 0.06, 'triangle', 0.12),
  add:    () => { tone(440, 0, 0.08, 'sine', 0.15); tone(660, 0.05, 0.1, 'sine', 0.15); },
  minus:  () => tone(200, 0, 0.18, 'sawtooth', 0.14),
  zonk:   () => { tone(300, 0, 0.14, 'sawtooth', 0.18); tone(160, 0.12, 0.28, 'sawtooth', 0.18); },
  roll:   () => { for (let i = 0; i < 5; i++) tone(300 + Math.random() * 400, i * 0.05, 0.05, 'square', 0.06); },
  win:    () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25, 'triangle', 0.2)); },
  achievement: () => { [784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.2, 'sine', 0.18)); },
};

export const sound = {
  play(name) {
    if (!store.settings.sound) return;
    const c = ac();
    if (c && c.state === 'suspended') c.resume();
    (PATTERNS[name] || (() => {}))();
  },
  // разблокировать аудио по первому касанию (политика браузеров)
  unlock() {
    const c = ac();
    if (c && c.state === 'suspended') c.resume();
  },
};
