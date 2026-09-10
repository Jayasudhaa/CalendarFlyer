/**
 * routes/broadcast.test.js
 * Covers POST /api/broadcast's validation (unknown platform, missing
 * fields) and the Email channel added this session — the two things that
 * changed here recently and had zero automated coverage before this. Real
 * AWS is never touched: DynamoDB and SES calls are intercepted with
 * aws-sdk-client-mock, so this runs anywhere, no credentials needed.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { signTestToken } from '../test/jwt';

const ddbMock = mockClient(DynamoDBDocumentClient);
const sesMock = mockClient(SESClient);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/broadcast', require('./broadcast'));
  return app;
}

function orgRecord(overrides = {}) {
  return { org_id: 'org-test', name: 'Sri Lakshmi Temple', broadcast_email: '', ...overrides };
}

describe('POST /api/broadcast', () => {
  let app;
  const token = signTestToken();

  beforeEach(() => {
    ddbMock.reset();
    sesMock.reset();
    // Every route calls resolveOrg() first, which does a GetCommand — stub
    // it once here; individual tests override with a fresh .on(GetCommand)
    // when they need a different organization shape (e.g. broadcast_email set).
    ddbMock.on(GetCommand).resolves({ Item: orgRecord() });
    app = buildApp();
  });

  afterEach(() => {
    ddbMock.restore();
    sesMock.restore();
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/broadcast').send({ platform: 'email', caption: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects a request missing platform or caption', async () => {
    const res = await request(app)
      .post('/api/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({ caption: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing platform or caption/);
  });

  it('rejects a platform outside the known allowlist', async () => {
    const res = await request(app)
      .post('/api/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'telegram', caption: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown platform/);
  });

  it('rejects the email channel when the org has no broadcast_email set', async () => {
    ddbMock.on(GetCommand).resolves({ Item: orgRecord({ broadcast_email: '' }) });
    const res = await request(app)
      .post('/api/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'email', caption: 'Diwali is coming!' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/email list address/i);
    expect(sesMock.calls()).toHaveLength(0);
  });

  it('sends via SES when the org has broadcast_email set, and reports success', async () => {
    // SES_FROM_EMAIL is one of the still-pending external config items
    // (see mailer.js) -- simulated as set here so this test verifies the
    // CODE PATH works once that's configured, independent of whether it
    // actually is in any given environment right now.
    const prevFrom = process.env.SES_FROM_EMAIL;
    process.env.SES_FROM_EMAIL = 'noreply@example.org';
    ddbMock.on(GetCommand).resolves({ Item: orgRecord({ broadcast_email: 'list@example.org' }) });
    sesMock.on(SendEmailCommand).resolves({ MessageId: 'ses-message-1' });

    const res = await request(app)
      .post('/api/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({ platform: 'email', caption: 'Diwali is coming!', event: { title: 'Diwali' } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sesMock.calls()).toHaveLength(1);
    const sentTo = sesMock.call(0).args[0].input.Destination.ToAddresses;
    expect(sentTo).toContain('list@example.org');
    process.env.SES_FROM_EMAIL = prevFrom;
  });
});
