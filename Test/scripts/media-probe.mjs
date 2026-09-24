import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = 'http://localhost:5100';
const results = [];
async function api(path, method = 'GET', body, token) {
  const r = await fetch(origin + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
}
async function check(name, action) {
  try { await action(); results.push({ name, pass: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, pass: false, error: e.message }); console.log('FAIL ' + name + ': ' + e.message); }
}
assert.deepEqual((await api('/api/test-environment')).data, { environment: 'local', isolated: true });
const guest = (await api('/api/auth/guest-sandbox', 'POST', { category: 'temple' })).data;
assert.ok(guest.token);
const other = (await api('/api/auth/guest-sandbox', 'POST', { category: 'temple' })).data;
assert.ok(other.token);
const created = await api('/api/events', 'POST', { title: 'Latest code media probe ' + Date.now(), date: '2026-12-01' }, guest.token);
assert.equal(created.status, 200);
const eventId = created.data.event.event_id;
let albumId;
const streams = [];
try {
  await check('Album create', async () => {
    const r = await api('/api/photo-albums', 'POST', { event_id: eventId, name: 'Local probe', visibility: 'private' }, guest.token);
    assert.equal(r.status, 201, JSON.stringify(r.data)); albumId = r.data.album.album_id;
    assert.equal(r.data.album.visibility, 'private');
  });
  await check('Album overview', async () => { const r = await api('/api/photo-albums/overview', 'GET', undefined, guest.token); assert.equal(r.status, 200); assert.ok(r.data.recent_albums.some(a => a.album_id === albumId)); });
  await check('Album edit', async () => { const r = await api('/api/photo-albums/' + albumId, 'PATCH', { name: 'Updated album' }, guest.token); assert.equal(r.status, 200); assert.equal(r.data.album.name, 'Updated album'); });
  await check('Album tenant separation', async () => { const r = await api('/api/photo-albums/' + albumId, 'GET', undefined, other.token); assert.equal(r.status, 404); });
  await check('Album rejects invalid visibility', async () => { const r = await api('/api/photo-albums/' + albumId, 'PATCH', { visibility: 'invalid' }, guest.token); assert.equal(r.status, 400); });
  await check('Glimpse overview', async () => { const r = await api('/api/livestreams/overview', 'GET', undefined, guest.token); assert.equal(r.status, 200); assert.ok(Array.isArray(r.data.recent)); });
  for (const duration of [16, -1, 'abc']) {
    await check('Glimpse rejects invalid duration ' + JSON.stringify(duration), async () => {
      const r = await api('/api/livestreams', 'POST', { event_id: eventId, date: '2026-12-01', key: `orgs/${guest.organization.org_id}/events/${eventId}/glimpses/local-probe.mp4`, duration_seconds: duration }, guest.token);
      if (r.data.stream?.stream_id) streams.push(r.data.stream.stream_id);
      assert.equal(r.status, 400, `Expected 400, received ${r.status}; persisted duration=${JSON.stringify(r.data.stream?.duration_seconds)}`);
    });
  }
} finally {
  for (const id of streams) await api('/api/livestreams/' + id, 'DELETE', undefined, guest.token);
  if (albumId) await check('Album delete', async () => { assert.equal((await api('/api/photo-albums/' + albumId, 'DELETE', undefined, guest.token)).status, 200); });
  await api('/api/events/' + eventId, 'DELETE', undefined, guest.token);
  fs.writeFileSync(new URL('../reports/latest-media.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
}
process.exitCode = results.some(r => !r.pass) ? 1 : 0;
