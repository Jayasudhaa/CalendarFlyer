import assert from 'node:assert/strict';
const base = 'http://localhost:5100';
async function request(path, method = 'GET', body, token) {
  const response = await fetch(base + path, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}
// No arbitrary target URL: mutations are restricted to this local instance.
assert.deepEqual(await request('/api/test-environment'), { environment: 'local', isolated: true });
const guest = await request('/api/auth/guest-sandbox', 'POST', { category: 'temple' });
assert.ok(guest.token);
let event;
try {
  const created = await request('/api/events', 'POST', { title: `Local integration ${Date.now()}`, date: '2026-12-01' }, guest.token);
  event = created.event;
  assert.ok(event.event_id);
  const listed = await request('/api/events', 'GET', undefined, guest.token);
  assert.ok(listed.events.some(row => row.event_id === event.event_id));
  await request(`/api/events/${event.event_id}`, 'PUT', { title: 'Updated local integration event' }, guest.token);
  const updated = await request('/api/events', 'GET', undefined, guest.token);
  assert.equal(updated.events.find(row => row.event_id === event.event_id).title, 'Updated local integration event');
  console.log('PASS local guest login and event create/read/update');
} finally {
  if (event) {
    await request(`/api/events/${event.event_id}`, 'DELETE', undefined, guest.token);
    const remaining = await request('/api/events', 'GET', undefined, guest.token);
    assert.ok(!remaining.events.some(row => row.event_id === event.event_id));
    console.log('PASS local event deletion');
  }
}
console.log('Guest test organization remains in the local database for inspection.');
