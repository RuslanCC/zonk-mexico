// Экран управления игроками: быстрое добавление, правка, удаление.

import { store } from './store.js';
import { $, avatarHtml, escapeHtml, toast, confirmDialog, fmtDate } from './ui.js';
import { sound } from './sound.js';

const EMOJIS = ['🎲', '🐉', '🦊', '🐼', '🦁', '🐸', '🦄', '🐙', '🦖', '🐺', '🐨', '🦉', '🐷', '🐰', '🦈'];
const COLORS = ['#6c5ce7', '#00cec9', '#ff6b6b', '#ffd166', '#51cf66', '#fd79a8', '#74b9ff', '#e17055', '#a29bfe', '#55efc4'];

export function renderPlayers(el) {
  function draw() {
    const players = store.players;
    el.innerHTML = `
      <div class="screen">
        <h1 class="h1">Игроки</h1>
        <p class="sub">Добавляйте участников — они доступны в любой игре.</p>

        <form class="field" id="add-form" autocomplete="off">
          <input class="input" id="add-input" placeholder="Имя игрока" maxlength="24" />
          <button class="btn btn--primary" type="submit">Добавить</button>
        </form>

        <div id="list">
          ${players.length === 0
            ? `<div class="empty"><span class="ico">👋</span>Пока никого. Добавьте первого игрока выше.</div>`
            : players.map(rowHtml).join('')}
        </div>
      </div>`;

    const form = $('#add-form', el);
    const input = $('#add-input', el);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const p = store.addPlayer(input.value);
      if (p) { sound.play('add'); input.value = ''; draw(); $('#add-input', el).focus(); }
    });

    el.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openEditor(b.dataset.edit)));
    el.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', async () => {
        const p = store.playerById(b.dataset.del);
        if (await confirmDialog(`Удалить игрока «${p.name}»?`)) {
          store.removePlayer(b.dataset.del);
          toast('Игрок удалён');
          draw();
        }
      }));
  }

  function rowHtml(p) {
    const games = store.history.filter(h => h.players.some(x => x.id === p.id)).length;
    const wins = store.history.filter(h => h.winnerId === p.id).length;
    return `
      <div class="row">
        ${avatarHtml(p)}
        <div class="row__main">
          <div class="row__title">${escapeHtml(p.name)}</div>
          <div class="row__meta">${games} игр · ${wins} побед · с ${fmtDate(p.createdAt).split(',')[0]}</div>
        </div>
        <button class="iconbtn" data-edit="${p.id}" aria-label="Изменить">✏️</button>
        <button class="iconbtn iconbtn--danger" data-del="${p.id}" aria-label="Удалить">🗑️</button>
      </div>`;
  }

  function openEditor(id) {
    const p = store.playerById(id);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(0,0,0,.55);padding:20px';
    overlay.innerHTML = `
      <div class="card" style="max-width:380px;width:100%">
        <label class="label">Имя</label>
        <input class="input" id="ed-name" value="${escapeHtml(p.name)}" maxlength="24" style="margin-bottom:14px" />
        <label class="label">Эмодзи</label>
        <div id="ed-emojis" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
          ${EMOJIS.map(e => `<button class="iconbtn" data-emoji="${e}" style="${e === p.emoji ? 'outline:2px solid var(--accent)' : ''}">${e}</button>`).join('')}
        </div>
        <label class="label">Цвет</label>
        <div id="ed-colors" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">
          ${COLORS.map(c => `<button data-color="${c}" style="width:30px;height:30px;border-radius:50%;border:2px solid ${c === p.color ? 'var(--text)' : 'transparent'};background:${c};cursor:pointer"></button>`).join('')}
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn--ghost btn--block" data-close>Отмена</button>
          <button class="btn btn--primary btn--block" data-save>Сохранить</button>
        </div>
      </div>`;

    let picked = { emoji: p.emoji, color: p.color };
    overlay.addEventListener('click', e => {
      if (e.target === overlay || e.target.hasAttribute('data-close')) { overlay.remove(); return; }
      const em = e.target.closest('[data-emoji]');
      if (em) {
        picked.emoji = em.dataset.emoji;
        overlay.querySelectorAll('[data-emoji]').forEach(b => b.style.outline = 'none');
        em.style.outline = '2px solid var(--accent)';
      }
      const col = e.target.closest('[data-color]');
      if (col) {
        picked.color = col.dataset.color;
        overlay.querySelectorAll('[data-color]').forEach(b => b.style.borderColor = 'transparent');
        col.style.borderColor = 'var(--text)';
      }
      if (e.target.hasAttribute('data-save')) {
        const name = overlay.querySelector('#ed-name').value.trim() || p.name;
        store.updatePlayer(id, { name, emoji: picked.emoji, color: picked.color });
        overlay.remove();
        draw();
      }
    });
    document.body.appendChild(overlay);
  }

  draw();
}
