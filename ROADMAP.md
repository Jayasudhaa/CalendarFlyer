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
