/**
 * server/utils/resetToken.test.js
 * Pure unit tests for the forgot-password token (see resetToken.js for the
 * design rationale) — no Express/DynamoDB mocking needed, exactly like
 * routes/signups.earlyAccess.test.js's style for pure logic.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
const { createResetToken, verifyResetToken } = require('./resetToken');

const USER = { user_id: 'user-abc123', password_hash: '$2b$10$originalHashValueHere.......' };

afterEach(() => {
  vi.useRealTimers();
});

describe('createResetToken / verifyResetToken round trip', () => {
  it('a freshly created token verifies successfully against the same password hash', () => {
    const token = createResetToken(USER);
    const result = verifyResetToken(token, USER.password_hash);
    expect(result.valid).toBe(true);
    expect(result.user_id).toBe(USER.user_id);
  });

  it('rejects the token once the password hash has changed (single-use / already-used simulation)', () => {
    const token = createResetToken(USER);
    // Simulate the password having been changed since the token was
    // minted — either by this exact token already being redeemed once, or
    // by a change-password call in the meantime.
    const newHash = '$2b$10$aBrandNewHashAfterResetOrChange......';
    const result = verifyResetToken(token, newHash);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('already_used');
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = createResetToken(USER);
    // 1h expiry — jump 2 hours forward.
    vi.setSystemTime(new Date('2026-01-01T02:00:00Z'));
    const result = verifyResetToken(token, USER.password_hash);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects a malformed/garbage token', () => {
    const result = verifyResetToken('not.a.real.jwt.token', USER.password_hash);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('malformed');
  });

  it('rejects a token signed for a different purpose (e.g. email verification)', () => {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('./jwtSecret');
    const foreignToken = jwt.sign(
      { user_id: USER.user_id, purpose: 'verify-email' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const result = verifyResetToken(foreignToken, USER.password_hash);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('wrong_purpose');
  });

  it('rejects a token that has no purpose/user_id claims at all', () => {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('./jwtSecret');
    const bareToken = jwt.sign({ foo: 'bar' }, JWT_SECRET, { expiresIn: '1h' });
    const result = verifyResetToken(bareToken, USER.password_hash);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('wrong_purpose');
  });

  it('never embeds the raw password_hash in the token payload', () => {
    const token = createResetToken(USER);
    const payloadB64 = token.split('.')[1];
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    expect(payloadJson).not.toContain(USER.password_hash);
  });

  it('two tokens minted for the same user/hash at the same second carry the same fingerprint but are still independently verifiable', () => {
    const tokenA = createResetToken(USER);
    const tokenB = createResetToken(USER);
    expect(verifyResetToken(tokenA, USER.password_hash).valid).toBe(true);
    expect(verifyResetToken(tokenB, USER.password_hash).valid).toBe(true);
  });
});
