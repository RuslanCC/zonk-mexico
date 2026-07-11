// Партия «Мексика»: модель на жизнях, выбывание, последний оставшийся побеждает.

import { store, nowISO } from './store.js';
import { $, avatarHtml, escapeHtml, toast, fmtDuration, confirmDialog } from './ui.js';
import { sound } from './sound.js';
import { GameTimer } from './timer.js';
import { renderSetup, finishGame, renderWin } from './game-common.js';
import { rollDice } from './dice.js';

export function renderMexico(el) {
  let cleanupBoard = null; // фактическая очистка доски (регистрируется у роутера)
  const existing = store.currentGame;
  if (existing && existing.game === 'mexico') {
    cleanupBoard = board(el, existing);
  } else {
    renderSetup(el, 'mexico', players => {
      const lives = store.settings.mexicoLives || 6;
      const game = {
        game: 'mexico',
        startLives: lives,
        players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, lives, out: false })),
        timer: { accumulatedMs: 0, startedAt: null },
        startedAt: nowISO(),
        currentBet: null,
        log: [],
      };
      store.setCurrentGame(game);
      cleanupBoard = board(el, game);
    });
  }
  return () => { if (cleanupBoard) cleanupBoard(); };
}

function board(el, game) {
  const timer = new GameTimer(game.timer);
  timer.start();
  persist();

  const onHide = () => { timer.pause(); persist(); };
  const onVis = () => { if (document.hidden) onHide(); };
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onVis);

  function persist() { game.timer = timer.snapshot(); store.setCurrentGame(game); }

  function draw() {
    const alive = game.players.filter(p => !p.out).length;
    el.innerHTML = `
      <div class="screen">
        <div class="gamebar">
          <span class="timer" id="timer">${fmtDuration(timer.elapsed())}</span>
          <button class="iconbtn" id="pause">${timer.running ? '⏸️' : '▶️'}</button>
          <span class="pill">👥 в игре: ${alive}</span>
          <button class="btn btn--ghost" id="quit" style="margin-left:auto;padding:8px 12px">Выйти</button>
        </div>

        <p class="sub">Нажмите «−» тому, кто проиграл раунд и теряет жизнь. «+» вернёт по ошибке снятую.</p>

        <div class="card" style="margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-weight:700">🎯 Ставка раунда</span>
          <select class="select" id="bet" style="flex:1;min-width:130px">
            <option value="">— не задана —</option>
            ${MEXICO_ROLLS.map(v => `<option value="${v}" ${game.currentBet === v ? 'selected' : ''}>${betLabel(v)}</option>`).join('')}
          </select>
          <button class="iconbtn" id="bet-reset" aria-label="Новый раунд" title="Новый раунд">↺</button>
        </div>

        <div id="players">${game.players.map(playerCard).join('')}</div>

        <div style="margin-top:6px">
          <button class="btn btn--ghost btn--block" id="undo" ${game.log.length ? '' : 'disabled'}>↩︎ Отменить последнее</button>
        </div>

        <details class="acc" style="margin-top:14px">
          <summary>🎲 Бросить 2 кубика</summary>
          <div class="acc__body">
            <div class="dice-tray" id="tray"></div>
            <div id="roll-result" style="text-align:center;font-weight:800;min-height:1.2em;margin:4px 0"></div>
            <button class="btn btn--block" id="roll">Бросок</button>
          </div>
        </details>
      </div>`;

    $('#pause', el).addEventListener('click', () => { timer.toggle(); persist(); draw(); });
    $('#quit', el).addEventListener('click', quit);
    $('#undo', el).addEventListener('click', undo);

    $('#bet', el).addEventListener('change', e => {
      game.currentBet = e.target.value ? parseInt(e.target.value, 10) : null;
      persist();
    });
    $('#bet-reset', el).addEventListener('click', () => {
      game.currentBet = null;
      sound.play('tap');
      draw();
    });

    el.querySelectorAll('[data-minus]').forEach(b =>
      b.addEventListener('click', () => changeLife(+b.dataset.minus, -1)));
    el.querySelectorAll('[data-plus]').forEach(b =>
      b.addEventListener('click', () => changeLife(+b.dataset.plus, +1)));

    const tray = $('#tray', el);
    const result = $('#roll-result', el);
    // старший кубик — слева, младший — справа
    const paint = vals => { tray.innerHTML = [...vals].sort((a, b) => b - a).map(dieHtml).join(''); };
    paint([2, 1]);
    result.textContent = '';
    $('#roll', el).addEventListener('click', () => {
      sound.play('roll');
      result.textContent = '';
      rollDice(2, (vals, done) => {
        paint(vals);
        if (done) result.textContent = describeRoll(Math.max(...vals), Math.min(...vals));
      });
    });
  }

  function changeLife(index, delta) {
    const pl = game.players[index];
    if (delta < 0 && (pl.out || pl.lives <= 0)) return;
    if (delta > 0 && pl.lives >= game.startLives) return;

    game.log.push({ playerIndex: index, delta });
    pl.lives += delta;
    if (pl.lives <= 0) { pl.lives = 0; pl.out = true; }
    else pl.out = false;

    // потеря жизни завершает раунд — ставка сбрасывается на новый
    if (delta < 0) game.currentBet = null;

    sound.play(delta < 0 ? 'minus' : 'add');
    if (pl.out) toast(`${pl.name} выбывает!`);

    const alive = game.players.filter(p => !p.out);
    if (alive.length === 1 && game.players.length > 1) return finish(alive[0]);

    persist();
    draw();
  }

  function undo() {
    const last = game.log.pop();
    if (!last) return;
    const pl = game.players[last.playerIndex];
    pl.lives -= last.delta;
    pl.out = pl.lives <= 0;
    sound.play('tap');
    persist();
    draw();
  }

  async function quit() {
    if (await confirmDialog('Выйти из партии? Прогресс будет потерян.')) {
      cleanup();
      store.clearCurrentGame();
      location.hash = '#/home';
    }
  }

  function finish(winner) {
    timer.pause();
    const durationMs = timer.elapsed();
    const standings = [...game.players].sort((a, b) => b.lives - a.lives)
      .map(p => ({ id: p.id, name: p.name, value: p.lives }));
    finishGame('mexico', game.players, durationMs, {
      winnerId: winner.id,
      startedAt: game.startedAt,
      standings,
      mexicoWinnerLives: winner.lives,
    });
    cleanup();
    renderWin(el, 'mexico', winner, durationMs, `осталось жизней: ${winner.lives}`);
  }

  function playerCard(pl, i) {
    const hearts = Array.from({ length: game.startLives }, (_, k) =>
      `<span class="heart ${k < pl.lives ? '' : 'heart--lost'}">${k < pl.lives ? '❤️' : '🤍'}</span>`).join('');
    return `
      <div class="player-card ${pl.out ? 'player-card--out' : ''}">
        ${avatarHtml(pl)}
        <div class="row__main">
          <div class="player-card__name">${escapeHtml(pl.name)} ${pl.out ? '☠️' : ''}</div>
          <div class="lives">${hearts}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="iconbtn iconbtn--danger" data-minus="${i}" ${pl.out ? 'disabled' : ''} aria-label="−1">➖</button>
          <button class="iconbtn" data-plus="${i}" ${pl.lives >= game.startLives ? 'disabled' : ''} aria-label="+1">➕</button>
        </div>
      </div>`;
  }

  let cleaned = false;
  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    timer.destroy();
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onVis);
  }

  timer.onTick(() => { const t = $('#timer', el); if (t) t.textContent = fmtDuration(timer.elapsed()); });
  draw();
  return cleanup;
}

// Все броски Мексики по возрастанию старшинства:
// обычные (31…65) < дубли (11…66) < Мексика (21).
const MEXICO_ROLLS = [31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65, 11, 22, 33, 44, 55, 66, 21];

function betLabel(v) {
  if (v === 21) return '🌶️ Мексика (21)';
  const hi = Math.floor(v / 10), lo = v % 10;
  return hi === lo ? `Дубль ${v}` : String(v);
}

function describeRoll(a, b) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi === 2 && lo === 1) return '🌶️ МЕКСИКА! (21) — старший бросок';
  if (a === b) return `Дубль ${a}${b}`;
  return `${hi}${lo}`;
}

function dieHtml(v) {
  const pips = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  }[v] || [];
  let cells = '';
  for (let i = 0; i < 9; i++) cells += pips.includes(i) ? '<span></span>' : '<i></i>';
  return `<div class="die">${cells}</div>`;
}
