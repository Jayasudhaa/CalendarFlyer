/**
 * DynamoDB Schema for CalendarFly Multi-Tenant
 * Run this to create the organizations table
 */

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config();

const dynamodb = new DynamoDBClient({ endpoint: process.env.AWS_ENDPOINT_URL_DYNAMODB, region: process.env.AWS_REGION || 'us-east-2' });

// Organizations Table
const organizationsTableParams = {
  TableName: 'calendarfly_organizations',
  KeySchema: [
    { AttributeName: 'org_id', KeyType: 'HASH' }  // Partition key
  ],
  AttributeDefinitions: [
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'subdomain', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'subdomain-index',
      KeySchema: [
        { AttributeName: 'subdomain', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Users Table (multi-tenant)
const usersTableParams = {
  TableName: 'calendarfly_users',
  KeySchema: [
    { AttributeName: 'user_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'user_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'email', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'email-index',
      KeySchema: [
        { AttributeName: 'email', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Events Table (multi-tenant) - Enhanced version of temple_rsvp
const eventsTableParams = {
  TableName: 'calendarfly_events',
  KeySchema: [
    { AttributeName: 'event_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'event_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    // Both added for radar-index (Community Radar: one discoverable feed
    // across every org, instead of a separate submission pipeline -- see
    // server/routes/radar.js). discoverability partitions the index down to
    // just the events actually opted in ('radar'), date sorts that partition
    // so a query can ask for "everything from today forward" directly,
    // without pulling every radar-eligible event ever created.
    { AttributeName: 'discoverability', AttributeType: 'S' },
    { AttributeName: 'date', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'radar-index',
      KeySchema: [
        { AttributeName: 'discoverability', KeyType: 'HASH' },
        { AttributeName: 'date', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Reservations Table — used only to make subdomain/email uniqueness checks
// atomic at signup (routes/auth.js). A plain "query for existing, then put
// if not found" has a race: two signups for the same subdomain can both
// pass the check before either has written, and both succeed — leaving two
// orgs sharing one subdomain, with tenant lookups arbitrarily picking one.
// A conditional put (attribute_not_exists) against this table's single
// item per subdomain/email closes that gap, since DynamoDB guarantees only
// one such put can ever succeed for the same key.
const reservationsTableParams = {
  TableName: 'calendarfly_reservations',
  KeySchema: [
    { AttributeName: 'reservation_key', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'reservation_key', AttributeType: 'S' }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Broadcasts Table — Send History + Scheduling (server/broadcasts.js).
// One item per broadcast "batch": an immediate send from the Broadcast page
// covers however many platforms were checked, and a scheduled send is the
// same shape, just fired later by server/scheduler.js instead of right
// away. `results` holds one entry per platform once it's actually been
// attempted (success/failure, message/post id or error) — absent entirely
// for a platform that hasn't sent yet, e.g. a still-pending scheduled item.
//
// Two GSIs, each serving one very different access pattern:
//   org-index    — "show this org's send history", newest first
//                  (org_id hash, created_at range; Query + ScanIndexForward:false)
//   status-index — "which scheduled broadcasts are due right now", used by
//                  the poller every ~60s (status hash, scheduled_for range).
//                  Sparse by nature: an immediate-send item has no
//                  scheduled_for, so it's simply never projected into this
//                  index — no filtering needed to keep those out. Once a
//                  scheduled item fires and its status flips away from
//                  'scheduled', it drops out of this index's 'scheduled'
//                  partition on its own, so the poller can never see (and
//                  re-fire) an item it already processed.
const broadcastsTableParams = {
  TableName: 'calendarfly_broadcasts',
  KeySchema: [
    { AttributeName: 'broadcast_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'broadcast_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'created_at', AttributeType: 'N' },
    { AttributeName: 'status', AttributeType: 'S' },
    { AttributeName: 'scheduled_for', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'status-index',
      KeySchema: [
        { AttributeName: 'status', KeyType: 'HASH' },
        { AttributeName: 'scheduled_for', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Community Members Table — devotees verified by phone OTP (server/
// community-auth.js), structurally separate from calendarfly_users (temple
// staff/admin — see utils/communityJwtSecret.js for why). One row per
// (org, phone) — org-phone-index is how verify-code finds "have we seen
// this phone number for this temple before" without a table scan.
const communityMembersTableParams = {
  TableName: 'calendarfly_community_members',
  KeySchema: [
    { AttributeName: 'member_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'member_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'phone', AttributeType: 'S' },
    { AttributeName: 'email', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'org-phone-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'phone', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      // Devotee verification switched from phone/SMS to email (see
      // community-auth.js) -- org-phone-index is kept as-is above so any
      // already-verified phone-based member rows stay queryable, but every
      // new verification goes through this index instead.
      IndexName: 'org-email-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'email', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      // Hash-only (no range) -- lets identity-auth.js's
      // listFollowedOrgsForEmail(email) find every org-scoped member row
      // for one email across ALL orgs in one Query, instead of the scan
      // that would otherwise take. This is the reverse lookup direction
      // from org-email-index above (which answers "does THIS org know
      // this email"); this one answers "which orgs does this email know".
      IndexName: 'email-index',
      KeySchema: [
        { AttributeName: 'email', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Identities Table — the cross-org "Community Passport" identity (server/
// identity-auth.js), deliberately separate from calendarfly_community_members
// (which stays a per-org row: one member_id per (org, email), used for
// following/RSVP-adjacent features scoped to a single org's page). One
// identity per email, globally -- holds the stuff that's inherently
// cross-org: display name shown on the Radar passport, and interests used
// to personalize its feed. "Which orgs does this identity follow" is NOT
// duplicated here -- it's derived on read via community_members'
// email-index above, so a follow made from an org's own page and a follow
// made from the Radar passport are the exact same underlying row.
const identitiesTableParams = {
  TableName: 'calendarfly_identities',
  KeySchema: [
    { AttributeName: 'identity_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'identity_id', AttributeType: 'S' },
    { AttributeName: 'email', AttributeType: 'S' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'email-index',
      KeySchema: [
        { AttributeName: 'email', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// OTP Codes Table — one short-lived row per (org, phone) mid-verification.
// A new request overwrites the previous code for that phone (only one
// active code at a time is meaningful anyway). `expires_at` is checked in
// application code (community-auth.js) so correctness never depends on
// DynamoDB's TTL sweep actually having run yet — TTL here is just
// eventual cleanup of rows nobody will read again, not what makes an
// expired code stop working.
const otpCodesTableParams = {
  TableName: 'calendarfly_otp_codes',
  KeySchema: [
    { AttributeName: 'otp_key', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'otp_key', AttributeType: 'S' }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Event Photos Table — the live community album (server/routes/photos.js).
// Two GSIs for two different readers: event-index is the album itself
// ("this event's photos, newest first" — what the community page polls),
// org-index is the admin moderation queue ("this org's pending_review
// photos" — queried with a FilterExpression on status, same scale
// tradeoff broadcasts.js's org-index makes for its own history list).
const eventPhotosTableParams = {
  TableName: 'calendarfly_event_photos',
  KeySchema: [
    { AttributeName: 'photo_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'photo_id', AttributeType: 'S' },
    { AttributeName: 'event_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'created_at', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'event-index',
      KeySchema: [
        { AttributeName: 'event_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Sign-Up Sheets — shared "Sheet -> Slots -> Entries" system powering both
// Volunteer shift sign-ups and Potluck dish sign-ups (server/signups.js,
// server/routes/signups.js). One admin-created Sheet (e.g. "Ganesh
// Chaturthi -- Volunteers") holds several Slots (a shift, or a potluck
// dish category); devotees join a Slot, creating an Entry. Community
// identity is the same phone-verified calendarfly_community_members row
// used by photo sharing -- no separate signup-specific auth.
const signupSheetsTableParams = {
  TableName: 'calendarfly_signup_sheets',
  KeySchema: [
    { AttributeName: 'sheet_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'sheet_id', AttributeType: 'S' },
    { AttributeName: 'event_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'created_at', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'event-index',
      KeySchema: [
        { AttributeName: 'event_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Slots within a Sheet -- a shift (Volunteer sheets) or a dish category
// (Potluck sheets). sheet-index lists a sheet's slots in creation order
// (sort_order range key).
const signupSlotsTableParams = {
  TableName: 'calendarfly_signup_slots',
  KeySchema: [
    { AttributeName: 'slot_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'slot_id', AttributeType: 'S' },
    { AttributeName: 'sheet_id', AttributeType: 'S' },
    { AttributeName: 'sort_order', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'sheet-index',
      KeySchema: [
        { AttributeName: 'sheet_id', KeyType: 'HASH' },
        { AttributeName: 'sort_order', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Entries -- one row per devotee sign-up against a Slot. status is
// 'confirmed' | 'waitlisted' | 'cancelled' (see server/signups.js for the
// capacity/waitlist-promotion logic). Denormalizes slot_label,
// duration_minutes, sheet_type, event_title and event_date from the
// Sheet/Slot at signup time so the admin dashboard, the volunteer-hours
// report, and a devotee's own "my sign-ups" view all read straight off
// entries without joining back to sheets/slots on every request.
// Four GSIs for four different readers, same shape as event_photos'
// event-index/org-index split above:
//   slot-index   -- capacity checks + waitlist promotion for one slot
//   sheet-index  -- the admin sheet-detail view (every entry on one sheet)
//   member-index -- one devotee's own sign-ups + volunteer-hours total
//   org-index    -- org-wide volunteer-hours leaderboard/report
const signupEntriesTableParams = {
  TableName: 'calendarfly_signup_entries',
  KeySchema: [
    { AttributeName: 'entry_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'entry_id', AttributeType: 'S' },
    { AttributeName: 'slot_id', AttributeType: 'S' },
    { AttributeName: 'sheet_id', AttributeType: 'S' },
    { AttributeName: 'member_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'created_at', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'slot-index',
      KeySchema: [
        { AttributeName: 'slot_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'sheet-index',
      KeySchema: [
        { AttributeName: 'sheet_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'member-index',
      KeySchema: [
        { AttributeName: 'member_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// "Connect" -> Documents library (server/routes/documents.js): a Google
// Form created from the app, a linked Drive file/Doc/Sheet/Form, or an uploaded
// .xlsx/.docx, one row per document with its extracted text and (when
// VOYAGE_API_KEY is set) a Voyage embedding for semantic search. org-index
// is the admin document-library listing, same shape as the Sign-Up Sheets
// tables above.
const documentsTableParams = {
  TableName: 'calendarfly_documents',
  KeySchema: [
    { AttributeName: 'doc_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'doc_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'created_at', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Livestreams — server/routes/livestreams.js. One row per scheduled or
// live event stream (native CalendarFly Live, or an external YouTube/
// Zoom/Vimeo link). event-index answers "does this event have a stream,
// and what's its schedule"; org-index answers the Media Overview page's
// "live now" / "upcoming" panels ("this org's streams, soonest first",
// filtered by status the same way event_photos' org-index filters by
// status for the moderation queue).
const livestreamsTableParams = {
  TableName: 'calendarfly_livestreams',
  KeySchema: [
    { AttributeName: 'stream_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'stream_id', AttributeType: 'S' },
    { AttributeName: 'event_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'start_time', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'event-index',
      KeySchema: [
        { AttributeName: 'event_id', KeyType: 'HASH' },
        { AttributeName: 'start_time', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'start_time', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Photo Albums — server/routes/photoAlbums.js. The admin-facing metadata
// wrapper around an event's photos (name, cover, visibility, upload/
// download/approval settings) that calendarfly_event_photos itself never
// carried -- individual photo rows still live in that table and are found
// by event_id (and, once assigned, album_id); this table is "one album's
// settings," queried the same two ways as livestreams above.
const photoAlbumsTableParams = {
  TableName: 'calendarfly_photo_albums',
  KeySchema: [
    { AttributeName: 'album_id', KeyType: 'HASH' }
  ],
  AttributeDefinitions: [
    { AttributeName: 'album_id', AttributeType: 'S' },
    { AttributeName: 'event_id', AttributeType: 'S' },
    { AttributeName: 'org_id', AttributeType: 'S' },
    { AttributeName: 'created_at', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'event-index',
      KeySchema: [
        { AttributeName: 'event_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    },
    {
      IndexName: 'org-index',
      KeySchema: [
        { AttributeName: 'org_id', KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

// Creates one table, tolerating "already exists" so this script is safe to
// re-run — important now that a new table (reservations) can be added after
// the others were already provisioned; a single try/catch around the whole
// batch would bail out on the FIRST already-existing table and never reach
// the new one.
async function createTableIfMissing(label, params) {
  try {
    console.log(`Creating ${params.TableName} table...`);
    await dynamodb.send(new CreateTableCommand(params));
    console.log(`✓ ${label} table created`);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⚠ ${params.TableName} already exists — skipping`);
    } else {
      console.error(`Error creating ${params.TableName}:`, error);
      throw error;
    }
  }
}

// Create tables
async function createTables() {
  try {
    await createTableIfMissing('Organizations', organizationsTableParams);
    await createTableIfMissing('Users', usersTableParams);
    await createTableIfMissing('Events', eventsTableParams);
    await createTableIfMissing('Reservations', reservationsTableParams);
    await createTableIfMissing('Broadcasts', broadcastsTableParams);
    await createTableIfMissing('Community Members', communityMembersTableParams);
    await createTableIfMissing('Identities', identitiesTableParams);
    await createTableIfMissing('OTP Codes', otpCodesTableParams);
    await createTableIfMissing('Event Photos', eventPhotosTableParams);
    await createTableIfMissing('Sign-Up Sheets', signupSheetsTableParams);
    await createTableIfMissing('Sign-Up Slots', signupSlotsTableParams);
    await createTableIfMissing('Sign-Up Entries', signupEntriesTableParams);
    await createTableIfMissing('Documents', documentsTableParams);
    await createTableIfMissing('Livestreams', livestreamsTableParams);
    await createTableIfMissing('Photo Albums', photoAlbumsTableParams);

    console.log('\nWaiting for tables to be active...');

    // Wait for tables to be active
    await waitForTable('calendarfly_organizations');
    await waitForTable('calendarfly_users');
    await waitForTable('calendarfly_events');
    await waitForTable('calendarfly_reservations');
    await waitForTable('calendarfly_broadcasts');
    await waitForTable('calendarfly_community_members');
    await waitForTable('calendarfly_identities');
    await waitForTable('calendarfly_otp_codes');
    await waitForTable('calendarfly_event_photos');
    await waitForTable('calendarfly_signup_sheets');
    await waitForTable('calendarfly_signup_slots');
    await waitForTable('calendarfly_signup_entries');
    await waitForTable('calendarfly_documents');
    await waitForTable('calendarfly_livestreams');
    await waitForTable('calendarfly_photo_albums');

    console.log('✓ All tables are now active!');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

async function waitForTable(tableName) {
  let tries = 0;
  const maxTries = 30;
  while (tries < maxTries) {
    try {
      const result = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
      if (result.Table.TableStatus === 'ACTIVE') {
        console.log(`✓ ${tableName} is active`);
        return;
      }
    } catch (e) {
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    tries++;
  }
  throw new Error(`Timeout waiting for ${tableName}`);
}
// Run if called directly
if (require.main === module) {
  createTables();
}

module.exports = { createTables };
