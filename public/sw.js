/* eslint-disable no-undef */
/**
 * Service worker do Dell App.
 *
 * Escrito à mão, sem gerador de precache, por uma razão prática: sem manifesto
 * de precache o worker não precisa ser reconstruído a cada build, não guarda
 * hashes de arquivo e nunca serve uma versão presa em cache antigo. Ele faz
 * cache em tempo de execução, que é o suficiente para o objetivo real —
 * abrir o app instalado e conseguir consultar a agenda mesmo sem sinal.
 *
 * Estratégias:
 *   estáticos do Next  → cache primeiro (o nome do arquivo já tem hash)
 *   navegação (HTML)   → rede primeiro, cai para a última página vista
 *   GET em /api/v1     → rede primeiro, cai para a última resposta boa
 *   escrita em /api    → sempre rede, nunca cache
 */

const VERSION = "v2";
const STATIC_CACHE = `dell-static-${VERSION}`;
const PAGES_CACHE = `dell-pages-${VERSION}`;
const API_CACHE = `dell-api-${VERSION}`;
const OFFLINE_URL = "/offline";

/** Arte da marca — precisa estar disponível offline (a página offline mostra o
 *  logo) e quase nunca muda, então entra no precache junto da página offline. */
const BRAND_LOGO = "/brand/dell-logo.png";

const CURRENT_CACHES = [STATIC_CACHE, PAGES_CACHE, API_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .open(PAGES_CACHE)
        .then((cache) => cache.addAll([OFFLINE_URL]))
        .catch(() => undefined),
      caches
        .open(STATIC_CACHE)
        .then((cache) => cache.add(BRAND_LOGO))
        .catch(() => undefined),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Rede primeiro; se falhar, devolve o que houver em cache. */
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }

    // Para a API, um JSON de erro é mais útil do que uma exceção solta.
    if (request.url.includes("/api/")) {
      return new Response(
        JSON.stringify({
          error: { code: "OFFLINE", message: "Sem conexão. Mostrando dados salvos no aparelho." },
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }
    throw error;
  }
}

/** Cache primeiro — só para arquivos com hash no nome, que nunca mudam. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca guardar em cache o que envolve sessão ou token de uso único.
  if (
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/api/v1/auth") ||
    url.pathname.startsWith("/f/")
  )
    return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Marca e ícones: imutáveis na prática, servidos do cache para abrir offline.
  if (url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES_CACHE, OFFLINE_URL));
  }
});

// Permite ao app pedir a ativação imediata de uma versão nova do worker.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ── Notificações push ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: "Dell App", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Dell App";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag,
    // Uma notificação com a mesma tag substitui a anterior em vez de empilhar.
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Já existe uma janela do app aberta? Foca e navega para a ficha.
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(target).catch(() => {});
          return undefined;
        }
      }
      // Senão, abre uma nova.
      return self.clients.openWindow(target);
    }),
  );
});
