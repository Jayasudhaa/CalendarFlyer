/**
 * src/test/setup.js
 * Runs once before every test file (see vitest.config.js's setupFiles).
 * Fills in the handful of browser APIs jsdom doesn't implement that this
 * app touches on nearly every page — without these, otherwise-passing
 * tests print noisy "Not implemented" errors or throw outright.
 */
import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { installFetchMock } from './fetchMock';

// jsdom has no audio playback backend — utils/sound.js already wraps every
// play() in try/catch for exactly this reason (production browsers can also
// refuse autoplay), but stubbing this keeps test output clean instead of
// printing a jsdom "Not implemented" error on every click/success sound.
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

// Common jsdom gaps several components/libraries (recharts, responsive
// panels) probe for defensively.
window.matchMedia = window.matchMedia || function matchMedia(query) {
  return {
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  };
};
window.scrollTo = window.scrollTo || (() => {});
global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  observe() {} unobserve() {} disconnect() {}
};
global.IntersectionObserver = global.IntersectionObserver || class IntersectionObserver {
  observe() {} unobserve() {} disconnect() {}
};

beforeEach(() => {
  localStorage.clear();
  installFetchMock();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
