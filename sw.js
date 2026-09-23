// Service worker: guarda o app no aparelho para abrir mesmo sem internet (RNF-02).
// Os dados já ficam no localStorage; aqui só armazenamos os arquivos da interface.
const CACHE = "ruraltracker-v1";
const ARQUIVOS = [
  "./",
  "index.html",
  "styles.css",
  "js/icons.js",
  "js/catalogo-produtos.js",
  "js/culturas.js",
  "js/calc.js",
  "js/store.js",
  "js/services.js",
  "js/ui.js",
  "js/views-talhoes.js",
  "js/views-registros.js",
  "js/views-gestao.js",
  "js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Rede primeiro para os arquivos do app (pega atualizações), cache se estiver offline.
// Chamadas a outros domínios (clima, WhatsApp) não passam pelo cache.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
