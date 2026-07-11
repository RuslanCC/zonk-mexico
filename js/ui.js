// Небольшие DOM-помощники, общие для всех экранов.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Тост-уведомление
export function toast(message, opts = {}) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (opts.gold ? ' toast--gold' : '');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, opts.duration || 2200);
}

// Простое модальное подтверждение (промис)
export function confirmDialog(text) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(0,0,0,.5);padding:20px';
    overlay.innerHTML = `
      <div class="card" style="max-width:360px;width:100%">
        <p style="margin-bottom:16px;font-weight:600">${escapeHtml(text)}</p>
        <div style="display:flex;gap:10px">
          <button class="btn btn--ghost btn--block" data-a="no">Отмена</button>
          <button class="btn btn--danger btn--block" data-a="yes">Да</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
      const a = e.target.closest('[data-a]');
      if (a) { overlay.remove(); resolve(a.dataset.a === 'yes'); }
    });
    document.body.appendChild(overlay);
  });
}

export function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function avatarHtml(player) {
  return `<div class="avatar" style="background:${player.color}">${player.emoji || '🎲'}</div>`;
}

// Склонение: plural(5, ['партия','партии','партий'])
export function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
