import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Custom service worker (src/sw.js): Workbox precaching + the push
      // handlers for evening reminders. injectManifest compiles our file and
      // injects the precache manifest into self.__WB_MANIFEST.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // Background updates: a new build's service worker installs and takes
      // over on the next load, so signed-in users never run a stale shell.
      // (skipWaiting/clientsClaim live in src/sw.js.)
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
      injectManifest: {
        // Precache the built app shell so the app opens offline. Runtime
        // caching policy (Google Fonts only, never the API) lives in
        // src/sw.js next to the push handlers.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
    }),
  ],
  build: {
    outDir: 'dist',
  },
})
