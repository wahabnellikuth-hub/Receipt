const CACHE_NAME = 'madrassa-fee-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/app.css',
    '/js/db.js',
    '/js/ui.js',
    '/js/app.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
});
