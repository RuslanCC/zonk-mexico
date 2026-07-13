// Service worker: кэширует статику для офлайн-работы.
// При обновлении файлов поднимите версию — старый кэш очистится.

const CACHE = 'kosti-v7';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/ui.js',
  './js/sound.js',
  './js/confetti.js',
  './js/timer.js',
  './js/dice.js',
  './js/zonk-score.js',
  './js/achievements.js',
  './js/rules.js',
  './js/players.js',
  './js/game-common.js',
  './js/zonk.js',
  './js/mexico.js',
  './js/perudo.js',
  './js/history.js',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // {cache:'reload'} — тянем из сети мимо HTTP-кэша браузера, чтобы не закэшировать старые байты.
      cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // HTML/навигация — network-first: свежий каркас, если онлайн; кэш — офлайн-фолбэк.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE).then(cache => cache.put(request, clone));
        return resp;
      }).catch(() => caches.match(request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Остальная статика — cache-first (версионируется через CACHE).
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
