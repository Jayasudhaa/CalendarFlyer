/**
 * routes/broadcast.test.js
 * Covers POST /api/broadcast's validation (unknown platform, missing
 * fields) and the Email channel added this session — the two things that
 * changed here recently and had zero automated coverage before this. Real
 * AWS is never touched: DynamoDB and SES calls are intercepted with
 * aws-sdk-client-mock, so this runs anywhere, no credentials needed.
 *
 * Also covers POST /api/broadcast/schedule's reminder-series branch and
 * POST /api/broadcast/schedule/cancel-batch — the "Schedule for later"
 * event-reminders feature (BroadcastPage.jsx's ScheduleReminders card),
 * which had zero automated coverage before this.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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

describe('POST /api/broadcast/schedule (reminder series)', () => {
  let app;
  const token = signTestToken();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  beforeEach(() => {
    ddbMock.reset();
    ddbMock.on(GetCommand, { TableName: 'calendarfly_organizations' }).resolves({ Item: orgRecord() });
    ddbMock.on(PutCommand).resolves({});
    app = buildApp();
  });

  afterEach(() => {
    ddbMock.restore();
  });

  it('creates one broadcast row per reminder offset, all sharing a broadcast_group_id', async () => {
    const eventAt = Date.now() + 10 * DAY;
    const res = await request(app)
      .post('/api/broadcast/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        platforms: ['whatsapp'],
        caption: 'Diwali is coming!',
        event_at: eventAt,
        reminders: [
          { minutes_before: 7 * 24 * 60, label: '7 days before' },
          { minutes_before: 1 * 24 * 60, label: '1 day before' },
          { minutes_before: 3 * 60, label: '3 hours before' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.created).toHaveLength(3);
    expect(res.body.skipped).toHaveLength(0);
    expect(new Set(res.body.created.map(c => c.broadcast_id)).size).toBe(3); // three distinct rows
    expect(res.body.broadcast_group_id).toMatch(/^bg-/);

    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(3);
    // Every row created shares the same broadcast_group_id returned above,
    // and each row's own scheduled_for lands before the event itself.
    for (const call of putCalls) {
      const item = call.args[0].input.Item;
      expect(item.broadcast_group_id).toBe(res.body.broadcast_group_id);
      expect(item.status).toBe('scheduled');
      expect(item.scheduled_for).toBeLessThan(eventAt);
    }
  });

  it('skips a reminder offset that would fall in the past for this event date, but still creates the others', async () => {
    // Event is only 2 hours out: the "7 days before" and "1 day before"
    // offsets both compute to a time already in the past, so only the
    // "1 hour before" reminder is actually creatable.
    const eventAt = Date.now() + 2 * HOUR;
    const res = await request(app)
      .post('/api/broadcast/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        platforms: ['whatsapp'],
        caption: 'Starting soon!',
        event_at: eventAt,
        reminders: [
          { minutes_before: 7 * 24 * 60, label: '7 days before' },
          { minutes_before: 1 * 24 * 60, label: '1 day before' },
          { minutes_before: 60, label: '1 hour before' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.created[0].label).toBe('1 hour before');
    expect(res.body.skipped).toEqual(['7 days before', '1 day before']);
  });

  it('rejects a reminder series where every offset falls in the past', async () => {
    const eventAt = Date.now() + 30 * 1000; // 30 seconds out
    const res = await request(app)
      .post('/api/broadcast/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({
        platforms: ['whatsapp'],
        caption: 'Too late for reminders',
        event_at: eventAt,
        reminders: [{ minutes_before: 60, label: '1 hour before' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/every reminder.*falls in the past/i);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('rejects a reminder series with no event date', async () => {
    const res = await request(app)
      .post('/api/broadcast/schedule')
      .set('Authorization', `Bearer ${token}`)
      .send({ platforms: ['whatsapp'], caption: 'Missing event_at', reminders: [{ minutes_before: 60 }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/event/i);
  });
});

describe('POST /api/broadcast/schedule/cancel-batch', () => {
  let app;
  const token = signTestToken();

  beforeEach(() => {
    ddbMock.reset();
    ddbMock.on(GetCommand, { TableName: 'calendarfly_organizations' }).resolves({ Item: orgRecord() });
    ddbMock.on(UpdateCommand).resolves({});
    app = buildApp();
  });

  afterEach(() => {
    ddbMock.restore();
  });

  it('cancels every still-scheduled id in the group and reports per-id results', async () => {
    // cancelScheduledBroadcast() looks each id up first (GetCommand against
    // the broadcasts table, a different table than the org lookup stubbed
    // above) before it will cancel it — one still 'scheduled', one already
    // 'sent' (so it should come back as the "already_sent" error rather
    // than a success).
    ddbMock
      .on(GetCommand, { TableName: 'calendarfly_broadcasts', Key: { broadcast_id: 'bc-1' } })
      .resolves({ Item: { broadcast_id: 'bc-1', org_id: 'org-test', status: 'scheduled' } });
    ddbMock
      .on(GetCommand, { TableName: 'calendarfly_broadcasts', Key: { broadcast_id: 'bc-2' } })
      .resolves({ Item: { broadcast_id: 'bc-2', org_id: 'org-test', status: 'sent' } });

    const res = await request(app)
      .post('/api/broadcast/schedule/cancel-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: ['bc-1', 'bc-2'] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual(expect.arrayContaining([
      { broadcast_id: 'bc-1', success: true, error: null },
      { broadcast_id: 'bc-2', success: false, error: 'already_sent' },
    ]));
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1); // only the still-scheduled one got updated
  });

  it('rejects an empty ids list', async () => {
    const res = await request(app)
      .post('/api/broadcast/schedule/cancel-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [] });

    expect(res.status).toBe(400);
  });
});
