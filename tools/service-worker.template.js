/* Generated from final build output. Do not deploy this template directly. */
const BUILD_ID = __BUILD_ID__;
const PRECACHE = __PRECACHE__;
const DIGESTS = __DIGESTS__;
let repairPromise;
const PREFIX = 'grocea-shell-';
const CACHE_NAME = PREFIX + BUILD_ID;
const PUBLIC_PATHS = new Set(PRECACHE);
const LEGACY = new Set(['grocea-pwa-v5-auth-proxy']);
function expectedType(path, type) {
  const mime = type.split(';')[0].trim().toLowerCase();
  if (path.endsWith('.html')) return mime === 'text/html';
  if (path.endsWith('.js')) return ['text/javascript', 'application/javascript'].includes(mime);
  if (path.endsWith('.css')) return mime === 'text/css';
  if (path.endsWith('.png')) return mime === 'image/png';
  if (path.endsWith('.jpg')) return mime === 'image/jpeg';
  if (path.endsWith('.webp')) return mime === 'image/webp';
  if (path.endsWith('.svg')) return mime === 'image/svg+xml';
  if (path.endsWith('.woff2')) return ['font/woff2', 'application/font-woff2'].includes(mime);
  if (path.endsWith('.woff')) return ['font/woff', 'application/font-woff', 'application/x-font-woff'].includes(mime);
  if (path.endsWith('.webmanifest')) return ['application/manifest+json', 'application/json'].includes(mime);
  return false;
}
async function fillShell(cache) {
  // Stage all responses before touching a live cache. Today's origin might
  // serve B while an open A client still needs exact A bytes after eviction.
  const staged = [];
  for (const path of PRECACHE) {
    const response = await fetch(new Request(path, { cache: 'reload', credentials: 'omit', redirect: 'error' }));
    const type = response.headers.get('Content-Type') || '';
    if (response.status !== 200 || response.type === 'opaque' || !expectedType(path, type)) throw new Error('Incomplete app shell');
    const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
    const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hex !== DIGESTS[path]) throw new Error('App shell version mismatch');
    staged.push([path, response]);
  }
  for (const [path, response] of staged) await cache.put(path, response);
}
async function shellComplete() {
  if (!await caches.has(CACHE_NAME)) return false;
  const cache = await caches.open(CACHE_NAME);
  return (await Promise.all(PRECACHE.map(path => cache.match(path)))).every(Boolean);
}
async function ensureShell() {
  if (await shellComplete()) return true;
  if (!repairPromise) {
    repairPromise = (async () => {
      try {
        await fillShell(await caches.open(CACHE_NAME));
        for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'GROCEA_SHELL_READY', buildId: BUILD_ID });
        return true;
      } catch { return false; }
    })().finally(() => { repairPromise = undefined; });
  }
  return repairPromise;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await fillShell(cache);
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Natural activation: no open clients of the previous worker remain.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => (key.startsWith(PREFIX) || LEGACY.has(key)) && key !== CACHE_NAME).map(key => caches.delete(key)));
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'GROCEA_SHELL_VERSION') return;
  event.waitUntil((async () => {
    const complete = await ensureShell();
    event.ports[0]?.postMessage({ buildId: BUILD_ID, complete });
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    // Only app documents; private/API and unknown data URLs never get a shell.
    if (!/^\/(?:$|index\.html$|welcome$|login$|register$|forgot-password$|reset-password$|pantry(?:\/|$)|recipes(?:\/|$)|groceries(?:\/|$)|activity(?:\/|$)|more$|profile$|ingredients(?:\/|$)|categories(?:\/|$)|sync-issues$|trial$)/.test(url.pathname)) return;
    event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match('/index.html')).then(response => response || fetch(request)));
    return;
  }
  if (url.search || !PUBLIC_PATHS.has(url.pathname)) return;
  event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(url.pathname)).then(response => response || fetch(request)));
});
