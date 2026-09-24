/**
 * server/server.js
 * Express backend for Temple Calendar
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { tenantMiddleware } = require('./middleware/tenant');
const { SESSION_SECRET } = require('./utils/sessionSecret');

const app = express();
// This app runs behind AWS App Runner's own reverse proxy in production —
// without this, req.ip resolves to the proxy's internal address for every
// request instead of the real visitor IP, which silently breaks any
// IP-keyed rate limiter (e.g. routes/auth.js's guestSandboxLimiter, which
// has no per-user key of its own) into one shared limit across all
// visitors combined, rather than one limit per visitor. Value of 1 trusts
// exactly one hop (App Runner's own edge), which matches this app's actual
// network topology.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

app.get('/connect-social.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'connect-social.html'));
});


// Global safety net -- an error anywhere in the app must never be allowed
// to take down the whole server for every user in flight. Confirmed root
// cause of a real production incident: a Stripe webhook arrived while
// STRIPE_SECRET_KEY wasn't set, threw inside routes/billing.js's
// handleStripeWebhook (which had no try/catch around that particular
// call), and the resulting unhandled rejection killed the entire Node
// process -- ~90 seconds of downtime for every visitor, not just billing,
// until App Runner restarted it. That specific call is now caught at the
// source (see billing.js), but this backstop exists so any OTHER spot
// that's missing a try/catch logs and drops just that one request instead
// of crashing everyone else's. Fix the specific handler when one shows up
// here -- this is a safety net, not a substitute for that.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL-CAUGHT] Unhandled promise rejection (server kept running):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL-CAUGHT] Uncaught exception (server kept running):', err);
});

// Baseline security headers (X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, etc.) — there were none before this. CSP and
// Cross-Origin-Resource-Policy are turned off explicitly rather than left
// at helmet's strict defaults: this same server serves the built React
// frontend in production (see the PRODUCTION BUILD block below), which
// loads Google Fonts, S3-hosted images/flyers, and proxies external
// images through /api/image-proxy with explicit permissive CORS headers —
// helmet's default CSP would likely block some of that, and getting a
// correct CSP allowlist for every asset source this app uses is a
// separate, more careful pass rather than something to guess at here.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));

// ✅ Keep only required frontend domains
const allowedOrigins = [
  'https://calendarflyapp.com',
  'https://www.calendarflyapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  // Static ngrok tunnel address used for local Facebook/Instagram OAuth
  // testing (Instagram/Facebook login dialogs need an https:// redirect,
  // which plain localhost can't provide) -- see connect-social.html testing.
  'https://edie-chronological-lovie.ngrok-free.dev',
  process.env.FRONTEND_URL,
].filter(Boolean);

// ✅ CENTRAL CORS CONFIG (used for BOTH normal + preflight)
const isProdEnv = process.env.NODE_ENV === 'production';
const localhostOriginPattern = /^http:\/\/localhost:\d+$/;

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);

    if (origin.endsWith('.calendarflyapp.com')) return cb(null, true);

    // Vite picks the next free port (5174, 5175, ...) whenever 5173 is
    // already taken, so a hardcoded single dev port keeps breaking local
    // login with a CORS error every time that happens. Accept any
    // localhost port here — but ONLY outside production — so this never
    // widens what the deployed API (which runs with NODE_ENV=production)
    // accepts from an untrusted origin.
    if (!isProdEnv && localhostOriginPattern.test(origin)) return cb(null, true);

    console.warn(`[CORS] Blocked: ${origin}`);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
  credentials: true,
};

// ✅ FIX: apply SAME config to OPTIONS (preflight)
// Scoped to /api only -- this middleware used to run on EVERY request,
// including plain page loads/redirects/form-posts like the Facebook/
// Instagram OAuth flow (routes/facebookAuth.js, routes/instagramAuth.js)
// and connect-social.html. Those are real browser navigations, not
// cross-origin fetch()/XHR calls, so CORS enforcement doesn't apply to them
// at all -- but the strict origin-checking function above throws on any
// unrecognized Origin (including the literal string "null", which browsers
// sometimes send for a top-level form POST after an OAuth redirect chain),
// and that error was surfacing as a raw "CORS blocked: null" JSON response
// on the Facebook "choose a Page" step. CORS only needs to guard the actual
// API surface the frontend calls with fetch/XHR, so it's scoped down here.
app.use('/api', cors(corsOptions));
app.options('/api/*', cors(corsOptions));

// Stripe webhook — MUST be mounted with the raw (unparsed) body, and MUST
// come before the global express.json() below. Stripe's signature check
// (see handleStripeWebhook in routes/billing.js) hashes the exact raw
// bytes of the request; once express.json() has parsed and re-serialized
// the body, the signature no longer matches and every webhook call fails
// verification.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), require('./routes/billing').handleStripeWebhook);

app.use(express.json({ limit: '25mb' }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// "Continue with Facebook" / "Continue with Instagram" -- Settings' real
// connect flow (temple-calendar/src/components/SocialConnectButtons.jsx).
// No longer session-dependent: the Settings page calls GET /auth/*/start
// with its normal JWT to get a login URL whose `state` is itself a signed
// JWT carrying the organization id, so these routes work regardless of
// where they're mounted relative to app.use(session(...)) -- left here
// rather than moved, since there's no reason to disturb it now.
app.use(require('./routes/facebookAuth'));
app.use(require('./routes/instagramAuth'));

// ── MULTI-TENANT ─────────────────────────────────────────
app.use(tenantMiddleware);
app.use((req, res, next) => {
  if (req.org) {
    console.log(`[TENANT] ${req.method} ${req.path} → ${req.org.name}`);
  }
  next();
});

// ── AUTH ─────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Site-wide super-admin login/logout/status — see routes/adminAuth.js
// (extracted out of this file so it follows the same "one feature, one
// routes file" pattern as everything else mounted below).
app.use('/api/admin', require('./routes/adminAuth'));

// ── ROUTES ───────────────────────────────────────────────
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/organizations/instagram', require('./routes/instagramEvents'));
app.use('/api/organizations/analytics', require('./routes/analyticsInsights'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/events', require('./routes/events'));
app.use('/api/radar', require('./routes/radar'));
app.use('/api/discover', require('./routes/discover'));
app.use('/api/identity', require('./routes/identity'));
app.use('/api', require('./routes/generate-image'));
app.use('/api', require('./routes/rsvp'));
app.use('/api', require('./routes/pixabay'));
app.use('/api', require('./routes/translate'));
app.use('/api', require('./routes/imageLibrary'));
app.use('/api', require('./routes/image-proxy'));
app.use('/api/flyers', require('./routes/flyerRoutes'));
app.use('/api/broadcast', require('./routes/broadcast'));
// "Connect with Facebook / Instagram / WhatsApp" OAuth flows for
// Organization Settings — see routes/social-connect.js's file header.
app.use('/api/social', require('./routes/social-connect'));
// Live community photo album for events: phone-OTP devotee identity
// (public, unauthenticated on purpose — see routes/community.js's file
// header) and the photo upload/moderation/album routes that ride on top
// of it (community-member-authenticated, plus a couple of admin-only
// moderation routes — see routes/photos.js's file header).
app.use('/api/community', require('./routes/community'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/photo-albums', require('./routes/photoAlbums'));
app.use('/api/livestreams', require('./routes/livestreams'));
app.use('/api/public-media', require('./routes/publicMedia'));
app.use('/api/signups', require('./routes/signups'));
// "Connect" -> Documents library: create/link a Google Form, link a Drive
// file, upload an Excel/Word doc, and AI semantic search + summaries over
// them plus this org's own events/sign-ups — see routes/documents.js's
// file header for exactly what's real vs. what needs setup first.
app.use('/api/documents', require('./routes/documents'));
app.use('/api/remove-bg', require('./routes/remove-bg'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/image-feedback', require('./routes/image-feedback'));
// Dedicated top-level mount (not nested under /api/organizations) — the
// public frontend calls the bare path '/api/announcements'.
app.use('/api/announcements', require('./routes/announcements'));
// Conversational chatbot (admin assistant + public temple/org bot).
app.use('/api/chat', require('./routes/chat'));
// WhatsApp-Lambda event sync routes (DynamoDB + S3) — split out of chat.js,
// now scoped per-org via requireAuth(); see server/routes/eventSync.js header.
app.use('/api/chat', require('./routes/eventSync'));


// ── HEALTH ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    org: req.org ? req.org.name : 'none'
  });
});

// ── PRODUCTION BUILD ─────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'dist-frontend');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    // An organization's own site (real subdomain or custom domain --
    // req.orgFromHost, set by tenantMiddleware above) should never show
    // the generic PremiumLanding marketing homepage at its bare root --
    // that page is the bare/marketing-domain pitch ("For people" /
    // "For organizations" / pricing), not this org's calendar. Every
    // hostname serves the same SPA bundle here, so without this the org
    // subdomain's own "/" fell through to client-side routing, which has
    // no hostname awareness of its own and always matches "/" to
    // PremiumLanding. Bare '/calendar' already resolves this same org via
    // the same Host header (see ModeSelection.jsx's comment on this).
    if (req.orgFromHost && req.path === '/') {
      return res.redirect('/calendar');
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// ── GLOBAL ERROR HANDLER ─────────────────────────────────
// Must be mounted last (after every route/middleware above) — Express only
// routes to a 4-arg middleware like this one for errors passed to next(err)
// or thrown synchronously inside a route; it does NOT retroactively catch
// an error a route's own try/catch already responded to (most routes do,
// via utils/errors.js's sendServerError — see that file's header). This is
// the backstop for whatever isn't wrapped in a try/catch: logs the full
// error server-side always, and only echoes err.message to the client
// outside production, same gating as sendServerError.
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  if (res.headersSent) return next(err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || err.statusCode || 500).json({
    error: isProd ? 'Something went wrong' : ((err && err.message) || 'Something went wrong'),
  });
});

// ── START ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Server running on ${PORT}`);
  // Broadcast page "Schedule for later" — see scheduler.js's file header
  // for why this is an in-process poll rather than a real queue. Started
  // only once the server is actually listening, not at module load, so a
  // crash during startup doesn't leave an orphaned interval behind.
  require('./scheduler').start();
});