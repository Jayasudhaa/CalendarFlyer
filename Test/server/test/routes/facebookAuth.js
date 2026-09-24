// routes/facebookAuth.js
//
// Mount alongside your existing routes — this file is fully self-contained
// and doesn't touch any of your current code:
//   app.use(require('./routes/facebookAuth'));
//
// Requires: npm install express axios

const express = require('express');
const crypto = require('crypto');
const {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getManagedPages,
} = require('../lib/facebookClient');

const router = express.Router();

// --- Step 1: "Continue with Facebook" -> GET /auth/facebook ---
router.get('/auth/facebook', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  // TODO: tie this to your existing logged-in admin/session, same as the
  // Instagram flow, e.g. req.session.fbOauthOrgId = req.session.orgId;
  req.session = req.session || {};
  req.session.fbOauthState = state;

  res.redirect(buildAuthorizeUrl(state));
});

// --- Step 2: Facebook redirects back with ?code=...&state=... ---
router.get('/auth/facebook/callback', async (req, res) => {
  const { code, state, error, error_reason: errorReason } = req.query;

  if (error) {
    console.error('Facebook OAuth error:', error, errorReason);
    return res.redirect('/connect-social.html?fb=denied');
  }

  const expectedState = req.session && req.session.fbOauthState;
  if (!state || state !== expectedState) {
    console.error('Facebook OAuth state mismatch — possible CSRF, or expired session.');
    return res.status(400).send('Invalid or expired login attempt. Please try connecting again.');
  }

  try {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const pages = await getManagedPages(longLived.access_token);

    delete req.session.fbOauthState;

    if (!pages || pages.length === 0) {
      // Nothing to post to — send them back with a clear, plain message.
      return res.redirect('/connect-social.html?fb=error');
    }

    if (pages.length === 1) {
      await finishConnectingPage(req, pages[0]);
      return res.redirect(`/connect-social.html?fb=connected&page=${encodeURIComponent(pages[0].name)}`);
    }

    // Multiple Pages: show a minimal, server-rendered picker. Only names are
    // shown — page access tokens stay server-side, held in a short-lived
    // session value keyed by page id, never sent to the browser.
    req.session.fbCandidatePages = pages.map(p => ({ id: p.id, name: p.name, access_token: p.access_token }));
    return res.send(renderPagePicker(pages));
  } catch (err) {
    console.error('Facebook OAuth callback failed:', err.response ? err.response.data : err.message);
    return res.redirect('/connect-social.html?fb=error');
  }
});

// --- Step 3 (only if the admin manages more than one Page) ---
router.post('/auth/facebook/select-page', express.urlencoded({ extended: false }), async (req, res) => {
  const { pageId } = req.body;
  const candidates = (req.session && req.session.fbCandidatePages) || [];
  const chosen = candidates.find(p => p.id === pageId);

  if (!chosen) {
    return res.status(400).send('That Page selection is no longer valid. Please reconnect.');
  }

  await finishConnectingPage(req, chosen);
  delete req.session.fbCandidatePages;

  return res.redirect(`/connect-social.html?fb=connected&page=${encodeURIComponent(chosen.name)}`);
});

async function finishConnectingPage(req, page) {
  // TODO: replace with your actual DynamoDB write, e.g. a SocialConnections
  // table: { orgId, provider: 'facebook_page', pageId, pageName, accessToken }.
  // Page access tokens obtained this way don't expire on their own as long as
  // the user token behind them was long-lived, but re-check periodically.
  console.log('TODO: persist Facebook Page connection', {
    orgId: req.session.fbOauthOrgId,
    pageId: page.id,
    pageName: page.name,
    // accessToken intentionally not logged here — store it, don't print it.
  });
}

function renderPagePicker(pages) {
  const options = pages
    .map(p => `<label style="display:block;margin:8px 0;"><input type="radio" name="pageId" value="${p.id}" required> ${escapeHtml(p.name)}</label>`)
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Choose a Page — CalendarFly</title></head>
<body style="font-family:sans-serif;max-width:420px;margin:60px auto;">
  <h2>Which Page should CalendarFly post to?</h2>
  <form method="POST" action="/auth/facebook/select-page">
    ${options}
    <button type="submit" style="margin-top:16px;padding:10px 18px;">Connect this Page</button>
  </form>
</body></html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = router;
