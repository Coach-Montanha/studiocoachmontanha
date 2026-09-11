// Service Worker para PWA - Studio Coach Montanha
// Atualização 100% silenciosa e automática.
// Navegação de páginas (HTML) sempre busca direto da rede para garantir que o aluno veja sempre a versão mais recente.

const CACHE_NAME = "coach-montanha-pwa-v3";

const STATIC_SHELL = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// ── Install: baixa shell básico e ativa imediatamente sem esperar ─────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: limpa caches antigos e assume controle imediatamente ────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Não intercepta chamadas para Supabase, CDN ou APIs externas
  if (url.origin !== self.location.origin) return;

  // Não intercepta rotas de servidor, RPC ou API
  if (
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/rest/v1")
  ) {
    return;
  }

  // 1. Navegação de páginas (HTML): SEMPRE busca da rede direto.
  // Nunca serve HTML velho de cache quando houver internet.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response(
          `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;margin:0;gap:1rem;padding:2rem;text-align:center;background:#0f172a;color:#f8fafc}h2{margin:0;font-size:1.5rem}p{color:#94a3b8;margin:0;max-width:280px}button{margin-top:1rem;padding:.75rem 2rem;background:#2563eb;color:#fff;border:none;border-radius:.75rem;font-weight:600;font-size:1rem;cursor:pointer}</style></head><body><h2>📶 Sem conexão</h2><p>Verifique sua internet e tente novamente.</p><button onclick="location.reload()">Tentar novamente</button></body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      })
    );
    return;
  }

  // 2. Outros assets (imagens, ícones, fontes): tenta rede primeiro; fallback para cache se offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const isStatic = /\.(png|jpg|jpeg|svg|webp|woff2?|ico|webmanifest)(\?.*)?$/.test(requestUrl(event.request));
          if (isStatic) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

function requestUrl(req) {
  try {
    return req.url;
  } catch {
    return "";
  }
}

