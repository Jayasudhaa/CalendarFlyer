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
    },
  },
});
