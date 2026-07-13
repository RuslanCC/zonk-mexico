// Партия «Зонк»: ручное табло, тотал, ход за ходом, Undo, таймер, виртуальные кости.

import { store, nowISO } from './store.js';
import { $, avatarHtml, escapeHtml, toast, fmtDuration, confirmDialog } from './ui.js';
import { sound } from './sound.js';
import { GameTimer } from './timer.js';
import { renderSetup, finishGame, renderWin } from './game-common.js';
import { checkTurn } from './achievements.js';
import { rollDice } from './dice.js';
import { scoreZonkRoll } from './zonk-score.js';
import { gameHelpHtml } from './game-help.js';

export function renderZonk(el) {
  let cleanupBoard = null; // фактическая очистка доски (регистрируется у роутера)
  const existing = store.currentGame;
  if (existing && existing.game === 'zonk') {
    cleanupBoard = board(el, existing);
  } else {
    renderSetup(el, 'zonk', players => {
      const game = {
        game: 'zonk',
        target: store.settings.zonkTarget || 4000,
        players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, score: 0 })),
        turnIndex: 0,
        timer: { accumulatedMs: 0, startedAt: null },
        startedAt: nowISO(),
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
  const STEPS = [50, 100, 500, 1000]; // быстрый набор — все очки Зонка кратны 50
  let pending = 0; // набранные очки за текущий ход (до «Записать»)
  timer.start();
  persist();

  const onHide = () => { timer.pause(); persist(); };
  const onVis = () => { if (document.hidden) onHide(); };
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onVis);

  function persist() {
    game.timer = timer.snapshot();
    store.setCurrentGame(game);
  }

  function draw() {
    const p = game.players[game.turnIndex];
    el.innerHTML = `
      <div class="screen">
        <div class="gamebar">
          <span class="timer" id="timer">${fmtDuration(timer.elapsed())}</span>
          <button class="iconbtn" id="pause" aria-label="Пауза">${timer.running ? '⏸️' : '▶️'}</button>
          <span class="pill">🎯 до ${game.target.toLocaleString('ru-RU')}</span>
          <button class="btn btn--ghost" id="quit" style="margin-left:auto;padding:8px 12px">Выйти</button>
        </div>

        <div id="players">
          ${game.players.map((pl, i) => playerCard(pl, i)).join('')}
        </div>

        <div class="card" style="margin-top:6px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            ${avatarHtml(p)}
            <b>Ход: ${escapeHtml(p.name)}</b>
          </div>
          <div class="pts-row">
            <div class="pts-display" id="pts">0</div>
            <button class="iconbtn pts-clear" id="clear" aria-label="Сбросить ввод">⌫</button>
          </div>
          <div class="pad-grid">
            ${STEPS.map(s => `<button class="btn pad-btn" data-add="${s}">+${s}</button>`).join('')}
          </div>
          <button class="btn btn--accent btn--block" id="rec" style="margin-top:10px" disabled>Записать</button>
          <div style="display:flex;gap:10px;margin-top:10px">
            <button class="btn btn--danger btn--block" id="zonk">💥 Зонк (0)</button>
            <button class="btn btn--ghost" id="undo" ${game.log.length ? '' : 'disabled'} style="flex:none">↩︎ Отменить</button>
          </div>
        </div>

        <details class="acc" style="margin-top:14px">
          <summary>🎲 Бросить кубики</summary>
          <div class="acc__body">
            <div class="dice-tray" id="tray"></div>
            <div id="roll-result" style="text-align:center;font-weight:800;font-size:1.15rem;min-height:1.3em;margin:6px 0"></div>
            <div style="display:flex;gap:10px">
              <button class="btn btn--block" id="roll">Бросок 6 кубиков</button>
              <button class="btn btn--accent" id="apply-roll" hidden style="flex:none">Записать</button>
            </div>
            <p class="help">Очки считаются по правилам автоматически. Итог можно записать одной кнопкой.</p>
          </div>
        </details>

        ${gameHelpHtml('zonk')}
      </div>`;

    $('#pause', el).addEventListener('click', () => { timer.toggle(); persist(); draw(); });
    $('#quit', el).addEventListener('click', quit);
    $('#rec', el).addEventListener('click', record);
    $('#zonk', el).addEventListener('click', () => commitTurn(0));
    $('#undo', el).addEventListener('click', undo);

    const ptsEl = $('#pts', el);
    const recBtn = $('#rec', el);
    const syncPending = () => {
      ptsEl.textContent = pending.toLocaleString('ru-RU');
      ptsEl.classList.toggle('pts-display--on', pending > 0);
      recBtn.disabled = pending <= 0;
      recBtn.textContent = pending > 0 ? `Записать ${pending.toLocaleString('ru-RU')}` : 'Записать';
    };
    el.querySelectorAll('.pad-btn').forEach(b => b.addEventListener('click', () => {
      pending += parseInt(b.dataset.add, 10);
      sound.play('add');
      syncPending();
    }));
    $('#clear', el).addEventListener('click', () => {
      if (pending === 0) return;
      pending = 0;
      sound.play('minus');
      syncPending();
    });
    syncPending();

    const tray = $('#tray', el);
    const result = $('#roll-result', el);
    const applyBtn = $('#apply-roll', el);
    const paint = vals => { tray.innerHTML = vals.map(dieHtml).join(''); };
    paint([1, 2, 3, 4, 5, 6]);

    $('#roll', el).addEventListener('click', () => {
      sound.play('roll');
      applyBtn.hidden = true;
      result.textContent = '';
      rollDice(6, (vals, done) => {
        paint(vals);
        if (!done) return;
        const { score, isZonk } = scoreZonkRoll(vals);
        result.textContent = isZonk ? '💥 Зонк! очков нет' : `= ${score.toLocaleString('ru-RU')} очков`;
        result.style.color = isZonk ? 'var(--danger)' : 'var(--accent-2)';
        applyBtn.hidden = false;
        applyBtn.textContent = isZonk ? 'Записать Зонк' : `Записать ${score}`;
        applyBtn.dataset.score = String(score);
      });
    });
    applyBtn.addEventListener('click', () => commitTurn(parseInt(applyBtn.dataset.score || '0', 10)));
  }

  function record() {
    if (pending <= 0) { toast('Наберите очки за ход'); return; }
    commitTurn(pending);
  }

  function commitTurn(points) {
    pending = 0;
    const pl = game.players[game.turnIndex];
    game.log.push({ playerIndex: game.turnIndex, points, prevScore: pl.score });
    pl.score += points;
    checkTurn(points);
    sound.play(points === 0 ? 'zonk' : 'add');
    if (points === 0) toast('💥 Зонк! Ход сгорел');

    if (pl.score >= game.target) return finish(pl);

    game.turnIndex = (game.turnIndex + 1) % game.players.length;
    persist();
    draw();
  }

  function undo() {
    const last = game.log.pop();
    if (!last) return;
    game.players[last.playerIndex].score = last.prevScore;
    game.turnIndex = last.playerIndex;
    sound.play('minus');
    persist();
    draw();
  }

  async function quit() {
    if (await confirmDialog('Выйти из партии? Текущий счёт будет потерян.')) {
      cleanup();
      store.clearCurrentGame();
      location.hash = '#/home';
    }
  }

  function finish(winner) {
    timer.pause();
    const durationMs = timer.elapsed();
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    const margin = sorted.length > 1 ? sorted[0].score - sorted[1].score : sorted[0].score;
    finishGame('zonk', game.players, durationMs, {
      winnerId: winner.id,
      startedAt: game.startedAt,
      standings: sorted.map(p => ({ id: p.id, name: p.name, value: p.score })),
      margin,
    });
    cleanup();
    renderWin(el, 'zonk', winner, durationMs, `${winner.score.toLocaleString('ru-RU')} очков`);
  }

  function playerCard(pl, i) {
    const active = i === game.turnIndex;
    const pct = Math.min(100, Math.round((pl.score / game.target) * 100));
    return `
      <div class="player-card ${active ? 'player-card--active' : ''}">
        ${avatarHtml(pl)}
        <div class="row__main">
          <div class="player-card__name">${escapeHtml(pl.name)} ${active ? '🎯' : ''}</div>
          <div style="height:6px;background:var(--border);border-radius:99px;margin-top:6px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${pl.color};border-radius:99px"></div>
          </div>
        </div>
        <div class="player-card__side">
          <div class="player-card__score">${pl.score.toLocaleString('ru-RU')}</div>
          <div class="player-card__meta">${pct}%</div>
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

function dieHtml(v) {
  // раскладка точек по позициям сетки 3x3
  const pips = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  }[v] || [];
  let cells = '';
  for (let i = 0; i < 9; i++) cells += pips.includes(i) ? '<span></span>' : '<i></i>';
  return `<div class="die" data-die>${cells}</div>`;
}
