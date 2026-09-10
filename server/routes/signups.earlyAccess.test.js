/**
 * routes/signups.earlyAccess.test.js
 * Pure unit tests for the "early access for followers" gating rule
 * (earlyAccessUntil / isLockedForViewer) — the exact logic a non-follower
 * hitting POST /slots/:slotId/join with code 'early_access_locked' depends
 * on. No Express/DynamoDB needed: both functions are pure given a sheet
 * object and a boolean.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
const { earlyAccessUntil, isLockedForViewer } = require('./signups');

describe('earlyAccessUntil', () => {
  it('returns null when the sheet has no early-access window', () => {
    expect(earlyAccessUntil({ early_access_hours: 0, created_at: Date.now() })).toBeNull();
    expect(earlyAccessUntil({ created_at: Date.now() })).toBeNull();
  });

  it('adds early_access_hours (in ms) to created_at', () => {
    const created_at = 1_700_000_000_000;
    const sheet = { created_at, early_access_hours: 24 };
    expect(earlyAccessUntil(sheet)).toBe(created_at + 24 * 60 * 60 * 1000);
  });
});

describe('isLockedForViewer', () => {
  const NOW = 1_700_100_000_000;
  beforeEach(() => vi.useFakeTimers().setSystemTime(NOW));
  afterEach(() => vi.useRealTimers());

  it('is never locked when the sheet has no early-access window', () => {
    const sheet = { created_at: NOW - 1000, early_access_hours: 0 };
    expect(isLockedForViewer(sheet, false)).toBe(false);
    expect(isLockedForViewer(sheet, true)).toBe(false);
  });

  it('is never locked for a follower, regardless of timing', () => {
    const sheet = { created_at: NOW, early_access_hours: 48 }; // window wide open
    expect(isLockedForViewer(sheet, true)).toBe(false);
  });

  it('locks a non-follower while inside the early-access window', () => {
    const sheet = { created_at: NOW - 60 * 60 * 1000, early_access_hours: 24 }; // 1h in, 24h window
    expect(isLockedForViewer(sheet, false)).toBe(true);
  });

  it('opens up for a non-follower once the window has fully elapsed', () => {
    const sheet = { created_at: NOW - 25 * 60 * 60 * 1000, early_access_hours: 24 }; // 25h ago, 24h window
    expect(isLockedForViewer(sheet, false)).toBe(false);
  });

  it('is exactly on the boundary at created_at + early_access_hours (open, not locked)', () => {
    const sheet = { created_at: NOW - 24 * 60 * 60 * 1000, early_access_hours: 24 }; // until === NOW
    expect(isLockedForViewer(sheet, false)).toBe(false);
  });
});
