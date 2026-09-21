// lib/facebookClient.js
//
// Server-side only. Every token exchange happens here, never in the browser —
// the frontend page never sees an access token, only a plain "connected" state.
// Requires: npm install axios

const axios = require('axios');
const { getFacebookConfig } = require('../utils/socialConfig');

const GRAPH_VERSION = 'v21.0'; // check developers.facebook.com for the current supported version

// Scoped to what CalendarFly's Facebook-Page posting actually uses — no
// instagram_basic here, since Instagram is handled by the separate direct
// "Continue with Instagram" flow (lib/instagramClient.js). Keeping these two
// paths separate avoids mixing the legacy and new Instagram permission sets.
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'business_management',
].join(',');

function buildAuthorizeUrl(state) {
  const { FACEBOOK_APP_ID, FACEBOOK_REDIRECT_URI } = getFacebookConfig();
  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: FACEBOOK_REDIRECT_URI,
    state,
    scope: SCOPES,
    response_type: 'code',
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Authorization code -> short-lived user access token. */
async function exchangeCodeForToken(code) {
  const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI } = getFacebookConfig();
  const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
    params: {
      client_id: FACEBOOK_APP_ID,
      client_secret: FACEBOOK_APP_SECRET,
      redirect_uri: FACEBOOK_REDIRECT_URI,
      code,
    },
  });
  return data; // { access_token, token_type, expires_in }
}

/** Short-lived user token -> long-lived user token (~60 days). */
async function exchangeForLongLivedToken(shortLivedToken) {
  const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } = getFacebookConfig();
  const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: FACEBOOK_APP_ID,
      client_secret: FACEBOOK_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });
  return data; // { access_token, token_type, expires_in }
}

/**
 * List the Pages this user manages. Page access tokens returned here are
 * already long-lived if the user token passed in is long-lived — no separate
 * exchange step needed for Pages.
 */
async function getManagedPages(longLivedUserToken) {
  const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`, {
    params: { access_token: longLivedUserToken },
  });
  return data.data; // [{ id, name, access_token, category, ... }, ...]
}

/** Optional: the Instagram Business account linked to a Page, if any. */
async function getLinkedInstagramAccount(pageId, pageAccessToken) {
  const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}`, {
    params: {
      fields: 'instagram_business_account{id,username}',
      access_token: pageAccessToken,
    },
  });
  return data.instagram_business_account || null;
}

/**
 * Publishing a flyer to a Page. Set publishNow=false with scheduledPublishTime
 * (unix timestamp, 10 min–6 months out) to schedule instead — Meta publishes
 * it automatically, no second call needed.
 */
async function publishPagePost(pageId, pageAccessToken, { message, imageUrl, publishNow = true, scheduledPublishTime }) {
  const params = {
    message,
    access_token: pageAccessToken,
  };
  if (imageUrl) params.link = imageUrl; // or use /{page-id}/photos for a native photo post

  if (!publishNow) {
    params.published = false;
    if (scheduledPublishTime) params.scheduled_publish_time = scheduledPublishTime;
  }

  const { data } = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, null, { params });
  return data; // { id: postId }
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getManagedPages,
  getLinkedInstagramAccount,
  publishPagePost,
};
