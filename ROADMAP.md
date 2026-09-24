# CalendarFly Roadmap

A feature analysis benchmarked against WellnessLiving (vertical SaaS pattern), general
church management software, and Hindu-temple-specific competitors (Temple Hub, Grasp).
Full write-up with rationale: see the published artifact from this planning session.

## Where we stand today

- Multi-org calendar — per-org subdomain, public event page, admin dashboard
- Panchang / tithi / nakshatra fields — real astrological calendar data
- Announcements & no-login RSVP
- AI flyer generation — image gen, stock photos, background removal, translate
- Broadcast — WhatsApp/Facebook/Instagram/email sends for event flyers
- Follow / notify — phone-verified opt-in, no public feed
- Sign-up sheets — volunteer / potluck-style coordination
- Photo sharing — devotee-facing gallery uploads (admin-curated, not live)
- Org billing — Stripe customer + plan tiers (the org's own CalendarFly subscription)
- Chatbot sync — event data synced to an AI assistant
- SMS explored, dropped for now — plain SMS has no "group" concept (every send is billed and delivered
  per-recipient); WhatsApp Groups already do what we actually wanted, for free, in one post.

## Now building — real-time & creative

Four features are active right now, and all four share the same bar: not just
functional, but **real-time** (updates appear live, nobody has to refresh) and
**genuinely creative** in how they're presented — not bare utilitarian forms.

- **Donations** — one-time & recurring giving, campaign funds, tax receipts
- **Membership** — tiers, renewal, a digital member card
- **Live photo sharing (public mode)** — a real-time photo feed on the *public*
  calendar page during festivals/events, not just the existing admin-curated
  gallery — photos should appear as they're uploaded, like a living wall
- **Messages** — one composer, four channels: WhatsApp, Facebook, Instagram,
  Email (see "Must-have #4" below for the constraints on each — SMS dropped, see note above)

## Events strategy — real event collection (planned, not started)

Google's own "events near me" isn't an API (it's a Search feature that crawls
schema.org markup on organizers' own sites, not something third parties can
query), Eventbrite's public search-by-location API is deprecated, and Meetup
now gates its API behind a manual approval request with no set timeline. So
there's no way to pull real, arbitrary community events from a third party
the way Google Places lets us backfill *organizations* (shipped -- see
utils/googlePlaces.js and "Organizations near you" on the Explore page).
The agreed approach instead: each organization's own website is the event
source, and CalendarFly does the parsing.

**Setup (manual, one-time per org):** Admin -> Add Organization (name,
website, city/ZIP, org type) -> Add Event Source (paste an events/calendar
URL) -> Test Source. CalendarFly checks the page is reachable, detects
whether events are actually there, and identifies which parser fits --
ICS, JSON-LD (schema.org Event markup), RSS, or a configured HTML parser
for sites with none of the above. A preview shows what it found (e.g.
"Found 8 events -- Navaratri Celebration, Sep 28, 6:30pm, Dublin, CA")
before the admin activates it. Nothing is entered by hand -- if the test
finds 12 events, activating the source is what brings all 12 in.

**Automatic, after activation:** every 24 hours, re-check the source page.
Unchanged -> stop (cheap, no wasted parsing). Changed -> parse out title /
date+time / venue / address-or-ZIP / registration URL / source URL,
validate (future date, has a title, has a location, valid date/time), then
dedupe against the DB by organization + title + date + venue. A genuinely
new event goes to Pending Review; a match that changed (time moved, venue
changed) goes to Review as an update; an unchanged match is ignored.

**Admin review queue:** each pending event shows the parsed details, a link
back to the source page, and Reject / Edit / Approve. Approving creates the
canonical CalendarFly event, geocoded (address/ZIP -> lat/lng) the same way
org addresses already are (utils/geo.js), making it immediately eligible
for "Happening near you" alongside real orgs' own events -- no separate
code path needed there, it's just another radar-visible event once
approved.

**Admin surface stays small:** a top-level "Event Data" area with four
counts (Organizations / Event Sources / Review Queue / Source Errors), and
an Organizations list (org, event count, source type, active/error status)
as the drill-down. Source Errors matters -- a source that starts 404ing or
changes its page structure needs to surface, not fail silently.

**Exit path, once an org actually signs up:** scraping an org's site is a
bootstrap for "Happening near you" before real orgs join, not a permanent
shadow copy of their calendar. Once an organization claims its CalendarFly
page (ownership verified), it's asked "how do you publish events?" --
connect a calendar (Google Calendar/ICS feed), keep syncing from their
website (the same scraper, now attached to the claimed org), or add events
directly in CalendarFly.

**Status: agreed on approach, not started.** A multi-day build (scheduler,
four parser types, dedup logic, a review-queue UI, and the claim flow) --
distinct from and in addition to the Google Places organization backfill,
which only ever covered orgs, never events.

## Must-have

1. **Donations & online giving** — one-time and recurring, campaign-specific funds,
   auto-generated tax receipts. Missing entirely today; every competitor treats this
   as core. (Effort: high — revenue-critical)
2. **Real devotee directory** — "Follow" is a notification opt-in, not a profile.
   Donations, bookings, and membership all need a persistent record to attach to.
   (Effort: medium — foundation for #1, #3, #7)
3. **Seva/puja booking with payment** — book and pay for a specific service tied to
   a date/deity, not a generic RSVP. Most-requested devotee feature. (Effort: high)
4. **Messages — multi-channel broadcast (WhatsApp, Facebook, Instagram, Email)**
   — one announcement composer that fans out to every channel devotees actually use.
   Instagram has no text-only post (image required, so it's only available when a
   photo is attached); WhatsApp/Facebook/Email post once to the org's connected
   group/page/list. SMS was considered and dropped for now — plain SMS has no
   "group" concept, so every send is billed and delivered one-by-one per recipient,
   unlike everything else here; WhatsApp already covers the "text" use case for free.
   Revisit only if a real need for reaching non-WhatsApp users by text shows up.
   (Effort: medium)
5. **Annual giving statements** — a reporting layer on top of #1, needed for donor
   tax filing. (Effort: low, once #1 exists)
6. **Multi-tenant correctness** — every org's public page must reliably show that
   org's own data, no stale sessions or silent fallbacks. Nothing above matters if
   this is shaky. (Effort: low now — keep it that way)

## Nice-to-have

7. Membership tiers & digital QR card — builds on #2 and #1.
8. Hall / facility booking with conflict detection — real ancillary revenue for
   temples that rent space, only relevant to that subset.
9. Live streaming integration — cheap to add, high emotional value for diaspora
   families watching festivals remotely.
10. Priest / staff duty roster — useful once a temple has more than one priest.
11. Wrapped mobile app (Capacitor-style) — most of the need is already covered by
    a well-tuned responsive web app.
12. Volunteer hours & attendance tracking — thin layer on existing sign-up sheets.

## Skip for now

- POS / prasadam & lamp inventory / kitchen planning — full-service-temple scale.
- Property, rental & Registrar-of-Marriage workflows — large India-based trusts.
- In-house payroll / HR — solved better by existing payroll software.
- Kiosk digital signage — nice touch, not a reason anyone chooses the platform.

## Suggested build order

1. **Money in, reliably** — donations & receipts, devotee directory, multi-channel
   messages.
2. **The core transaction** — seva/puja booking with payment, annual giving
   statements, live photo sharing.
3. **Depth for growing temples** — membership tiers, hall booking, live streaming.
4. **Opportunistic** — priest scheduling, wrapped mobile app, kiosk feedback —
   build when a specific paying organization asks for it.

---
Sources: Temple Hub (templehub.org), Temple Management Software / Grasp
(templemanagementsoftware.com/features), WellnessLiving on G2, church management
software baseline via CharityCharge.
