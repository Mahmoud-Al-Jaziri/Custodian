import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Background updates: a new build's service worker installs and takes
      // over on the next load, so signed-in users never run a stale shell.
      // (This is an update strategy, not an install prompt.)
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // devOptions.enabled is left false, so the service worker is NOT
      // registered during `npm run dev` — only in production builds.
      includeAssets: [
        'favicon.svg',
        'high-resolution-color-logo.png',
        'apple-touch-icon-180x180.png',
      ],
      manifest: {
        name: 'Custodian',
        short_name: 'Custodian',
        description: 'A nightly handoff to tomorrow’s you.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f4ef',
        theme_color: '#BA7517',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell so the app opens offline. With HashRouter
        // every route is served from index.html, so the shell covers all routes.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // No runtimeCaching for the API (custodian-coral.vercel.app) or Firebase:
        // those cross-origin requests always hit the network, so a signed-in
        // user never sees stale authenticated data. Only Google Fonts — static,
        // public assets — are cached, so the shell renders with brand fonts and
        // Material Symbols even offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
})
