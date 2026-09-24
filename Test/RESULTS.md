# Retest verdict - September 21, 2026, 9:25 PM Pacific

## Verdict: Previously reported application defects resolved in local retesting

Ready to proceed to staging validation. This is not certification of untested production integrations.

Refreshed Test/server and Test/temple-calendar from the latest working source, including the uncommitted fixes and server/vitest.config.js. Kept the established local-only endpoint overrides, startup guard, disabled broadcast scheduler/Google login and test banner. The four fix-related source files were hashed before testing and were unchanged during the run (reports/retest-source-hashes.json). No application source outside Test was modified. Local app: http://localhost:5100.

## Results

| Check | Result |
| --- | --- |
| Production-mode frontend build and Docker startup | PASS |
| Local homepage, JavaScript bundle and API health | PASS |
| Guest login and event create/read/update/delete | PASS |
| Isolation startup tests | 5 passed |
| Backend suite on isolated rerun | 39 passed |
| Frontend suite | 129 passed, no unhandled errors |
| Media API checks | 10 passed |
| Album privacy matrix | 6 passed |

## Fixes verified

- Private/draft, private/published, hidden/published and public/draft albums hide their photos from community attendees.
- Public/published albums still return their photos.
- Deleting a private album no longer exposes its remaining photos.
- Invalid video durations -1, abc and 16 are rejected.
- Album creation, overview, editing, deletion, invalid-visibility rejection and cross-organization access checks pass.
- The platform statistics fixture now includes both totals and the organizations array. The frontend suite finishes without the previous organizations/map exceptions.

## Remaining test reliability observation

The initial backend run, concurrent with the Docker build, had 38 passes and one failure: the beforeEach hook for broadcast.test.js's requires-authentication case exceeded 30 seconds. After the build and frontend suite finished, the same backend runner passed all 39 tests with the same project settings. No timeout override or test assertion changes were used on the rerun.

This is an intermittent setup timeout, not a reproduced application authentication defect. It should remain tracked; the test system is not consistently green under concurrent load. Initial evidence is retained in reports/server-tests-first-run.txt; the passing rerun is reports/server-tests.txt.

## Evidence

- reports/server-tests.txt
- reports/server-tests-first-run.txt
- reports/temple-calendar-tests.txt
- reports/latest-build.txt
- reports/local-smoke.json
- reports/latest-media.json
- reports/latest-privacy.txt

Synthetic privacy/media records were cleaned up; guest test organizations remain for inspection. Docker test data is isolated from production.

## Limits and next step

Staging is not provisioned. Real S3 access/uploads, payments, social/Google login, email/SMS, AI and full browser interactions were not validated in this isolated test. Production was not modified or redeployed. Complete staging integration checks before approving a production release. Nonblocking JavaScript bundle-size warnings remain.
