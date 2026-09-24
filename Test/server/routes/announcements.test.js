/**
 * routes/announcements.test.js
 * Covers the new /api/announcements routes: the cap-at-20 behavior (pure,
 * mirroring signups.js's earlyAccessUntil/isLockedForViewer export style),
 * the public GET route's "never error out to visitors" contract, and the
 * admin POST/DELETE auth + validation. Real AWS is never touched —
 * DynamoDB is intercepted with aws-sdk-client-mock.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { signTestToken } from '../test/jwt';
const { appendAnnouncement } = require('./announcements');

const ddbMock = mockClient(DynamoDBDocumentClient);

function buildApp({ withOrgMiddleware = false } = {}) {
  const app = express();
  app.use(express.json());
  if (withOrgMiddleware) {
    // Stand-in for tenantMiddleware: a public visitor's subdomain-resolved org.
    app.use((req, res, next) => { req.org = { org_id: 'org-test' }; next(); });
  }
  app.use('/api/announcements', require('./announcements'));
  return app;
}

function orgRecord(overrides = {}) {
  return { org_id: 'org-test', name: 'Sri Lakshmi Temple', announcements: [], ...overrides };
}

describe('appendAnnouncement (pure cap-at-20 logic)', () => {
  it('appends to an empty/undefined list', () => {
    expect(appendAnnouncement(undefined, { id: '1' })).toEqual([{ id: '1' }]);
    expect(appendAnnouncement([], { id: '1' })).toEqual([{ id: '1' }]);
  });

  it('keeps all entries when under the cap', () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({ id: String(i) }));
    const result = appendAnnouncement(existing, { id: 'new' });
    expect(result).toHaveLength(6);
    expect(result[result.length - 1]).toEqual({ id: 'new' });
  });

  it('caps at 20, dropping the oldest entries first', () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({ id: `old-${i}` }));
    const result = appendAnnouncement(existing, { id: 'newest' });
    expect(result).toHaveLength(20);
    expect(result[0]).toEqual({ id: 'old-1' }); // old-0 dropped
    expect(result[result.length - 1]).toEqual({ id: 'newest' });
  });

  it('respects a custom max', () => {
    const existing = [{ id: 'a' }, { id: 'b' }];
    expect(appendAnnouncement(existing, { id: 'c' }, 2)).toEqual([{ id: 'b' }, { id: 'c' }]);
  });
});

describe('GET /api/announcements', () => {
  let app;
  beforeEach(() => { ddbMock.reset(); });
  afterEach(() => { ddbMock.restore(); });

  it('returns an empty array when no org can be resolved (no error)', async () => {
    app = buildApp({ withOrgMiddleware: false });
    const res = await request(app).get('/api/announcements');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ announcements: [] });
  });

  it('never errors out to a public visitor even if DynamoDB fails', async () => {
    app = buildApp({ withOrgMiddleware: true });
    ddbMock.on(GetCommand).rejects(new Error('boom'));
    const res = await request(app).get('/api/announcements');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ announcements: [] });
  });

  it('returns stored announcements, most-recent-first, with body/date aliases', async () => {
    app = buildApp({ withOrgMiddleware: true });
    const created_at = 1_700_000_000_000;
    ddbMock.on(GetCommand).resolves({
      Item: orgRecord({ announcements: [
        { id: '1', message: 'first', created_at },
        { id: '2', message: 'second', created_at: created_at + 1000 },
      ] }),
    });
    const res = await request(app).get('/api/announcements');
    expect(res.status).toBe(200);
    expect(res.body.announcements).toHaveLength(2);
    expect(res.body.announcements[0].id).toBe('2'); // most recent first
    expect(res.body.announcements[0].body).toBe('second');
    expect(res.body.announcements[0].date).toBe(new Date(created_at + 1000).toISOString().slice(0, 10));
  });
});

describe('POST /api/announcements', () => {
  let app;
  const token = signTestToken();
  beforeEach(() => {
    ddbMock.reset();
    ddbMock.on(GetCommand).resolves({ Item: orgRecord() });
    app = buildApp();
  });
  afterEach(() => { ddbMock.restore(); });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/announcements').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects an empty message', async () => {
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects a message over the max length', async () => {
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('creates an announcement and returns it', async () => {
    const res = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Diwali celebration this Friday!' });
    expect(res.status).toBe(200);
    expect(res.body.announcement.message).toBe('Diwali celebration this Friday!');
    expect(res.body.announcement.id).toBeTruthy();
  });
});

describe('DELETE /api/announcements/:id', () => {
  let app;
  const token = signTestToken();
  beforeEach(() => {
    ddbMock.reset();
    app = buildApp();
  });
  afterEach(() => { ddbMock.restore(); });

  it('requires authentication', async () => {
    const res = await request(app).delete('/api/announcements/abc');
    expect(res.status).toBe(401);
  });

  it('removes the matching entry by id', async () => {
    ddbMock.on(GetCommand).resolves({ Item: orgRecord({ announcements: [
      { id: 'keep', message: 'stays', created_at: 1 },
      { id: 'gone', message: 'removed', created_at: 2 },
    ] }) });
    const res = await request(app)
      .delete('/api/announcements/gone')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.announcements.find(a => a.id === 'gone')).toBeUndefined();
    expect(res.body.announcements.find(a => a.id === 'keep')).toBeTruthy();
  });
});
