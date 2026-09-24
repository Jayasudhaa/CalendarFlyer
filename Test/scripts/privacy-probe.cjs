const assert = require('node:assert/strict');
require('./test-environment.cjs').validate(process.env);
const { createPhoto } = require('./photos');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION, endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB }));
const jwt = require('jsonwebtoken');
const { COMMUNITY_JWT_SECRET } = require('./utils/communityJwtSecret');
async function api(path, method = 'GET', body, token) {
  const r = await fetch('http://localhost:5000' + path, { method, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
(async () => {
  const guest = (await api('/api/auth/guest-sandbox', 'POST', { category: 'temple' })).data;
  assert.ok(guest.token);
  const event = (await api('/api/events', 'POST', { title: 'Album privacy retest', date: '2026-12-02' }, guest.token)).data.event;
  assert.ok(event);
  let album, photo;
  try {
    album = (await api('/api/photo-albums', 'POST', { event_id: event.event_id, name: 'Privacy retest', visibility: 'private', publishing_status: 'draft' }, guest.token)).data.album;
    assert.ok(album);
    photo = { photo_id: 'probe-' + Date.now(), event_id: event.event_id, album_id: album.album_id, org_id: guest.organization.org_id, member_id: 'local-owner', url: 'https://example.invalid/private-probe.jpg', key: 'local-probe', status: 'live', created_at: Date.now() };
    await createPhoto(photo);
    const token = jwt.sign({ role: 'community', member_id: 'local-attendee', org_id: guest.organization.org_id }, COMMUNITY_JWT_SECRET, { expiresIn: '5m' });
    for (const [visibility, publishing_status, expectedVisible] of [['private','draft',false], ['private','published',false], ['hidden','published',false], ['public','draft',false], ['public','published',true]]) {
      assert.equal((await api('/api/photo-albums/' + album.album_id, 'PATCH', { visibility, publishing_status }, guest.token)).status, 200);
      const r = await api('/api/photos/event/' + event.event_id, 'GET', undefined, token);
      const visible = (r.data.photos || []).some(p => p.photo_id === photo.photo_id);
      const pass = r.status === 200 && visible === expectedVisible;
      console.log(JSON.stringify({ test: visibility + '/' + publishing_status, status: r.status, photoReturned: visible, expectedVisible, pass }));
      if (!pass) process.exitCode = 1;
    }
    assert.equal((await api('/api/photo-albums/' + album.album_id, 'PATCH', { visibility: 'private' }, guest.token)).status, 200);
    assert.equal((await api('/api/photo-albums/' + album.album_id, 'DELETE', undefined, guest.token)).status, 200);
    const r = await api('/api/photos/event/' + event.event_id, 'GET', undefined, token);
    const visible = (r.data.photos || []).some(p => p.photo_id === photo.photo_id);
    const pass = r.status === 200 && !visible;
    console.log(JSON.stringify({ test: 'Deleted private album must not expose its photos', status: r.status, photoReturned: visible, expectedVisible: false, pass }));
    if (!pass) process.exitCode = 1;
  } finally {
    if (photo) await db.send(new DeleteCommand({ TableName: 'calendarfly_event_photos', Key: { photo_id: photo.photo_id } }));
    if (album) await api('/api/photo-albums/' + album.album_id, 'DELETE', undefined, guest.token);
    await api('/api/events/' + event.event_id, 'DELETE', undefined, guest.token);
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
