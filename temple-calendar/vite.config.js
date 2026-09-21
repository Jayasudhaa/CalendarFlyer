import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward any /api/... call from the frontend dev server (localhost:5173)
      // to the backend server (localhost:5000). Without this, /api requests
      // hit Vite itself and get served index.html back — which is the
      // "<!DOCTYPE ... is not valid JSON" error.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Same reason as /api above -- the Facebook/Instagram "Continue
      // with..." buttons (SocialConnectButtons.jsx) call /auth/facebook/
      // start and /auth/instagram/start on the backend. Without this,
      // those calls hit Vite instead and get index.html back, which is
      // the "Unexpected token '<'... is not valid JSON" error.
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // The standalone old test page itself, served as a static file by
      // the backend (server/public/connect-social.html) -- proxied too so
      // the "Old test page" link works the same way in dev as it will in
      // production (same origin, no separate port to remember).
      '/connect-social.html': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
