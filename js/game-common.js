// Общие части экранов партии: выбор игроков перед стартом,
// завершение партии (запись в историю + достижения) и победный экран.

import { store, uid, nowISO } from './store.js';
import { $, avatarHtml, escapeHtml, toast, fmtDuration, plural } from './ui.js';
import { sound } from './sound.js';
import { launchConfetti } from './confetti.js';
import { checkGameEnd } from './achievements.js';

const META = {
  zonk:   { emoji: '🎲', name: 'Зонк' },
  mexico: { emoji: '🌶️', name: 'Мексика' },
};

// Экран выбора игроков. onStart(selectedPlayers[]).
export function renderSetup(el, game, onStart) {
  const roster = store.players;
  const meta = META[game];
  const selected = new Set();

  function draw() {
    el.innerHTML = `
      <div class="screen">
        <h1 class="h1">${meta.emoji} ${meta.name}</h1>
        <p class="sub">Отметьте, кто играет (минимум 2). Порядок — как отмечали.</p>

        ${roster.length === 0 ? `
          <div class="empty"><span class="ico">🙋</span>Сначала добавьте игроков.</div>
          <a class="btn btn--primary btn--block" href="#/players">Добавить игроков</a>
        ` : `
          <div id="pick">${roster.map(pickRow).join('')}</div>
          <div class="field" style="margin-top:18px">
            <input class="input" id="quick-add" placeholder="Быстро добавить игрока" maxlength="24" />
            <button class="btn" id="quick-add-btn" type="button">+</button>
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="start" ${selected.size < 2 ? 'disabled' : ''}>
            Начать партию (${selected.size})
          </button>
        `}
      </div>`;

    el.querySelectorAll('[data-pick]').forEach(row =>
      row.addEventListener('click', () => {
        const id = row.dataset.pick;
        selected.has(id) ? selected.delete(id) : selected.add(id);
        sound.play('tap');
        draw();
      }));

    const qa = $('#quick-add', el);
    const qab = $('#quick-add-btn', el);
    if (qab) {
      const add = () => {
        const p = store.addPlayer(qa.value);
        if (p) { selected.add(p.id); sound.play('add'); draw(); }
      };
      qab.addEventListener('click', add);
      qa.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    }

    const startBtn = $('#start', el);
    if (startBtn) startBtn.addEventListener('click', () => {
      const chosen = roster.filter(p => selected.has(p.id));
      onStart(chosen);
    });
  }

  function pickRow(p) {
    const on = selected.has(p.id);
    return `
      <div class="row" data-pick="${p.id}" style="cursor:pointer;${on ? 'border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 35%,transparent)' : ''}">
        ${avatarHtml(p)}
        <div class="row__main"><div class="row__title">${escapeHtml(p.name)}</div></div>
        <div style="font-size:1.4rem">${on ? '✅' : '⬜'}</div>
      </div>`;
  }

  draw();
}

// Записать завершённую партию в историю + проверить достижения.
// result: { winnerId, standings:[{id,name,value}], margin, mexicoWinnerLives }
export function finishGame(game, players, durationMs, result) {
  const entry = {
    id: uid(),
    game,
    players: players.map(p => ({ id: p.id, name: p.name, emoji: p.emoji, color: p.color })),
    winnerId: result.winnerId,
    standings: result.standings,
    durationMs,
    startedAt: result.startedAt,
    endedAt: nowISO(),
  };
  store.addHistory(entry);
  store.clearCurrentGame();
  checkGameEnd({
    game,
    players,
    winnerId: result.winnerId,
    margin: result.margin || 0,
    durationMs,
    mexicoWinnerLives: result.mexicoWinnerLives,
  });
}

// Победный экран.
export function renderWin(el, game, winner, durationMs, subtitle) {
  sound.play('win');
  launchConfetti();
  const meta = META[game];
  el.innerHTML = `
    <div class="screen win">
      <div class="win__cup">🏆</div>
      <div class="chip chip--gold">${meta.emoji} ${meta.name}</div>
      <div class="win__name">${escapeHtml(winner.name)} побеждает!</div>
      <p class="sub">${escapeHtml(subtitle)} · время партии ${fmtDuration(durationMs)}</p>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:320px;margin:20px auto 0">
        <button class="btn btn--primary btn--lg" data-again>🔁 Ещё партию</button>
        <a class="btn" href="#/history">📜 История</a>
        <a class="btn btn--ghost" href="#/home">🏠 На главную</a>
      </div>
    </div>`;
  const again = $('[data-again]', el);
  again.addEventListener('click', () => { location.hash = `#/game/${game}`; });
}

export { META };
