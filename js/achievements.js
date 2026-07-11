// Достижения (бейджи). Проверяются после событий партии.

import { store } from './store.js';
import { sound } from './sound.js';
import { toast } from './ui.js';

export const ACHIEVEMENTS = [
  { id: 'first_win',   ico: '🥇', name: 'Первая победа',   desc: 'Выиграть первую партию' },
  { id: 'zonk_zero',   ico: '💥', name: 'Настоящий Зонк',  desc: 'Получить 0 очков за ход' },
  { id: 'big_hand',    ico: '🔥', name: 'Крупный куш',      desc: 'Набрать 1000+ за один ход' },
  { id: 'blowout',     ico: '🚀', name: 'Разгром',          desc: 'Победить с отрывом 3000+' },
  { id: 'veteran',     ico: '🎖️', name: 'Ветеран',          desc: 'Сыграть 10 партий' },
  { id: 'last_hero',   ico: '🛡️', name: 'Последний герой',  desc: 'Выиграть в Мексику на последней жизни' },
  { id: 'night_owl',   ico: '🦉', name: 'Полуночник',       desc: 'Играть после полуночи' },
  { id: 'full_house',  ico: '👥', name: 'Полный стол',      desc: 'Партия впятером и больше' },
  { id: 'marathon',    ico: '⏱️', name: 'Марафон',          desc: 'Партия дольше 30 минут' },
  { id: 'streak3',     ico: '⚡', name: 'Хет-трик',         desc: '3 победы подряд у одного игрока' },
];

const byId = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

// Разблокировать по id (с тостом и звуком)
export function unlock(id) {
  const def = byId[id];
  if (!def) return;
  if (store.unlockAchievement(id)) {
    sound.play('achievement');
    toast(`Достижение: ${def.ico} ${def.name}`, { gold: true, duration: 3200 });
  }
}

// Проверить события хода: { type:'turn', points }
export function checkTurn(points) {
  if (points === 0) unlock('zonk_zero');
  if (points >= 1000) unlock('big_hand');
}

// Проверить события завершённой партии.
// ctx: { game, players[], winnerId, margin, durationMs, mexicoWinnerLives }
export function checkGameEnd(ctx) {
  const now = new Date();
  if (now.getHours() >= 0 && now.getHours() < 5) unlock('night_owl');
  if (ctx.players.length >= 5) unlock('full_house');
  if (ctx.durationMs >= 30 * 60 * 1000) unlock('marathon');
  if (ctx.margin >= 3000) unlock('blowout');
  if (ctx.game === 'mexico' && ctx.mexicoWinnerLives === 1) unlock('last_hero');

  // «Первая победа» + счётчики по истории (история уже содержит эту партию)
  const wins = store.history.filter(h => h.winnerId);
  if (wins.length >= 1) unlock('first_win');
  if (store.history.length >= 10) unlock('veteran');

  // 3 победы подряд у одного игрока (по последним записям истории)
  const seq = store.history.map(h => h.winnerId).filter(Boolean);
  if (seq.length >= 3 && seq[0] && seq[0] === seq[1] && seq[1] === seq[2]) unlock('streak3');
}
