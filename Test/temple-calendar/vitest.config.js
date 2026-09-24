import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js on purpose — the app's real Vite config only
// needs the dev-server /api proxy, which is meaningless under test (fetch is
// mocked, see src/test/fetchMock.js). Keeping this standalone means running
// tests can never accidentally change how `npm run dev`/`npm run build`
// behave, and vice versa.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    // Every *.test.jsx / *.test.js anywhere under src — new tests are picked
    // up automatically, no registration step.
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', '**/*.test.{js,jsx}'],
    },
  },
});
