// routes/instagramAuth.js
//
// Mount alongside your existing routes — self-contained, doesn't touch any
// of your current code: app.use(require('./routes/instagramAuth'));
//
// Requires: npm install express axios

const express = require('express');
const crypto = require('crypto');
const {
  buildAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  getProfile,
} = require('../lib/instagramClient');

const router = express.Router();

router.get('/auth/instagram', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');

  // TODO: tie to your logged-in admin/session, e.g.
  //   req.session.igOauthOrgId = req.session.orgId;
  req.session = req.session || {};
  req.session.igOauthState = state;

  res.redirect(buildAuthorizeUrl(state));
});

router.get('/auth/instagram/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect('/connect-social.html?ig=denied');
  }

  const expectedState = req.session && req.session.igOauthState;
  if (!state || state !== expectedState) {
    console.error('Instagram OAuth state mismatch — possible CSRF, or expired session.');
    return res.status(400).send('Invalid or expired login attempt. Please try connecting again.');
  }

  try {
    const shortLived = await exchangeCodeForShortLivedToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000);
    const profile = await getProfile(shortLived.user_id, longLived.access_token);

    // TODO: replace with your actual DynamoDB write.
    await saveInstagramConnection({
      orgId: req.session.igOauthOrgId,
      igUserId: profile.id,
      username: profile.username,
      accountType: profile.account_type,
      accessToken: longLived.access_token,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
    });

    delete req.session.igOauthState;

    return res.redirect(`/connect-social.html?ig=connected&handle=${encodeURIComponent(profile.username)}`);
  } catch (err) {
    console.error('Instagram OAuth callback failed:', err.response ? err.response.data : err.message);
    return res.redirect('/connect-social.html?ig=error');
  }
});

async function saveInstagramConnection(connection) {
  // TODO: wire to DynamoDB — see facebookAuth.js's finishConnectingPage for
  // the matching pattern. Encrypt accessToken at rest if you can.
  console.log('TODO: persist Instagram connection', { ...connection, accessToken: '[hidden]' });
}

module.exports = router;
