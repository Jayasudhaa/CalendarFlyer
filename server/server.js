/**
 * server/server.js
 * Express backend for Temple Calendar
 * Handles secure API calls (OpenAI DALL-E image generation)
 */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

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
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    console.warn(`[CORS] Blocked: ${origin}`);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-admin-secret'],
  credentials: true,
}));
app.options('*', cors());
app.use(express.json({ limit: '25mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', require('./routes/generate-image'));
app.use('/api', require('./routes/rsvp')); 
app.use('/api', require('./routes/pixabay'));         // GET /api/pixabay-search
app.use('/api', require('./routes/imageLibrary'));
app.use('/api', require('./routes/image-proxy'));      // ← drag/drop fix
app.use('/api/flyers', require('./routes/flyerRoutes'));
app.use('/api/broadcast',require('./routes/broadcast'));
app.use('/api/remove-bg', require('./routes/remove-bg'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Serve React build in production (AWS) ─────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'temple-calendar/dist');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Server on http://localhost:${PORT}`);
  console.log(`✓ OpenAI:   ${process.env.OPENAI_API_KEY  ? 'loaded' : '⚠ NOT SET'}`);
  console.log(`✓ Pixabay:  ${process.env.PIXABAY_API_KEY ? 'loaded' : '⚠ NOT SET'}`);
  console.log(`✓ S3:       ${process.env.S3_BUCKET       || '⚠ NOT SET'}`);
  console.log(`✓ WhatsApp:     ${process.env.WHATSAPP_TOKEN     ? 'loaded' : '⚠ NOT SET'}`);
  console.log(`✓ Allowed origins: ${allowedOrigins.join(', ')}`);
});
