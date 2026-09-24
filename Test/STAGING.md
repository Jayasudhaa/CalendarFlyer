# CalendarFly online staging

Staging: https://vv6hpskams.us-east-2.awsapprunner.com

## Access

Open the site and sign in with username `staging`. The password is the `STAGING_ACCESS_KEY` value in `Test/staging/private/credentials.json`. This ignored local file also contains the separate platform administrator password; do not commit it. The platform administrator username is `staging-admin`.

After passing the staging gate, use **Try it free** to create a fictional guest workspace. Normal signup and Google login are disabled because test integrations are not configured. Use fictional data only. Guest workspaces remain in staging; the background cleanup scheduler is disabled along with broadcast scheduling.

## Isolation

- Separate App Runner service `calendarfly-staging`, immutable ECR image tags, and automatic deployments disabled.
- Same AWS account and region as production, with 15 separate DynamoDB tables prefixed `calendarfly_staging_` and a private staging S3 bucket.
- Runtime permissions grant access only to staging tables, staging media and staging configuration secrets. Production data is not copied.
- Separate random credentials stored in SSM SecureString parameters. Production environment files and backup files are excluded from the image.
- Password gate, secure HTTP-only login cookie, staging banner and search-indexing exclusion.
- Payments, messaging, Google/social authentication and posting, AI and background broadcasts are disabled. These integrations are not validated yet.

## Validation

Four generated-image regression checks pass. Local container checks pass for the gate, login cookie, bearer-token compatibility, health marker and integration blocking.

Hosted checks pass for staging identity, blocked anonymous access, secure login cookie, frontend bundle/banner, disabled integrations, guest login and event creation/read/update/deletion. See `staging/verification.json` for timestamp and results. The synthetic verification event was deleted; its guest workspace remains for inspection.

These checks do not constitute a full browser, media-upload or external-integration test.

## Repeat deployment

From the repository root:

```powershell
node Test/staging/prepare.cjs
node --test Test/staging/prepare.test.cjs
node Test/staging/provision.cjs deploy
node Test/staging/provision.cjs status
# Wait until RUNNING, then validate:
node Test/staging/verify.cjs
```

Preparation makes a fresh staging copy of the current source and rewrites database names and share links without changing the application source. Review resource names and integration routes when deploying new features. Retain the ignored `staging/state.json` and private credentials folder for repeat deployments.

`provision.cjs infra` already completed. Do not rerun it for ordinary releases. `configure-origin` sets the staging frontend origin and bucket CORS after initial service creation.

`REBUILD-AND-DEPLOY.ps1` now requires the explicit existing production service ARN and verifies its identity before building or pushing. It no longer selects the first service returned by AWS. It was not run during staging setup.

Staging uses one small App Runner instance (0.25 vCPU / 0.5 GB, maximum one instance). AWS resource charges apply while provisioned.

## Pause between test sessions

Pause staging when testing finishes; resume it before the next session. Pausing preserves the service and data. Storage charges can continue while paused. The staging website is unavailable until resumed.

```powershell
aws apprunner pause-service --region us-east-2 --service-arn arn:aws:apprunner:us-east-2:011820201589:service/calendarfly-staging/e6b5d7adb0df4c449f39445b8fb443f5
aws apprunner resume-service --region us-east-2 --service-arn arn:aws:apprunner:us-east-2:011820201589:service/calendarfly-staging/e6b5d7adb0df4c449f39445b8fb443f5
```

Wait for PAUSED or RUNNING respectively before treating the operation as complete. No automatic idle-pause monitor is configured.
