# Session state

Updated: 2026-09-22
Current task: Appwrite tombstone GC function-budget consolidation
Status: The tombstone garbage collector has been consolidated into the existing `message-action` Appwrite Function so Mosaic keeps its second Free-plan Function slot available for future integrations. The new maintenance path is selected only by Appwrite's trusted `x-appwrite-trigger: schedule` metadata; normal user executions still require authentication and cannot select GC through an action payload.
Roadmap pointer: Strategy B remains the active operational prerequisite before feature-backlog acceptance continues. Todo List implementation is still awaiting its full DOM/browser acceptance gate and remains unchecked in `PLAN.md`.
Checkpoint: The shared-maintenance implementation, regression coverage, and deployment documentation are complete, and the canonical GitHub Verify gate is green. The verified checkpoint is ready for the hosted `preview` promotion; live Appwrite configuration remains a separate manual operation.
Next action: Keep the exact verified checkpoint on `preview` and confirm its Vercel deployment is healthy, then update the existing Appwrite `message-action` deployment and enable its daily schedule per `docs/TOMBSTONE_RETENTION.md`. After the first scheduled execution is accepted, resume the Todo List full DOM/browser acceptance gate.
Blockers: Appwrite Console deployment/environment/schedule changes still require manual access. No separate `tombstone-gc` Function should be created.

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
- Appwrite live execution: pending manual deployment of the updated existing `message-action` Function and inspection of its first scheduled execution.
- Todo List browser/device acceptance: still pending from the previous checkpoint.
