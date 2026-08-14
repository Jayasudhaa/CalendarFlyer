import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'screenshots/*.png'],
      manifest: {
        name: 'CalendarFly — Sample Temple Name',
        short_name: 'CalendarFly',
        description: 'Temple event calendar and community app',
        start_url: '/calendar',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#1a0e04',
        theme_color: '#c9943a',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
        ],
        shortcuts: [
          { name: 'View Calendar', url: '/calendar', icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
          { name: 'Admin Panel',   url: '/admin',    icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // API calls — network first, fallback to cache
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            // Static assets — cache first
            urlPattern: /\.(?:js|css|woff2?|ttf|eot)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }, // 30 days
            },
          },
          {
            // Images — stale while revalidate
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 }, // 7 days
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
        ],
        // Don't cache admin routes when offline
        navigateFallback: '/calendar',
        navigateFallbackDenylist: [/^\/admin/, /^\/api/],
      },
      devOptions: {
        enabled: false, // disable in dev to avoid confusion
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
