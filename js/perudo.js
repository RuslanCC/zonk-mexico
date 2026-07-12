// Партия «Перудо» (Liar's Dice / Dudo): модель на костях, выбывание,
// последний оставшийся побеждает. Броски игроки делают своими стаканчиками —
// приложение это табло: считает кости и помнит текущую ставку раунда.

import { store, nowISO } from './store.js';
import { $, avatarHtml, escapeHtml, toast, fmtDuration, confirmDialog } from './ui.js';
import { sound } from './sound.js';
import { GameTimer } from './timer.js';
import { renderSetup, finishGame, renderWin } from './game-common.js';

// Юникод-грани кубика по значению 1..6.
const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function renderPerudo(el) {
  let cleanupBoard = null; // фактическая очистка доски (регистрируется у роутера)
  const existing = store.currentGame;
  if (existing && existing.game === 'perudo') {
    cleanupBoard = board(el, existing);
  } else {
    renderSetup(el, 'perudo', players => {
      const dice = store.settings.perudoDice || 5;
      const game = {
        game: 'perudo',
        startDice: dice,
        players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color, dice, out: false })),
        timer: { accumulatedMs: 0, startedAt: null },
        startedAt: nowISO(),
        currentBid: null, // { qty, face } или null
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

  function totalDice() { return game.players.reduce((s, p) => s + p.dice, 0); }

  function draw() {
    const alive = game.players.filter(p => !p.out).length;
    const total = totalDice();
    const bid = game.currentBid;

    el.innerHTML = `
      <div class="screen">
        <div class="gamebar">
          <span class="timer" id="timer">${fmtDuration(timer.elapsed())}</span>
          <button class="iconbtn" id="pause">${timer.running ? '⏸️' : '▶️'}</button>
          <span class="pill">🎲 на столе: ${total}</span>
          <span class="pill">👥 в игре: ${alive}</span>
          <button class="btn btn--ghost" id="quit" style="margin-left:auto;padding:8px 12px">Выйти</button>
        </div>

        <p class="sub">«−» тому, кто проиграл раунд (вскрытие «Дудо») и теряет кость. «+» вернёт по ошибке снятую или за точную «Calza».</p>

        <div class="card" style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-weight:700">🎯 Ставка раунда</span>
            <span style="margin-left:auto;font-size:1.4rem;font-weight:800">
              ${bid && bid.face ? `${bid.qty} × ${DICE_FACES[bid.face]}` : (bid ? `${bid.qty} × ?` : '<span class="help" style="font-size:1rem">не задана</span>')}
            </span>
            <button class="iconbtn" id="bid-reset" aria-label="Новый раунд" title="Сбросить ставку">↺</button>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span class="help">Количество</span>
            <button class="iconbtn" id="qty-minus" aria-label="−1">➖</button>
            <b style="min-width:2ch;text-align:center;font-size:1.2rem">${bid ? bid.qty : 1}</b>
            <button class="iconbtn" id="qty-plus" aria-label="+1">➕</button>
          </div>
          <div class="face-pick">
            ${DICE_FACES.slice(1).map((g, k) => {
              const f = k + 1;
              const on = bid && bid.face === f;
              return `<button class="face-btn ${on ? 'face-btn--on' : ''}" data-face="${f}" aria-label="грань ${f}">${g}</button>`;
            }).join('')}
          </div>
        </div>

        <div id="players">${game.players.map(playerCard).join('')}</div>

        <div style="margin-top:6px">
          <button class="btn btn--ghost btn--block" id="undo" ${game.log.length ? '' : 'disabled'}>↩︎ Отменить последнее</button>
        </div>
      </div>`;

    $('#pause', el).addEventListener('click', () => { timer.toggle(); persist(); draw(); });
    $('#quit', el).addEventListener('click', quit);
    $('#undo', el).addEventListener('click', undo);

    $('#bid-reset', el).addEventListener('click', () => { game.currentBid = null; sound.play('tap'); persist(); draw(); });
    $('#qty-minus', el).addEventListener('click', () => bumpQty(-1));
    $('#qty-plus', el).addEventListener('click', () => bumpQty(+1));
    el.querySelectorAll('[data-face]').forEach(b =>
      b.addEventListener('click', () => setFace(+b.dataset.face)));

    el.querySelectorAll('[data-minus]').forEach(b =>
      b.addEventListener('click', () => changeDice(+b.dataset.minus, -1)));
    el.querySelectorAll('[data-plus]').forEach(b =>
      b.addEventListener('click', () => changeDice(+b.dataset.plus, +1)));
  }

  function bumpQty(delta) {
    const bid = game.currentBid || { qty: 1, face: null };
    const max = Math.max(1, totalDice());
    const qty = Math.min(max, Math.max(1, bid.qty + delta));
    game.currentBid = { qty, face: bid.face };
    sound.play('tap');
    persist();
    draw();
  }

  function setFace(face) {
    const bid = game.currentBid || { qty: 1, face: null };
    game.currentBid = { qty: bid.qty, face };
    sound.play('tap');
    persist();
    draw();
  }

  function changeDice(index, delta) {
    const pl = game.players[index];
    if (delta < 0 && (pl.out || pl.dice <= 0)) return;
    if (delta > 0 && pl.dice >= game.startDice) return;

    game.log.push({ playerIndex: index, delta });
    pl.dice += delta;
    if (pl.dice <= 0) { pl.dice = 0; pl.out = true; }
    else pl.out = false;

    // потеря кости завершает раунд — ставка сбрасывается на новый
    if (delta < 0) game.currentBid = null;

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
    pl.dice -= last.delta;
    pl.out = pl.dice <= 0;
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
    const standings = [...game.players].sort((a, b) => b.dice - a.dice)
      .map(p => ({ id: p.id, name: p.name, value: p.dice }));
    finishGame('perudo', game.players, durationMs, {
      winnerId: winner.id,
      startedAt: game.startedAt,
      standings,
    });
    cleanup();
    renderWin(el, 'perudo', winner, durationMs, `осталось костей: ${winner.dice}`);
  }

  function playerCard(pl, i) {
    const tokens = Array.from({ length: game.startDice }, (_, k) =>
      `<span class="heart ${k < pl.dice ? '' : 'heart--lost'}">🎲</span>`).join('');
    return `
      <div class="player-card ${pl.out ? 'player-card--out' : ''}">
        ${avatarHtml(pl)}
        <div class="row__main">
          <div class="player-card__name">${escapeHtml(pl.name)} ${pl.out ? '☠️' : ''} <b style="font-weight:400;color:var(--muted)">· ${pl.dice}</b></div>
          <div class="lives">${tokens}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="iconbtn iconbtn--danger" data-minus="${i}" ${pl.out ? 'disabled' : ''} aria-label="−1 кость">➖</button>
          <button class="iconbtn" data-plus="${i}" ${pl.dice >= game.startDice ? 'disabled' : ''} aria-label="+1 кость">➕</button>
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
