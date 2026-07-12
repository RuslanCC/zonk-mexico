// Точка входа: тема, роутер экранов (hash-навигация), главная и настройки.

import { store } from './store.js';
import { $, $$, toast, confirmDialog, escapeHtml, plural } from './ui.js';
import { sound } from './sound.js';
import { renderPlayers } from './players.js';
import { renderZonk } from './zonk.js';
import { renderMexico } from './mexico.js';
import { renderPerudo } from './perudo.js';
import { renderHistory, renderStats } from './history.js';
import { renderRules } from './rules.js';

const app = $('#app');
let cleanup = null; // функция очистки текущего экрана (таймеры и т.п.)

// ---------- Тема ----------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#14131c' : '#f4f2ff';
}
applyTheme(store.settings.theme);

$('#theme-toggle').addEventListener('click', () => {
  const next = store.settings.theme === 'dark' ? 'light' : 'dark';
  store.setSetting('theme', next);
  applyTheme(next);
  sound.play('tap');
});

// ---------- Роутер ----------
const routes = {
  '#/home': renderHome,
  '#/players': renderPlayers,
  '#/game/zonk': renderZonk,
  '#/game/mexico': renderMexico,
  '#/game/perudo': renderPerudo,
  '#/history': renderHistory,
  '#/stats': renderStats,
  '#/rules': renderRules,
  '#/settings': renderSettings,
};

function router() {
  const hash = location.hash || '#/home';
  const base = hash.split('?')[0];
  const render = routes[base] || renderHome;

  if (typeof cleanup === 'function') { try { cleanup(); } catch {} cleanup = null; }
  app.scrollTop = 0;
  window.scrollTo(0, 0);

  const back = $('.topbar__back');
  back.hidden = base === '#/home';

  const result = render(app);
  if (typeof result === 'function') cleanup = result;
}

window.addEventListener('hashchange', router);

// Навигация по data-nav и клики «назад»
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (!nav) return;
  const to = nav.dataset.nav;
  if (to === 'back') { e.preventDefault(); history.length > 1 ? history.back() : (location.hash = '#/home'); }
  else if (to.startsWith('#')) { location.hash = to; }
});

// Разблокировка звука по первому касанию
document.addEventListener('pointerdown', () => sound.unlock(), { once: true });

// ---------- Главная ----------
function renderHome(el) {
  const cg = store.currentGame;
  const cgMeta = cg && { zonk: { emoji: '🎲', name: 'Зонк' }, mexico: { emoji: '🌶️', name: 'Мексика' }, perudo: { emoji: '🎭', name: 'Перудо' } }[cg.game];

  el.innerHTML = `
    <div class="screen">
      <h1 class="h1">Во что играем?</h1>
      <p class="sub">Табло-компаньон для игр в кости.</p>

      ${cg ? `
        <button class="btn btn--accent btn--block btn--lg" data-nav="#/game/${cg.game}" style="margin-bottom:16px">
          ▶️ Продолжить: ${cgMeta.emoji} ${cgMeta.name} (${cg.players.length} ${plural(cg.players.length, ['игрок', 'игрока', 'игроков'])})
        </button>` : ''}

      <div class="game-pick">
        <button class="game-tile game-tile--zonk" data-nav="#/game/zonk">
          <div class="game-tile__emoji">🎲</div>
          <div class="game-tile__name">Зонк</div>
          <div class="game-tile__desc">Набери ${(store.settings.zonkTarget || 4000).toLocaleString('ru-RU')} очков первым</div>
        </button>
        <button class="game-tile game-tile--mexico" data-nav="#/game/mexico">
          <div class="game-tile__emoji">🌶️</div>
          <div class="game-tile__name">Мексика</div>
          <div class="game-tile__desc">Не потеряй все жизни</div>
        </button>
        <button class="game-tile game-tile--perudo" data-nav="#/game/perudo">
          <div class="game-tile__emoji">🎭</div>
          <div class="game-tile__name">Перудо</div>
          <div class="game-tile__desc">Блефуй и не потеряй все кости</div>
        </button>
      </div>

      <div class="quick-links">
        <button class="btn quick" data-nav="#/players"><span class="ico">👥</span>Игроки</button>
        <button class="btn quick" data-nav="#/history"><span class="ico">📜</span>История</button>
        <button class="btn quick" data-nav="#/stats"><span class="ico">📊</span>Статистика</button>
        <button class="btn quick" data-nav="#/rules"><span class="ico">📖</span>Правила</button>
      </div>

      <button class="btn btn--ghost btn--block" data-nav="#/settings" style="margin-top:14px">⚙️ Настройки</button>
    </div>`;
}

// ---------- Настройки ----------
function renderSettings(el) {
  const s = store.settings;
  el.innerHTML = `
    <div class="screen">
      <h1 class="h1">Настройки</h1>

      <div class="card" style="margin-bottom:16px">
        <div class="setting">
          <div class="setting__main"><b>Звуки</b><div class="help">Эффекты ходов, победы и достижений</div></div>
          <label class="switch"><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}><span></span></label>
        </div>
        <div class="setting">
          <div class="setting__main"><b>Тёмная тема</b><div class="help">Переключается и кнопкой 🌙 сверху</div></div>
          <label class="switch"><input type="checkbox" id="set-theme" ${s.theme === 'dark' ? 'checked' : ''}><span></span></label>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <label class="label">🎲 Цель в Зонке (очки)</label>
        <input class="input" id="set-target" type="number" min="1000" step="500" value="${s.zonkTarget}" style="margin-bottom:14px">
        <label class="label">🌶️ Жизней в Мексике</label>
        <input class="input" id="set-lives" type="number" min="1" max="12" value="${s.mexicoLives}" style="margin-bottom:14px">
        <label class="label">🎭 Костей в Перудо</label>
        <input class="input" id="set-dice" type="number" min="1" max="6" value="${s.perudoDice}">
        <p class="help">Применяется к новым партиям.</p>
      </div>

      <div class="card">
        <b>Данные</b>
        <p class="help" style="margin-bottom:12px">Игроки, история и настройки хранятся только в этом браузере.</p>
        <div class="grid grid-2">
          <button class="btn" id="export">⬇️ Экспорт</button>
          <button class="btn" id="import">⬆️ Импорт</button>
        </div>
        <button class="btn btn--danger btn--block" id="reset" style="margin-top:10px">Сбросить всё</button>
      </div>
    </div>`;

  $('#set-sound', el).addEventListener('change', e => store.setSetting('sound', e.target.checked));
  $('#set-theme', el).addEventListener('change', e => {
    const theme = e.target.checked ? 'dark' : 'light';
    store.setSetting('theme', theme); applyTheme(theme);
  });
  $('#set-target', el).addEventListener('change', e => {
    const v = Math.max(1000, parseInt(e.target.value, 10) || 10000);
    store.setSetting('zonkTarget', v); e.target.value = v;
  });
  $('#set-lives', el).addEventListener('change', e => {
    const v = Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 6));
    store.setSetting('mexicoLives', v); e.target.value = v;
  });
  $('#set-dice', el).addEventListener('change', e => {
    const v = Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 5));
    store.setSetting('perudoDice', v); e.target.value = v;
  });

  $('#export', el).addEventListener('click', exportData);
  $('#import', el).addEventListener('click', importData);
  $('#reset', el).addEventListener('click', async () => {
    if (await confirmDialog('Удалить всех игроков, историю и настройки?')) {
      store.resetAll();
      applyTheme(store.settings.theme);
      toast('Данные сброшены');
      location.hash = '#/home';
    }
  });
}

function exportData() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kosti-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Файл резервной копии сохранён');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.importJSON(reader.result);
        applyTheme(store.settings.theme);
        toast('Данные загружены');
        location.hash = '#/home';
        router();
      } catch (e) {
        toast('Не удалось прочитать файл');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ---------- Старт ----------
router();

// Service worker для офлайна (нужен HTTPS или localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
