# Session state

Updated: 2026-09-22
Current task: Strategy B tombstone retention and stale-client recovery
Status: Implementation and automated verification are complete. Mosaic now uses a 90-day tombstone retention window, stale-cursor full pulls, missing-row reconciliation, and a privileged Appwrite tombstone GC function.
Roadmap pointer: Tombstone retention is implemented as a synchronization-safe technical foundation. Feature backlog remains next after deployment setup is completed.
Checkpoint: GitHub Verify is green on the implementation commit. The tombstone GC function is committed but has not yet been deployed/scheduled in the Appwrite Console.
Next action: Deploy `appwrite-functions/tombstone-gc` in Appwrite with `TOMBSTONE_RETENTION_DAYS=90`, run it once manually, then configure the periodic schedule. Do not move `preview` until the deployment/manual check is user-authorized.
Blockers: Appwrite Console deployment and scheduled-trigger setup require manual access; no Appwrite connector is available in this chat.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- GitHub Verify workflow: green for the tombstone-retention implementation.
- Unit/handler regression coverage: 496 tests passed across 68 test files in the acceptance run.
- Browser/device manual checks: unchanged from the prior Phase 4 checkpoint; no new UI behavior was introduced.
- Appwrite tombstone GC deployment/schedule: pending manual Console setup.
