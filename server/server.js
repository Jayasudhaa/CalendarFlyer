/**
 * server/server.js
 * Express backend for Temple Calendar
 * Handles secure API calls (OpenAI DALL-E image generation)
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');
const { tenantMiddleware } = require('./middleware/tenant');

const app  = express();
const PORT = process.env.PORT || 5000;


const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://temple-calendar-app.s3-website-us-east-1.amazonaws.com',
  'https://svtempleco.org',
  'https://www.svtempleco.org',
  'https://jyuxa8xvk6.us-east-2.awsapprunner.com',
  'https://calendarflyapp.com',
  'https://www.calendarflyapp.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (origin && origin.includes('.calendarflyapp.com')) return cb(null, true);
    console.warn(`[CORS] Blocked: ${origin}`);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-admin-secret'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json({ limit: '25mb' }));

app.use(session({
  secret: process.env.ADMIN_SECRET || 'temple-calendar-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax'
  }
}));

// ── MULTI-TENANT MIDDLEWARE ──────────────────────────────────────────────────
app.use(tenantMiddleware);
app.use((req, res, next) => {
  if (req.org) {
    console.log(`[TENANT] ${req.method} ${req.path} → ${req.org.name}`);
  }
  next();
});

// ── Auth Routes ───────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const validUsername = 'admin';
  const validPassword = 'temple2026';
  if (username === validUsername && password === validPassword) {
    req.session.isAuthenticated = true;
    req.session.user = { username, displayName: 'Temple Admin' };
    return res.json({ success: true, user: req.session.user });
  }
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[AUTH] Logout error:', err);
    res.json({ success: true });
  });
});
app.get('/api/admin/status', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});
// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api', require('./routes/generate-image'));
app.use('/api', require('./routes/rsvp')); 
app.use('/api', require('./routes/pixabay'));         // GET /api/pixabay-search
app.use('/api', require('./routes/imageLibrary'));
app.use('/api', require('./routes/image-proxy'));      // ← drag/drop fix
app.use('/api/flyers', require('./routes/flyerRoutes'));
app.use('/api/broadcast',require('./routes/broadcast'));
app.use('/api/remove-bg', require('./routes/remove-bg'));

// Health check
app.get('/api/health', (req, res) => res.json({ 
  status: 'ok', 
  timestamp: new Date().toISOString(),
  org: req.org ? req.org.name : 'none'
}));

// ── Serve React build in production (AWS) ─────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'dist-frontend');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ CalendarFly Server on http://localhost:${PORT}`);
  console.log(`✓ Multi-tenant: ENABLED`);
  console.log(`✓ JWT Auth: ENABLED`);
  console.log(`✓ OpenAI:   ${process.env.OPENAI_API_KEY  ? 'loaded' : '⚠ NOT SET'}`);
  console.log(`✓ S3:       ${process.env.S3_BUCKET_NAME       || '⚠ NOT SET'}`);
  console.log(`✓ WhatsApp:     ${process.env.WHATSAPP_TOKEN     ? 'loaded' : '⚠ NOT SET'}`);
});
