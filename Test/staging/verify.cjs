const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'state.json')));
const secrets = JSON.parse(fs.readFileSync(path.join(__dirname, 'private/credentials.json')));
assert.equal(state.name, 'calendarfly-staging');
assert.match(state.serviceArn, /:service\/calendarfly-staging\//);
const base = new URL(state.url);
assert.equal(base.protocol, 'https:');
assert.match(base.hostname, /^[a-z0-9]+\.us-east-2\.awsapprunner\.com$/);
const results = [];
async function request(route, {method = 'GET', body, token, authenticated = true, cookie} = {}) {
  return fetch(new URL(route, base), {method, redirect: 'manual', signal: AbortSignal.timeout(30000),
    headers: {'Content-Type': 'application/json', ...(authenticated ? {'x-staging-key': secrets.STAGING_ACCESS_KEY} : {}), ...(token ? {Authorization: `Bearer ${token}`} : {}), ...(cookie ? {cookie} : {})},
    body: body ? JSON.stringify(body) : undefined});
}
async function api(route, options) {
  const r = await request(route, options);
  assert.ok(r.ok, `${route}: HTTP ${r.status}`);
  return r.json();
}
async function check(name, fn) { await fn(); results.push({name, pass: true}); console.log('PASS ' + name); }
(async () => {
  await check('staging identity', async () => {
    assert.equal((await api('/api/health', {authenticated:false})).environment, 'staging');
    const status = await api('/api/staging-status');
    assert.equal(status.tablePrefix, 'calendarfly_staging_');
    assert.equal(status.integrations, 'disabled');
  });
  await check('anonymous access blocked', async () => {
    assert.equal((await request('/api/events', {authenticated:false})).status, 401);
    assert.equal((await request('/', {authenticated:false})).status, 401);
  });
  await check('secure login cookie', async () => {
    const r = await fetch(new URL('/staging-login', base), {method:'POST',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'staging',password:secrets.STAGING_ACCESS_KEY})});
    assert.equal(r.status,302);
    const cookie=r.headers.get('set-cookie');
    assert.match(cookie,/HttpOnly/i); assert.match(cookie,/Secure/i); assert.match(cookie,/SameSite=Lax/i);
    assert.equal((await request('/api/staging-status',{authenticated:false,cookie:cookie.split(';')[0]})).status,200);
  });
  await check('frontend and staging banner', async () => {
    const r=await request('/'); assert.equal(r.status,200);
    assert.match(r.headers.get('x-robots-tag'),/noindex/);
    const html=await r.text(); assert.match(html,/STAGING/); assert.match(html,/id="root"/);
    const asset=html.match(/<script[^>]+src="([^"]+)"/)[1];
    assert.equal(new URL(asset,base).origin,base.origin);
    const script=await request(asset); assert.equal(script.status,200); assert.match(script.headers.get('content-type'),/javascript/);
  });
  await check('external integrations blocked', async () => {
    for(const route of ['/api/billing','/api/broadcast','/api/auth/google','/api/contact','/api/generate-image']) assert.equal((await request(route)).status,503,route);
  });
  const guest=await api('/api/auth/guest-sandbox',{method:'POST',body:{category:'temple'}});
  assert.ok(guest.token);
  let event;
  try {
    await check('guest login and event create/read/update', async () => {
      event=(await api('/api/events',{method:'POST',body:{title:'Staging verification '+Date.now(),date:'2026-12-01'},token:guest.token})).event;
      assert.ok(event.event_id);
      const route='/api/events/'+encodeURIComponent(event.event_id);
      await api(route,{method:'PUT',body:{title:'Updated staging verification'},token:guest.token});
      const list=await api('/api/events',{token:guest.token});
      assert.equal(list.events.find(e=>e.event_id===event.event_id).title,'Updated staging verification');
    });
  } finally {
    if(event) await check('test event cleanup',async()=>{
      await api('/api/events/'+encodeURIComponent(event.event_id),{method:'DELETE',token:guest.token});
      assert.ok(!(await api('/api/events',{token:guest.token})).events.some(e=>e.event_id===event.event_id));
    });
  }
})().catch(e=>{results.push({name:e.message,pass:false});console.error(e.message);process.exitCode=1;}).finally(()=>{
  fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({url:state.url,checkedAt:new Date().toISOString(),results},null,2));
});
