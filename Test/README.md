# CalendarFly test system

This folder is a snapshot of the current working app, including uncommitted source changes. The original app is unchanged. Production environment files, old builds, backups, archives, and deployment credentials were excluded. Dependencies were copied locally to avoid another download; Docker builds install from the lockfiles.

## 1. Local automated tests

Open a terminal in this Test folder and run:

    npm test

This runs the existing backend and frontend suites and writes reports under reports/. It does not prove every feature works. For a fresh checkout, run npm ci inside both server and temple-calendar first (Node 22 recommended).

## 2. Local app with a separate database

Start Docker Desktop, then from this Test folder:

    npm run local:up
    npm run test:local

Open http://localhost:5100. Use the app's guest trial to create a test organization. The copied server uses a private DynamoDB Local container and dummy credentials. The Docker network blocks server internet access. The scheduled broadcast worker is disabled. Google login is disabled in this copy. Core calendar and account test data stays in the Docker volume. Email, SMS, social posting, Stripe checkout, AI, S3 uploads, and external event synchronization are not functional integration tests in this local mode. Browser-loaded fonts and other public assets may still use the internet.

    npm run local:logs
    npm run local:down

Stopping preserves test data. Do not use production secrets or copy production data here. The server deliberately refuses startup outside its local configuration. Run through Docker Compose, not the copied server's old README commands. The database uses existing table names, but on a separate local database endpoint; it is not AWS production.

## 3. Online staging (not deployed yet)

Read STAGING.md before deployment. After the separate staging environment exists:

    $env:STAGING_URL = 'https://YOUR-STAGING-HOST'
    npm run test:staging

This checks the app shell, bundled script and API health. It does not create users or modify data. Full feature testing must use staging-only accounts and sandbox services, using the checklist below.

## 4. Live checks

    npm run test:live

The URL is fixed to https://calendarflyapp.com. The runner sends only GET requests to the homepage, its same-origin JavaScript bundle, and /api/health. Redirects are rejected. A failing check returns a nonzero exit code. Results are saved in reports/live-smoke.json. These checks do not exercise login, payments, customer data or full browser rendering, and the current health API does not prove database readiness.

## Release checklist

- Run both automated suites and resolve failures before release.
- On local/staging, create a test organization, log in, create/edit/delete an event, and inspect its public calendar.
- On staging, verify tenant separation, roles, RSVP, signups, uploads and flyer editing using fictional data.
- On staging, verify email/SMS with test recipients, social connections with test accounts, and Stripe sandbox checkout/webhooks. Verify AI limits using staging credentials.
- Deploy the reviewed source to production using its explicit service ARN. Then run test:live.

The Test copy does not automatically follow future source edits. Refresh it deliberately and retain its isolation changes. Never copy the locally modified Test server over the production server. The original deployment script must not be used after adding a second App Runner service until it selects an explicit service ARN instead of ServiceSummaryList[0].

For a local database workflow test, run npm run test:local:flow. It creates a guest test organization and verifies event creation, reading, editing and deletion. The organization stays in the local database for inspection. Run npm run test:isolation to verify startup protections.

Local-only site administrator: local-admin / local-test-password. These credentials work only in the isolated copy bound to your computer.
