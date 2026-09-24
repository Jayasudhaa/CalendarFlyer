/**
 * server/vitest.config.js
 *
 * No config existed before this, so every run used vitest's defaults,
 * including its default hookTimeout (10s). broadcast.test.js's very first
 * beforeEach hit that ceiling under normal multi-worker parallelism (a
 * single-worker, 60s-timeout diagnostic run passed all 39 tests cleanly),
 * which points at worker/thread startup contention rather than a slow
 * beforeEach body -- it's a couple of mock resets and a synchronous
 * require(). Raising the timeouts gives that startup cost real headroom
 * without forcing the whole suite down to one worker.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
