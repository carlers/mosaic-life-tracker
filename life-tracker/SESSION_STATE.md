# Session state

Updated: 2026-09-22
Current task: Todo List view
Status: The first independent feature-backlog step is implemented: Mosaic now has a compact color-only month grid that selects a day and shows its task list with completion actions. The Appwrite tombstone GC deployment remains an independent manual operational step.
Roadmap pointer: Todo List is the first feature-backlog item. Do not mark it complete in `PLAN.md` until the full acceptance gate and browser review are green.
Checkpoint: The focused Todo List DOM test and lint pass. The production build is green again: the PostHog source-map plugin now loads only when its explicit upload credentials are configured, so normal builds do not require that optional plugin package.
Next action: Run the full DOM suite and browser review, then update `PLAN.md` and this checkpoint if all results are green. The separate Appwrite Console deployment may be completed whenever credentials are available.
Blockers: Appwrite Console deployment/schedule requires manual access. `npm ci` remains unable to download `@posthog/cli` (HTTP 403), but it no longer blocks normal production builds without PostHog upload credentials.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries verified commits selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Verification

- GitHub Verify workflow: green for the tombstone-retention implementation.
- Unit/handler regression coverage: 496 tests passed across 68 test files in the prior acceptance run; the subsequent local full-handler empty-run test is green.
- Browser/device manual checks: unchanged from the prior Phase 4 checkpoint; no new UI behavior was introduced.
- Appwrite tombstone GC deployment/schedule: pending manual Console setup.
