// Централизованное хранилище состояния в localStorage.
// Всё лежит одним объектом — удобно для экспорта/импорта.

const KEY = 'kosti.v1';

const DEFAULTS = {
  players: [],
  settings: {
    theme: 'dark',
    sound: true,
    zonkTarget: 4000,
    mexicoLives: 6,
    perudoDice: 5,
  },
  currentGame: null,
  history: [],
  achievements: {}, // { achievementId: unlockedAtISO }
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    // мягкое слияние с дефолтами (на случай новых полей)
    return {
      ...structuredClone(DEFAULTS),
      ...data,
      settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
    };
  } catch (e) {
    console.warn('Не удалось прочитать хранилище, начинаем заново', e);
    return structuredClone(DEFAULTS);
  }
}

let state = load();

export const store = {
  get() { return state; },

  save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  },

  // ---- Игроки ----
  get players() { return state.players; },
  addPlayer(name) {
    const clean = name.trim();
    if (!clean) return null;
    const palette = ['#6c5ce7', '#00cec9', '#ff6b6b', '#ffd166', '#51cf66', '#fd79a8', '#74b9ff', '#e17055'];
    const emojis = ['🎲', '🐉', '🦊', '🐼', '🦁', '🐸', '🦄', '🐙', '🦖', '🐺'];
    const idx = state.players.length;
    const player = {
      id: uid(),
      name: clean,
      color: palette[idx % palette.length],
      emoji: emojis[idx % emojis.length],
      createdAt: nowISO(),
    };
    state.players.push(player);
    this.save();
    return player;
  },
  updatePlayer(id, patch) {
    const p = state.players.find(x => x.id === id);
    if (p) { Object.assign(p, patch); this.save(); }
  },
  removePlayer(id) {
    state.players = state.players.filter(p => p.id !== id);
    this.save();
  },
  playerById(id) { return state.players.find(p => p.id === id); },

  // ---- Настройки ----
  get settings() { return state.settings; },
  setSetting(key, value) {
    state.settings[key] = value;
    this.save();
  },

  // ---- Текущая партия ----
  get currentGame() { return state.currentGame; },
  setCurrentGame(game) { state.currentGame = game; this.save(); },
  clearCurrentGame() { state.currentGame = null; this.save(); },

  // ---- История ----
  get history() { return state.history; },
  addHistory(entry) {
    state.history.unshift(entry);
    if (state.history.length > 300) state.history.length = 300;
    this.save();
  },
  removeHistory(id) {
    state.history = state.history.filter(h => h.id !== id);
    this.save();
  },
  clearHistory() { state.history = []; this.save(); },

  // ---- Достижения ----
  get achievements() { return state.achievements; },
  unlockAchievement(id) {
    if (state.achievements[id]) return false;
    state.achievements[id] = nowISO();
    this.save();
    return true;
  },

  // ---- Экспорт / импорт ----
  exportJSON() { return JSON.stringify(state, null, 2); },
  importJSON(json) {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') throw new Error('Неверный формат');
    state = {
      ...structuredClone(DEFAULTS),
      ...data,
      settings: { ...DEFAULTS.settings, ...(data.settings || {}) },
    };
    this.save();
  },
  resetAll() {
    state = structuredClone(DEFAULTS);
    localStorage.removeItem(KEY);
  },
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export function nowISO() { return new Date().toISOString(); }
