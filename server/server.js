/**
 * server/server.js
 * Express backend for Temple Calendar
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const { tenantMiddleware } = require('./middleware/tenant');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Keep only required frontend domains
const allowedOrigins = [
  'https://calendarflyapp.com',
  'https://www.calendarflyapp.com',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

// ✅ CENTRAL CORS CONFIG (used for BOTH normal + preflight)
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);

    if (origin.endsWith('.calendarflyapp.com')) return cb(null, true);

    console.warn(`[CORS] Blocked: ${origin}`);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
  credentials: true,
};

// ✅ FIX: apply SAME config to OPTIONS (preflight)
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '25mb' }));

app.use(session({
  secret: process.env.ADMIN_SECRET || 'temple-calendar-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

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

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username === 'admin' && password === 'temple2026') {
    req.session.isAuthenticated = true;
    req.session.user = { username, displayName: 'Temple Admin' };
    return res.json({ success: true, user: req.session.user });
  }

  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/status', (req, res) => {
  if (req.session?.isAuthenticated) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});

// ── ROUTES ───────────────────────────────────────────────
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api', require('./routes/generate-image'));
app.use('/api', require('./routes/rsvp'));
app.use('/api', require('./routes/pixabay'));
app.use('/api', require('./routes/imageLibrary'));
app.use('/api', require('./routes/image-proxy'));
app.use('/api/flyers', require('./routes/flyerRoutes'));
app.use('/api/broadcast', require('./routes/broadcast'));
app.use('/api/remove-bg', require('./routes/remove-bg'));

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
  app.get('*', (req, res) =>
    res.sendFile(path.join(buildPath, 'index.html'))
  );
}

// ── START ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Server running on ${PORT}`);
});