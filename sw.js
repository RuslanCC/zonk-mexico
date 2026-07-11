// Service worker: кэширует статику для офлайн-работы.
// При обновлении файлов поднимите версию — старый кэш очистится.

const CACHE = 'kosti-v2';

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
  './js/history.js',
  './icons/icon.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// cache-first: сначала кэш, затем сеть (и добавляем ответ в кэш)
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

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
