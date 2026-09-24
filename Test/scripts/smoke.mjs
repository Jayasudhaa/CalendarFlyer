import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const environment = process.argv[2];
const targets = { local: 'http://localhost:5100', staging: process.env.STAGING_URL, live: 'https://calendarflyapp.com' };
if (!['local', 'staging', 'live'].includes(environment)) throw new Error('Choose local, staging, or live.');
if (!targets[environment]) throw new Error('Staging is not deployed yet. Set STAGING_URL to its HTTPS address first.');
const base = new URL(targets[environment]);
if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Use an origin only, without credentials, path, or query.');
if (environment === 'staging' && (base.protocol !== 'https:' || ['calendarflyapp.com', 'www.calendarflyapp.com'].includes(base.hostname))) throw new Error('Staging must have a separate HTTPS address.');
const results = [];
const headers = environment === 'staging' && process.env.STAGING_ACCESS_KEY
  ? { 'x-staging-key': process.env.STAGING_ACCESS_KEY } : {};
async function check(path, verify) {
  try {
    // Fixed GET-only paths. Redirects fail closed so staging cannot silently test production.
    const response = await fetch(new URL(path, base), { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await verify(response);
    results.push({ path, pass: true });
    console.log(`PASS ${path}`);
  } catch (error) { results.push({ path, pass: false, error: error.message }); console.error(`FAIL ${path}: ${error.message}`); }
}
await check('/', async response => {
  if (!response.headers.get('content-type')?.includes('text/html')) throw new Error('Expected HTML');
  const html = await response.text();
  if (!/id=["']root["']/.test(html) || !/script/.test(html)) throw new Error('App shell missing');
  const asset = html.match(/<script[^>]+src=["']([^"']+)["']/)?.[1];
  if (!asset) throw new Error('App script missing');
  const assetURL = new URL(asset, base);
  if (assetURL.origin !== base.origin) throw new Error('App script points outside this environment');
  const script = await fetch(assetURL, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!script.ok || !/javascript/.test(script.headers.get('content-type') || '')) throw new Error('App script is unavailable');
});
await check('/api/health', async response => {
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Expected API JSON');
  if ((await response.json()).status !== 'ok') throw new Error('API unhealthy');
});
const report = { environment, origin: base.origin, checkedAt: new Date().toISOString(), results };
const directory = fileURLToPath(new URL('../reports/', import.meta.url));
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(`${directory}/${environment}-smoke.json`, JSON.stringify(report, null, 2));
if (results.some(result => !result.pass)) process.exitCode = 1;
