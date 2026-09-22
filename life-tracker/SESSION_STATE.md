# Session state

Updated: 2026-09-22
Current task: Todo List acceptance
Status: Appwrite tombstone maintenance is live on the existing `message-action` Function, preserving the second Free-plan Function slot for future integrations. The deployed maintenance path is selected only by Appwrite's trusted `x-appwrite-trigger: schedule` metadata; normal user executions still require authentication and cannot select GC through an action payload.
Roadmap pointer: Strategy B tombstone retention and its Appwrite operational rollout are complete. Todo List implementation is now the active roadmap item and is still awaiting its full browser acceptance gate before `PLAN.md` is checked.
Checkpoint: The verified shared-maintenance code is on `preview`, the existing Appwrite `message-action` Function is running deployment `6ab2a068c69c76a08610`, `TOMBSTONE_RETENTION_DAYS=90` is configured, and a one-time scheduled execution completed successfully across all six synced tables with `purged=0`. The daily `0 0 * * *` schedule is enabled.
Next action: Resume the Todo List full browser acceptance gate on the hosted `preview` build, then update `PLAN.md` if acceptance is green.
Blockers: None for tombstone retention. Do not create a separate `tombstone-gc` Function; the second Appwrite Function slot remains free.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- Shared-maintenance implementation: canonical GitHub Verify is green.
- Tombstone GC regression coverage: scheduled trigger, 90-day cutoff, all six synced tables, destructive-query filter, and non-scheduled auth isolation are covered in `tests/handlers/tombstoneGc.test.ts`.
- Hosted task-branch deployment: Vercel build is READY for the verified shared-maintenance implementation.
- Appwrite live execution: green — scheduled execution completed with `retentionDays=90`, all six synced tables logged, `scanned=0`, `purged=0`, and no errors; daily `0 0 * * *` schedule enabled.
- Todo List browser/device acceptance: still pending from the previous checkpoint.
