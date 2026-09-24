/**
 * server/scheduler.js — fires scheduled broadcasts (Broadcast page →
 * "Schedule for later") when their time comes.
 *
 * This app has no queue or cron infrastructure (App Runner runs this one
 * long-lived Express process, nothing serverless/EventBridge-based) — so,
 * same spirit as organizations.js's settleTrial() lazy-check comment, the
 * simplest thing that actually works is an in-process poll: every ~60s,
 * ask broadcasts.js for anything in `calendarfly_broadcasts` whose
 * status is still 'scheduled' and whose time has come (via the
 * status-index GSI — a cheap Query, not a table scan), and send it.
 *
 * Only runs while this process is up. If the server restarts (deploy,
 * crash) between polls, nothing is lost — due items are still sitting in
 * DynamoDB with status='scheduled' and get picked up on the next tick
 * after the process comes back. What it can't do: fire something while the
 * process is down for longer than a poll interval — there's no separate
 * always-on worker. Fine at this app's current scale (one process, one
 * region); revisit with a real queue if that stops being true.
 */

const {
  listDueScheduledBroadcasts,
  claimScheduledBroadcast,
  recordPlatformResult,
} = require('./broadcasts');
const { incrementUsage } = require('./organizations');

const POLL_INTERVAL_MS = 60 * 1000;

// Lazily required — routes/broadcast.js requires this file's sibling
// broadcasts.js is fine, but broadcast.js itself isn't loaded until
// server.js mounts the routes, and this module is required from server.js
// too. Requiring it inside start()/runOnce() rather than at module load
// avoids depending on which of the two server.js requires first.
function loadBroadcastRoute() {
  return require('./routes/broadcast');
}

// Downloads a scheduled broadcast's flyer image back out of S3 (uploaded
// there at schedule time — see uploadScheduledImageToS3 in routes/
// broadcast.js) and re-encodes it as the data: URI string the existing
// broadcastWhatsApp/broadcastFacebook/broadcastInstagram functions expect,
// so this poller can reuse those functions completely unchanged rather
// than re-implementing per-platform sending.
async function fetchMediaAsBase64(media_url) {
  if (!media_url) return null;
  const fetch = require('node-fetch');
  const res = await fetch(media_url);
  if (!res.ok) throw new Error(`Could not re-fetch scheduled image (HTTP ${res.status})`);
  const buffer = await res.buffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function withRsvpLink(caption, auto_rsvp, rsvp_url) {
  if (auto_rsvp && rsvp_url && !caption.includes(rsvp_url)) {
    return `${caption}\n\n📋 RSVP: ${rsvp_url}`;
  }
  return caption;
}

async function sendOnePlatform(platform, row, org, imageBase64, finalCaption) {
  const { broadcastWhatsApp, broadcastWhatsAppTemplate, broadcastFacebook, broadcastInstagram } = loadBroadcastRoute();
  if (platform === 'whatsapp' && row.wa_template) {
    return broadcastWhatsAppTemplate({ template_name: row.wa_template.template_name, variables: row.wa_template.variables, org });
  }
  if (platform === 'whatsapp') return broadcastWhatsApp({ imageBase64, caption: finalCaption, org });
  if (platform === 'facebook') return broadcastFacebook({ imageBase64, caption: finalCaption, org });
  if (platform === 'instagram') return broadcastInstagram({ imageBase64, caption: finalCaption, org });
  throw new Error(`Unknown platform: ${platform}`);
}

async function fireScheduledBroadcast(row) {
  const { resolveOrgById } = loadBroadcastRoute();
  const org = await resolveOrgById(row.org_id);
  if (!org) {
    console.error(`[SCHEDULER] ✗ ${row.broadcast_id} — organization ${row.org_id} no longer exists`);
    for (const platform of row.platforms) {
      await recordPlatformResult(row.broadcast_id, platform, { success: false, error: 'Organization not found' });
    }
    return;
  }

  let imageBase64 = null;
  try {
    imageBase64 = await fetchMediaAsBase64(row.media_url);
  } catch (err) {
    console.error(`[SCHEDULER] ✗ ${row.broadcast_id} — could not fetch scheduled image:`, err.message);
    // Fall through and still attempt caption-only platforms (WhatsApp/
    // Facebook allow that); Instagram will fail its own way below since
    // broadcastInstagram requires an image — same as an immediate send.
  }

  const finalCaption = withRsvpLink(row.caption || '', row.auto_rsvp, row.rsvp_url);

  console.log(`[SCHEDULER] Firing ${row.broadcast_id} for ${org.name} → ${row.platforms.join(', ')}`);
  await Promise.all(row.platforms.map(async (platform) => {
    try {
      const result = await sendOnePlatform(platform, row, org, imageBase64, finalCaption);
      await recordPlatformResult(row.broadcast_id, platform, { success: true, ...result });
      await incrementUsage(org.org_id, 'flyers').catch(err => console.error('[SCHEDULER] Failed to increment usage:', err.message));
      console.log(`[SCHEDULER] ✓ ${row.broadcast_id} — ${platform}`);
    } catch (err) {
      console.error(`[SCHEDULER] ✗ ${row.broadcast_id} — ${platform}:`, err.message);
      await recordPlatformResult(row.broadcast_id, platform, { success: false, error: err.message });
    }
  }));
}

let running = false;

async function runOnce() {
  if (running) return; // a previous tick is still working through a slow send — skip rather than overlap
  running = true;
  try {
    const due = await listDueScheduledBroadcasts();
    for (const row of due) {
      // Conditional claim — only proceeds if this row is still 'scheduled'.
      // Guards against this same tick (or, if this app ever scales past one
      // instance, a different one) double-firing the same broadcast.
      const claimed = await claimScheduledBroadcast(row.broadcast_id);
      if (!claimed) continue;
      await fireScheduledBroadcast(claimed).catch(err =>
        console.error(`[SCHEDULER] ✗ ${row.broadcast_id} — unexpected error:`, err.message)
      );
    }
  } catch (err) {
    console.error('[SCHEDULER] Poll failed:', err.message);
  } finally {
    running = false;
  }
}

// ── Guest sandbox cleanup ────────────────────────────────────────────────
// Self-serve demo orgs (POST /api/auth/guest-sandbox) already stop working
// on their own once their JWT's 48h expiry passes — this sweep just deletes
// the leftover org/user/event rows afterward so they don't pile up in
// DynamoDB forever. A much slower poll than the broadcast one above: nothing
// here is time-sensitive (access is already cut off by the token expiring),
// this is pure housekeeping. Same "if the process is down, nothing is lost,
// it's just picked up whenever it comes back" property as the broadcast
// poller — a sandbox row just sits there a bit longer, it's not lost.
const SANDBOX_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let sandboxSweepRunning = false;

async function sweepExpiredSandboxes() {
  if (sandboxSweepRunning) return;
  sandboxSweepRunning = true;
  try {
    const { listExpiredSandboxOrgs, deleteSandboxOrgData } = require('./organizations');
    const expired = await listExpiredSandboxOrgs();
    for (const org of expired) {
      try {
        const deleted = await deleteSandboxOrgData(org.org_id);
        if (deleted) console.log(`[SANDBOX] Cleaned up expired sandbox org ${org.org_id}`);
      } catch (err) {
        console.error(`[SANDBOX] ✗ Failed to clean up ${org.org_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[SANDBOX] Sweep failed:', err.message);
  } finally {
    sandboxSweepRunning = false;
  }
}

let intervalHandle = null;
let sandboxIntervalHandle = null;

function start() {
  if (!intervalHandle) {
    console.log(`[SCHEDULER] Watching for scheduled broadcasts every ${POLL_INTERVAL_MS / 1000}s`);
    intervalHandle = setInterval(runOnce, POLL_INTERVAL_MS);
    runOnce(); // also check immediately on boot, rather than waiting a full interval
  }
  if (!sandboxIntervalHandle) {
    console.log(`[SCHEDULER] Sweeping expired guest sandboxes every ${SANDBOX_SWEEP_INTERVAL_MS / 1000}s`);
    sandboxIntervalHandle = setInterval(sweepExpiredSandboxes, SANDBOX_SWEEP_INTERVAL_MS);
    sweepExpiredSandboxes();
  }
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  if (sandboxIntervalHandle) clearInterval(sandboxIntervalHandle);
  sandboxIntervalHandle = null;
}

module.exports = { start, stop, runOnce, sweepExpiredSandboxes };
