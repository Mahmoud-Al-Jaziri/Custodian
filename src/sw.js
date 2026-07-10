/* Custodian service worker (compiled by vite-plugin-pwa injectManifest).
   Three jobs: precache the app shell for offline, runtime-cache Google
   Fonts, and show the evening-reminder push notifications. */

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";

// autoUpdate semantics: a new build's worker takes over immediately so users
// never keep running a stale shell.
self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA shell: with HashRouter every route is served from index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Google Fonts — static public assets, safe to cache long-term. The API and
// Firebase are deliberately NOT cached: signed-in users always get fresh
// authenticated data.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" })
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// --- Evening reminder push ------------------------------------------------

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    // Non-JSON payload — fall back to defaults.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Custodian", {
      body:
        data.body ||
        "Tomorrow-you is waiting. Leave the handoff before you sleep.",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      // One reminder replaces another — never a stack of nags.
      tag: "evening-reminder",
      data: { url: data.url || "/#/evening" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/#/evening";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              // Some UAs disallow navigate() here — focus alone is fine.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
