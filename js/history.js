// История партий + статистика игроков (агрегаты из истории).

import { store } from './store.js';
import { $, avatarHtml, escapeHtml, toast, confirmDialog, fmtDuration, fmtDate, plural } from './ui.js';
import { ACHIEVEMENTS } from './achievements.js';

const GAME_META = { zonk: { emoji: '🎲', name: 'Зонк' }, mexico: { emoji: '🌶️', name: 'Мексика' }, perudo: { emoji: '🎭', name: 'Перудо' } };

export function renderHistory(el) {
  function draw() {
    const items = store.history;
    el.innerHTML = `
      <div class="screen">
        <h1 class="h1">История</h1>
        <p class="sub">${items.length} ${plural(items.length, ['партия', 'партии', 'партий'])} сыграно.</p>
        ${items.length ? `<button class="btn btn--danger" id="clear" style="margin-bottom:14px">Очистить историю</button>` : ''}
        <div id="list">
          ${items.length === 0
            ? `<div class="empty"><span class="ico">📭</span>Пока нет сыгранных партий.</div>`
            : items.map(entryHtml).join('')}
        </div>
      </div>`;

    const clear = $('#clear', el);
    if (clear) clear.addEventListener('click', async () => {
      if (await confirmDialog('Удалить всю историю партий?')) { store.clearHistory(); toast('История очищена'); draw(); }
    });

    el.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', async e => {
        e.stopPropagation();
        if (await confirmDialog('Удалить эту запись?')) { store.removeHistory(b.dataset.del); draw(); }
      }));
  }

  function entryHtml(h) {
    const meta = GAME_META[h.game] || { emoji: '🎲', name: h.game };
    const winner = h.players.find(p => p.id === h.winnerId);
    const standings = (h.standings || []).map((s, i) =>
      `<div class="stat-line"><span>${i + 1}. ${escapeHtml(s.name)}</span><b>${s.value.toLocaleString('ru-RU')}</b></div>`).join('');
    return `
      <details class="acc">
        <summary>
          <span style="font-size:1.2rem">${meta.emoji}</span>
          <span style="display:flex;flex-direction:column">
            <span>${winner ? '🏆 ' + escapeHtml(winner.name) : meta.name}</span>
            <span class="row__meta" style="font-weight:400">${meta.name} · ${fmtDate(h.endedAt)} · ${fmtDuration(h.durationMs)}</span>
          </span>
        </summary>
        <div class="acc__body">
          ${standings || '<p class="help">Нет данных о результатах.</p>'}
          <button class="btn btn--danger btn--ghost" data-del="${h.id}" style="margin-top:10px;padding:8px 12px">Удалить запись</button>
        </div>
      </details>`;
  }

  draw();
}

// ---------- Статистика ----------

export function renderStats(el) {
  const stats = computeStats();
  const unlocked = Object.keys(store.achievements).length;

  el.innerHTML = `
    <div class="screen">
      <h1 class="h1">Статистика</h1>
      <p class="sub">Собрана из истории партий.</p>

      ${stats.length === 0
        ? `<div class="empty"><span class="ico">📊</span>Сыграйте пару партий — здесь появится статистика.</div>`
        : `<div class="grid">${stats.map(cardHtml).join('')}</div>`}

      <h2 class="section-title">🏅 Достижения (${unlocked}/${ACHIEVEMENTS.length})</h2>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map(a => {
          const on = store.achievements[a.id];
          return `<div class="ach ${on ? '' : 'ach--locked'}">
            <div class="ico">${a.ico}</div>
            <div class="ach__name">${a.name}</div>
            <div class="ach__desc">${a.desc}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function computeStats() {
  const history = store.history;
  const byPlayer = new Map();

  for (const h of history) {
    for (const pl of h.players) {
      if (!byPlayer.has(pl.id)) {
        byPlayer.set(pl.id, { id: pl.id, name: pl.name, emoji: pl.emoji, color: pl.color, games: 0, wins: 0, zonkScores: [], best: 0 });
      }
      const s = byPlayer.get(pl.id);
      s.games += 1;
      if (h.winnerId === pl.id) s.wins += 1;
      if (h.game === 'zonk') {
        const st = (h.standings || []).find(x => x.id === pl.id);
        if (st) { s.zonkScores.push(st.value); s.best = Math.max(s.best, st.value); }
      }
    }
  }

  // текущая серия побед (по истории от новых к старым; история хранится unshift-ом)
  for (const [id, s] of byPlayer) {
    let streak = 0;
    for (const h of history) {
      if (!h.players.some(p => p.id === id)) continue;
      if (h.winnerId === id) streak += 1; else break;
    }
    s.streak = streak;
  }

  return [...byPlayer.values()].sort((a, b) => b.wins - a.wins || b.games - a.games);
}

function cardHtml(s) {
  const winRate = s.games ? Math.round((s.wins / s.games) * 100) : 0;
  const avg = s.zonkScores.length ? Math.round(s.zonkScores.reduce((a, b) => a + b, 0) / s.zonkScores.length) : null;
  return `
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        ${avatarHtml(s)}
        <b style="font-size:1.1rem">${escapeHtml(s.name)}</b>
        ${s.streak >= 2 ? `<span class="chip chip--gold" style="margin-left:auto">🔥 серия ${s.streak}</span>` : ''}
      </div>
      <div class="stat-line"><span>Партий</span><b>${s.games}</b></div>
      <div class="stat-line"><span>Побед</span><b>${s.wins} (${winRate}%)</b></div>
      ${avg !== null ? `<div class="stat-line"><span>Средний счёт (Зонк)</span><b>${avg.toLocaleString('ru-RU')}</b></div>` : ''}
      ${s.best ? `<div class="stat-line"><span>Лучший счёт (Зонк)</span><b>${s.best.toLocaleString('ru-RU')}</b></div>` : ''}
    </div>`;
}
