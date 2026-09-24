# Social Login page for CalendarFly (Facebook + Instagram)

A single new page with two "Continue with..." buttons. Nothing here touches
your existing code — you only add these files and mount two routers.

**What "not exposing auth or the API" means in this build:** every OAuth
token exchange (code → short-lived token → long-lived token) happens in
`lib/facebookClient.js` and `lib/instagramClient.js`, on your server. The
browser never receives an access token, a raw Graph API response, or
anything resembling the Graph API Explorer. The only thing the frontend page
(`public/connect-social.html`) ever sees is a plain query-string flag like
`?fb=connected&page=My+Temple` — no keys, no JSON, no tokens.

## Files (all new, nothing overwritten)

- `public/connect-social.html` — the page with both buttons + a plain status line.
- `routes/facebookAuth.js` — `/auth/facebook`, `/auth/facebook/callback`, and
  `/auth/facebook/select-page` (only used if the admin manages more than one Page).
- `routes/instagramAuth.js` — `/auth/instagram`, `/auth/instagram/callback`.
- `lib/facebookClient.js` / `lib/instagramClient.js` — the actual API calls.
- `.env.example` — config values to fill in.

## 1. Add to your app without changing existing code

```js
// in your main server file, ADD these two lines — don't touch anything else
app.use(require('./routes/facebookAuth'));
app.use(require('./routes/instagramAuth'));
```

Serve `public/connect-social.html` the same way you already serve static
files (or copy it next to your existing static assets), then visit
`/connect-social.html`.

You'll need `express-session` (or whatever session middleware your app
already uses) active before these routers run, since they store a short-lived
CSRF `state` value and, for Facebook, a temporary list of candidate Pages, in
`req.session`. If your app already has sessions set up for login, these
routers just reuse that — no new session store needed.

## 2. Meta dashboard setup

These are two separate products in your existing app, each with its own
App ID/Secret and its own redirect URI to whitelist:

- **Facebook Login for Business** → scopes used: `pages_show_list`,
  `pages_read_engagement`, `pages_manage_posts`, `business_management`.
  This is the same permission set as your original submission.
- **Instagram Business Login** → scopes used: `instagram_business_basic`,
  `instagram_business_content_publish`. Add this as its own product if you
  haven't already (see the earlier instagram-login package's README for the
  step-by-step). Keep it as a second, separate button rather than merging it
  into the Facebook flow — mixing `instagram_basic` (Facebook-linked) with
  `instagram_business_basic` (direct login) in one flow is what caused the
  inconsistency in your last App Review submission.

While your app is in Development mode, add your own accounts as testers for
each product so you can build and click through the whole thing before
submitting either permission set for review.

## 3. What's stubbed for you to wire up

Search for `// TODO` in `routes/facebookAuth.js` and `routes/instagramAuth.js`:

- Associating a connection with the logged-in CalendarFly admin/org (currently
  reads from `req.session`, which you'll point at whatever your existing auth
  already sets there).
- The actual DynamoDB write (`finishConnectingPage` for Facebook,
  `saveInstagramConnection` for Instagram) — both log a `TODO: persist...`
  line right now so you can see the flow working end-to-end before wiring
  storage in.

## 4. After connecting

`publishPagePost` (Facebook) and `createMediaContainer` + `publishMedia`
(Instagram) in the two `lib/*Client.js` files are ready to call once you have
a stored Page/Instagram token — same publish pattern (including scheduling
via `published: false` + `scheduled_publish_time`) as discussed earlier.
