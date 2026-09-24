/**
 * server/routes/signups.js -- Sign-Up Sheets (Volunteer shifts + Potluck
 * dishes), one shared system built on the "Sheet -> Slots -> Entries"
 * model (see server/signups.js for the data layer, dynamodb-schema.js for
 * tables/GSIs).
 *
 * Same two-audience split as routes/photos.js:
 *  - Admins (authenticateToken, req.user.org_id) create/manage sheets and
 *    see the org-wide volunteer-hours report.
 *  - Community members (authenticateCommunityToken, req.communityUser --
 *    the same phone-verified identity photo sharing uses) join/cancel
 *    slots on the devotee-facing page.
 *
 * Every route re-derives an event/sheet/slot's org from the DB and checks
 * it against the caller's own org_id -- same cross-tenant discipline as
 * routes/photos.js, never trusting an id to already be scoped correctly.
 */

const express = require('express');
const crypto = require('crypto');

const { authenticateCommunityToken, getMember } = require('../community-auth');
const { authenticateToken } = require('./auth');
const { getEvent } = require('../events');
const { getOrganization } = require('../organizations');
const {
  createSheet, getSheet, listSheetsForEvent, listSheetsForOrg, deleteSheet,
  createSlot, getSlot, listSlotsForSheet, deleteSlot,
  createEntry, getEntry, listActiveEntriesForSlot, listActiveEntriesForSheet, listEntriesForMember,
  setEntryStatus, promoteFromWaitlist, volunteerHoursReportForOrg, summarizeVolunteerMinutes,
} = require('../signups');

const router = express.Router();

const SHEET_TYPES = new Set(['volunteer', 'potluck']);

/**
 * temple orgs default to Volunteer Shifts; every other org type (nonprofit,
 * community, other -- see OnboardingWizard.jsx's CATEGORIES) defaults to
 * Potluck, the closer fit for a diaspora/community-association gathering.
 * Purely a UI default -- the create-sheet picker can always override it
 * per sheet, so this never blocks a temple from running a potluck (a
 * festival cookout) or a community org from running a volunteer shift
 * (setup help for their own event).
 */
function defaultSignupType(orgCategory) {
  return orgCategory === 'temple' ? 'volunteer' : 'potluck';
}

/** Loads the event and checks it belongs to org_id -- same shape as routes/photos.js. */
async function loadEventForOrg(event_id, org_id) {
  if (!event_id) return null;
  const event = await getEvent(event_id);
  if (!event || event.org_id !== org_id) return null;
  return event;
}

/** Loads a sheet, checked against org_id, or null. */
async function loadSheetForOrg(sheet_id, org_id) {
  const sheet = await getSheet(sheet_id);
  if (!sheet || sheet.org_id !== org_id) return null;
  return sheet;
}

/** One slot's roster view: capacity, who's confirmed, who's waitlisted. `viewerMemberId` (devotee pages only) flags their own entries. */
function buildSlotView(slot, entriesForSlot, viewerMemberId) {
  const shape = (e) => ({
    entry_id: e.entry_id,
    name: e.member_name,
    dish: e.dish || null,
    mine: viewerMemberId ? e.member_id === viewerMemberId : false,
  });
  return {
    slot_id: slot.slot_id,
    label: slot.label,
    time_label: slot.time_label || null,
    duration_minutes: slot.duration_minutes || null,
    capacity: slot.capacity,
    confirmed: entriesForSlot.filter((e) => e.status === 'confirmed').map(shape),
    waitlist: entriesForSlot.filter((e) => e.status === 'waitlisted').map(shape),
  };
}

/**
 * Early access: when a sheet is created with early_access_hours set,
 * followers can join starting immediately, everyone else only after
 * created_at + early_access_hours has passed. Deliberately measured from
 * when the sheet opened, not from the event date/time -- event_date is
 * often just a date string (no reliable time-of-day to count down to),
 * while created_at is an exact timestamp every sheet already has. This is
 * the "presale window" shape (first dibs when something new opens), not a
 * countdown-to-event.
 */
function earlyAccessUntil(sheet) {
  if (!sheet.early_access_hours) return null;
  return sheet.created_at + sheet.early_access_hours * 60 * 60 * 1000;
}

/** True if a non-follower would currently be locked out of this sheet. */
function isLockedForViewer(sheet, viewerFollowing) {
  const until = earlyAccessUntil(sheet);
  if (!until) return false;
  if (viewerFollowing) return false;
  return Date.now() < until;
}

/** Assembles one sheet's full view -- every slot plus who's on each. */
async function buildSheetView(sheet, viewerMemberId, viewerFollowing) {
  const [slots, entries] = await Promise.all([
    listSlotsForSheet(sheet.sheet_id),
    listActiveEntriesForSheet(sheet.sheet_id),
  ]);
  const entriesBySlot = new Map();
  for (const e of entries) {
    if (!entriesBySlot.has(e.slot_id)) entriesBySlot.set(e.slot_id, []);
    entriesBySlot.get(e.slot_id).push(e);
  }
  const until = earlyAccessUntil(sheet);
  return {
    sheet_id: sheet.sheet_id,
    event_id: sheet.event_id,
    type: sheet.type,
    title: sheet.title,
    event_date: sheet.event_date,
    status: sheet.status,
    early_access_hours: sheet.early_access_hours || null,
    early_access_until: until,
    locked: isLockedForViewer(sheet, viewerFollowing),
    slots: slots.map((s) => buildSlotView(s, entriesBySlot.get(s.slot_id) || [], viewerMemberId)),
  };
}

// ── Admin routes ─────────────────────────────────────────────────────────

// GET /api/signups/default-type -- this org's suggested template, for the
// create-sheet picker's default selection (see defaultSignupType above).
router.get('/default-type', authenticateToken, async (req, res) => {
  try {
    const org = await getOrganization(req.user.org_id);
    res.json({ default_type: defaultSignupType(org && org.category) });
  } catch (err) {
    console.error('[SIGNUPS] Failed to resolve default type:', err);
    res.json({ default_type: 'volunteer' });
  }
});

// POST /api/signups/sheets -- create a sheet + its slots in one call.
// body: { event_id, type: 'volunteer'|'potluck', title, event_date,
//         slots: [{ label, time_label?, duration_minutes?, capacity }] }
router.post('/sheets', authenticateToken, async (req, res) => {
  try {
    const { event_id, type, title, event_date, slots, early_access_hours } = req.body || {};
    if (!event_id || !SHEET_TYPES.has(type) || !title || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ error: 'event_id, type (volunteer|potluck), title, and at least one slot are required.' });
    }
    const event = await loadEventForOrg(event_id, req.user.org_id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    // Optional -- how many hours followers get first dibs before this sheet
    // opens to everyone. 0/absent = no gating, open to all immediately.
    const earlyAccessHours = Math.max(0, Math.min(168, parseInt(early_access_hours, 10) || 0));

    const now = Date.now();
    const sheet = {
      sheet_id: `sh-${crypto.randomUUID()}`,
      org_id: req.user.org_id,
      event_id,
      type,
      title: title.toString().slice(0, 140),
      event_date: event_date || event.date || '',
      status: 'open',
      early_access_hours: earlyAccessHours || null,
      created_by: req.user.user_id,
      created_at: now,
    };
    await createSheet(sheet);

    let order = 0;
    for (const s of slots) {
      const capacity = Math.max(1, Math.min(500, parseInt(s.capacity, 10) || 1));
      await createSlot({
        slot_id: `sl-${crypto.randomUUID()}`,
        sheet_id: sheet.sheet_id,
        org_id: req.user.org_id,
        label: (s.label || '').toString().slice(0, 120) || 'Untitled',
        time_label: type === 'volunteer' ? (s.time_label || '').toString().slice(0, 60) || null : null,
        duration_minutes: type === 'volunteer' ? Math.max(0, parseInt(s.duration_minutes, 10) || 0) : null,
        capacity,
        sort_order: order++,
        created_at: now,
      });
    }

    res.status(201).json({ success: true, sheet: await buildSheetView(sheet) });
  } catch (err) {
    console.error('[SIGNUPS] Failed to create sheet:', err);
    res.status(500).json({ error: 'Could not create that sign-up sheet -- try again.' });
  }
});

// GET /api/signups/sheets/event/:eventId -- every sheet for one event (admin per-event view).
router.get('/sheets/event/:eventId', authenticateToken, async (req, res) => {
  try {
    const event = await loadEventForOrg(req.params.eventId, req.user.org_id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    const sheets = await listSheetsForEvent(req.params.eventId);
    const views = await Promise.all(sheets.map((s) => buildSheetView(s)));
    res.json({ sheets: views });
  } catch (err) {
    console.error('[SIGNUPS] Failed to list sheets for event:', err);
    res.status(500).json({ error: 'Could not load sign-up sheets.' });
  }
});

// GET /api/signups/sheets -- every sheet for this org, newest first (Sign-Ups dashboard landing).
router.get('/sheets', authenticateToken, async (req, res) => {
  try {
    const sheets = await listSheetsForOrg(req.user.org_id);
    res.json({ sheets });
  } catch (err) {
    console.error('[SIGNUPS] Failed to list org sheets:', err);
    res.status(500).json({ error: 'Could not load sign-up sheets.' });
  }
});

// GET /api/signups/sheets/:id -- one sheet's full detail.
router.get('/sheets/:id', authenticateToken, async (req, res) => {
  try {
    const sheet = await loadSheetForOrg(req.params.id, req.user.org_id);
    if (!sheet) return res.status(404).json({ error: 'Sign-up sheet not found.' });
    res.json({ sheet: await buildSheetView(sheet) });
  } catch (err) {
    console.error('[SIGNUPS] Failed to load sheet:', err);
    res.status(500).json({ error: 'Could not load that sign-up sheet.' });
  }
});

// DELETE /api/signups/sheets/:id -- remove a sheet and everything on it.
router.delete('/sheets/:id', authenticateToken, async (req, res) => {
  try {
    const sheet = await loadSheetForOrg(req.params.id, req.user.org_id);
    if (!sheet) return res.status(404).json({ error: 'Sign-up sheet not found.' });

    const [slots, entries] = await Promise.all([
      listSlotsForSheet(sheet.sheet_id),
      listActiveEntriesForSheet(sheet.sheet_id),
    ]);
    // Entries and slots first, sheet last -- never leave an orphaned entry
    // pointing at a sheet_id that no longer resolves.
    await Promise.all(entries.map((e) => setEntryStatus(e.entry_id, 'cancelled')));
    await Promise.all(slots.map((s) => deleteSlot(s.slot_id)));
    await deleteSheet(sheet.sheet_id);

    res.json({ success: true });
  } catch (err) {
    console.error('[SIGNUPS] Failed to delete sheet:', err);
    res.status(500).json({ error: 'Could not delete that sign-up sheet.' });
  }
});

// GET /api/signups/volunteer-hours -- org-wide report, most hours first.
// The "Volunteer Hours" tab on the admin dashboard; exportable client-side as CSV.
router.get('/volunteer-hours', authenticateToken, async (req, res) => {
  try {
    const report = await volunteerHoursReportForOrg(req.user.org_id);
    res.json({
      members: report.map((r) => ({
        member_id: r.member_id,
        member_name: r.member_name,
        total_hours: Math.round((r.totalMinutes / 60) * 10) / 10,
        shifts_count: r.shiftsCount,
      })),
    });
  } catch (err) {
    console.error('[SIGNUPS] Failed to build volunteer-hours report:', err);
    res.status(500).json({ error: 'Could not load the volunteer-hours report.' });
  }
});

// ── Community (devotee-facing) routes ───────────────────────────────────

// GET /api/signups/event/:eventId -- every open sheet for an event, devotee view.
router.get('/event/:eventId', authenticateCommunityToken, async (req, res) => {
  try {
    const event = await loadEventForOrg(req.params.eventId, req.communityUser.org_id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const member = await getMember(req.communityUser.member_id);
    const viewerFollowing = !!(member && member.following);

    const sheets = (await listSheetsForEvent(req.params.eventId)).filter((s) => s.status === 'open');
    const views = await Promise.all(sheets.map((s) => buildSheetView(s, req.communityUser.member_id, viewerFollowing)));

    const myEntries = await listEntriesForMember(req.communityUser.member_id);
    const { totalMinutes } = summarizeVolunteerMinutes(myEntries);

    res.json({
      sheets: views,
      display_name: (member && member.display_name) || null,
      my_volunteer_hours: Math.round((totalMinutes / 60) * 10) / 10,
      following: viewerFollowing,
    });
  } catch (err) {
    console.error('[SIGNUPS] Failed to load event sign-ups:', err);
    res.status(500).json({ error: 'Could not load sign-ups right now.' });
  }
});

// POST /api/signups/slots/:slotId/join -- sign up for a slot, or join its
// waitlist if it's already full. body: { dish } -- required, potluck slots only.
router.post('/slots/:slotId/join', authenticateCommunityToken, async (req, res) => {
  try {
    const slot = await getSlot(req.params.slotId);
    if (!slot || slot.org_id !== req.communityUser.org_id) {
      return res.status(404).json({ error: 'Sign-up slot not found.' });
    }
    const sheet = await getSheet(slot.sheet_id);
    if (!sheet || sheet.org_id !== req.communityUser.org_id || sheet.status !== 'open') {
      return res.status(404).json({ error: 'This sign-up sheet is no longer open.' });
    }

    const member = await getMember(req.communityUser.member_id);
    if (!member || !member.display_name) {
      return res.status(400).json({ error: 'Add your name first so people can see who signed up.', code: 'name_required' });
    }

    if (isLockedForViewer(sheet, !!member.following)) {
      return res.status(403).json({
        error: "This sign-up isn't open to everyone yet -- follow the temple for early access.",
        code: 'early_access_locked',
        early_access_until: earlyAccessUntil(sheet),
      });
    }

    const existing = await listActiveEntriesForSlot(slot.slot_id);
    if (existing.some((e) => e.member_id === req.communityUser.member_id)) {
      return res.status(409).json({ error: "You're already signed up for this." });
    }

    const dish = req.body && req.body.dish ? req.body.dish.toString().trim().slice(0, 140) : '';
    if (sheet.type === 'potluck' && !dish) {
      return res.status(400).json({ error: "Please say what dish you're bringing." });
    }

    const confirmedCount = existing.filter((e) => e.status === 'confirmed').length;
    const status = confirmedCount < slot.capacity ? 'confirmed' : 'waitlisted';

    const entry = {
      entry_id: `en-${crypto.randomUUID()}`,
      slot_id: slot.slot_id,
      sheet_id: sheet.sheet_id,
      org_id: req.communityUser.org_id,
      member_id: req.communityUser.member_id,
      member_name: member.display_name,
      dish: sheet.type === 'potluck' ? dish : null,
      status,
      slot_label: slot.label,
      duration_minutes: slot.duration_minutes || null,
      sheet_type: sheet.type,
      event_title: sheet.title,
      event_date: sheet.event_date,
      created_at: Date.now(),
    };
    await createEntry(entry);

    res.status(201).json({
      success: true,
      status,
      message: status === 'waitlisted'
        ? "This slot is full -- you've been added to the waitlist and will be confirmed automatically if a spot opens up."
        : undefined,
      entry: { entry_id: entry.entry_id, status: entry.status, slot_id: entry.slot_id },
    });
  } catch (err) {
    console.error('[SIGNUPS] Failed to join slot:', err);
    res.status(500).json({ error: 'Could not sign you up -- try again.' });
  }
});

// POST /api/signups/entries/:id/cancel -- cancel your own sign-up. If it
// was a confirmed spot, promotes the next waitlisted person automatically.
router.post('/entries/:id/cancel', authenticateCommunityToken, async (req, res) => {
  try {
    const entry = await getEntry(req.params.id);
    if (!entry || entry.org_id !== req.communityUser.org_id || entry.member_id !== req.communityUser.member_id) {
      return res.status(404).json({ error: 'Sign-up not found.' });
    }
    if (entry.status === 'cancelled') {
      return res.json({ success: true });
    }

    const wasConfirmed = entry.status === 'confirmed';
    await setEntryStatus(entry.entry_id, 'cancelled');
    if (wasConfirmed) {
      await promoteFromWaitlist(entry.slot_id);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[SIGNUPS] Failed to cancel entry:', err);
    res.status(500).json({ error: 'Could not cancel that sign-up -- try again.' });
  }
});

// Pure gating helpers exported alongside the router (not in place of it --
// `module.exports = router` still makes every '/api/signups/*' route work
// exactly as before) purely so they can be unit-tested directly: this is
// the exact rule the "early access for followers" feature depends on, and
// it's cheap to get subtly wrong (off-by-one on the hour math, following
// vs. not-following flipped, etc.) in a way that only shows up as a live
// devotee either locked out when they shouldn't be or let in early when
// they shouldn't be.
module.exports = router;
module.exports.earlyAccessUntil = earlyAccessUntil;
module.exports.isLockedForViewer = isLockedForViewer;
