// Service worker: cache do app para uso offline. Troque VERSION a cada publicação.
const VERSION = 'nected-v1.0.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'icons/icon.svg',
  'js/main.js', 'js/core/bus.js', 'js/core/catalog.js', 'js/core/cable.js', 'js/core/ip.js', 'js/core/network.js',
  'js/core/persist.js', 'js/core/scenario.js', 'js/core/store.js',
  'js/sim/missions.js', 'js/sim/queue.js', 'js/sim/services.js',
  'js/ui/cameras.js', 'js/ui/canvas.js', 'js/ui/connect.js', 'js/ui/crimp.js', 'js/ui/devices.js', 'js/ui/dom.js',
  'js/ui/dyn.js', 'js/ui/forms.js', 'js/ui/labs.js', 'js/ui/panel.js', 'js/ui/uistate.js', 'js/ui/windows.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rede primeiro (pega atualizações); cai para o cache quando offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
