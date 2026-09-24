/**
 * server/utils/instagramOembed.js — the no-signup bridge: pull a single
 * PUBLIC Instagram post's caption via Meta's oEmbed endpoint, given just
 * its URL, no org OAuth connection needed. Feeds the same review queue
 * (utils/instagramCandidates.js) as the connected-account sync path in
 * routes/instagramEvents.js.
 *
 * As of a Meta policy change reported in June 2026, oEmbed for a single
 * public post is meant to work tokenless (lower rate limit, no app
 * review) -- though Meta's own reference docs, as of this writing, still
 * list access_token as required. Given that ambiguity, this tries the
 * request WITHOUT a token first, and falls back to an app access token
 * (FACEBOOK_APP_ID|FACEBOOK_APP_SECRET -- this app's own developer
 * credentials, not a per-org OAuth token) if that's rejected. Either way
 * this can only ever see PUBLIC posts; a private account's post returns a
 * real Meta error, surfaced as-is rather than papered over with a fake
 * success.
 *
 * The caption itself isn't a separate JSON field in the response -- the
 * oEmbed endpoint only gives back a <blockquote> embed widget's HTML, with
 * the caption text sitting inside a <p> tag near the end (formatted like
 * "<the caption> A post shared by @handle"). extractCaptionFromEmbedHtml()
 * pulls that back out; if Meta ever reshapes the widget markup, this
 * degrades to the whole visible text of the blockquote rather than
 * failing outright.
 */

const axios = require('axios');

const OEMBED_URL = 'https://graph.facebook.com/v21.0/instagram_oembed';

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCaptionFromEmbedHtml(html) {
  if (!html) return '';
  // The caption normally lives in the LAST <p>...</p> block of the widget.
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
  let text = paragraphs.length ? paragraphs[paragraphs.length - 1] : stripTags(html);
  // Cut Instagram's own trailing attribution ("A post shared by X (@y) on ...").
  text = text.replace(/A post shared by[\s\S]*$/i, '').trim();
  return text;
}

function buildAppAccessToken() {
  const { FACEBOOK_APP_ID, FACEBOOK_APP_SECRET } = process.env;
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) return null;
  return `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
}

/**
 * @param {string} postUrl - a public instagram.com/p/... or /reel/... link
 * @returns {Promise<{caption:string, permalink:string, raw:object}>}
 * @throws with a real, user-facing message on failure (bad link, private
 *   post, Meta API error) -- never fakes success.
 */
async function fetchInstagramOembed(postUrl) {
  if (!/^https?:\/\/(www\.)?instagram\.com\/(p|reel)\//i.test(postUrl || '')) {
    throw new Error("That doesn't look like an Instagram post link — it should look like https://www.instagram.com/p/XXXXXXX/");
  }

  const attempt = async (accessToken) => {
    const params = { url: postUrl };
    if (accessToken) params.access_token = accessToken;
    const { data } = await axios.get(OEMBED_URL, { params });
    return data;
  };

  let data;
  try {
    data = await attempt(null); // tokenless first, per Meta's June 2026 change
  } catch (err) {
    const appToken = buildAppAccessToken();
    if (!appToken) {
      throw new Error(
        (err.response && err.response.data && err.response.data.error && err.response.data.error.message)
        || "Instagram would not return that post — it may be private, deleted, or Meta is temporarily rejecting unauthenticated requests (add FACEBOOK_APP_ID/FACEBOOK_APP_SECRET to the server .env to enable the authenticated fallback)."
      );
    }
    try {
      data = await attempt(appToken);
    } catch (err2) {
      throw new Error(
        (err2.response && err2.response.data && err2.response.data.error && err2.response.data.error.message)
        || 'Instagram would not return that post — it may be private or deleted.'
      );
    }
  }

  return {
    caption: extractCaptionFromEmbedHtml(data.html),
    permalink: postUrl,
    raw: data,
  };
}

module.exports = { fetchInstagramOembed, extractCaptionFromEmbedHtml };
