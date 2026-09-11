// Service Worker para PWA - Studio Coach Montanha
// Estratégia: Network-First (sempre busca da rede; usa cache apenas offline)
// __SW_VERSION__ é substituído pelo script de build (ver index.html inject).
// A cada novo deploy o CACHE_NAME muda, o activate limpa caches antigos.

const CACHE_VERSION = typeof __SW_VERSION__ !== "undefined" ? __SW_VERSION__ : Date.now();
const CACHE_NAME = "coach-montanha-pwa-v" + CACHE_VERSION;

// Assets pré-cacheados para shell offline mínimo
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Assume controle imediatamente, sem esperar fechar abas existentes.
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          // Apaga qualquer cache antigo (nome diferente do atual)
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  // Assume controle de todas as abas abertas imediatamente.
  self.clients.claim();
});

// ── Fetch: Network-First ─────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Ignora domínios externos (Supabase, CDN, APIs etc.)
  if (url.origin !== self.location.origin) return;

  // Ignora server functions e rotas de API
  if (
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_build/")
  ) return;

  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // Tenta a rede primeiro — aluno recebe sempre a versão mais nova com conexão.
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      // Cache apenas assets estáticos com hash (js, css, imagens, fontes)
      const isStaticAsset =
        /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ico|webmanifest)(\?.*)?$/.test(request.url);
      if (isStaticAsset) {
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch {
    // Sem conexão: tenta o cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // Para navegações sem cache retorna página offline amigável
    if (request.mode === "navigate") {
      return new Response(
        `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title>
<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
justify-content:center;min-height:100dvh;margin:0;gap:1rem;padding:2rem;text-align:center;background:#f9fafb}
h2{font-size:1.5rem;color:#111}p{color:#6b7280;max-width:280px}
button{margin-top:.5rem;padding:.6rem 2rem;background:#2563eb;color:#fff;border:none;
border-radius:.5rem;font-size:1rem;cursor:pointer}</style></head>
<body><h2>📶 Sem conexão</h2>
<p>Verifique sua conexão com a internet e tente novamente.</p>
<button onclick="location.reload()">Tentar novamente</button></body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }
    return new Response("", { status: 503 });
  }
}

// ── Mensagens vindas da página ────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  // PwaUpdateBanner envia SKIP_WAITING quando o aluno clica em "Atualizar agora"
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
