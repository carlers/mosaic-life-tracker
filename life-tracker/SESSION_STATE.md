# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: hosted preview is live; PostHog project connection is verified and a smoke-test flag exists, but the deployed app is still not ingesting PostHog traffic because Vercel client/build variables are not yet active
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: The `preview` branch was advanced to verified commit `ade41cf0fd248a9e1c0d6ec540b1608f8c40c5cb` (`fix: disable RxDB ignoreDuplicate in production`). GitHub Actions run 35556402435 passed the canonical verify gate. Vercel deployment `dpl_DjjQTX9cfGqD4aGg5RZCEHn3BowE` is READY and carries the stable branch alias `mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app`. The user reports the Vercel/Appwrite preview setup is complete. The Vercel connector still reports the older `main` deployment as the project's `production` target, so current phone verification should use the registered `preview` alias unless the provider UI later reflects a production-branch change.
Next action: Configure Vercel with the Mosaic PostHog project values (`VITE_POSTHOG_TOKEN`, `VITE_POSTHOG_HOST=https://us.i.posthog.com`, plus source-map upload variables), redeploy `preview`, then verify the smoke flag `mosaic-phase-3-7-smoke`, exception ingestion, identity/privacy behavior, replay/autocapture absence, and source-map symbolication.
Blockers: The PostHog connector is connected to Mosaic project 619969, but the current Vercel connector does not expose environment-variable writes/reads. The user must add the required Vercel variables in the provider UI before live browser verification can proceed.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries only an exact verified commit selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Working set

- `src/lib/posthog.ts`
- `src/hooks/useFeatureFlag.ts`
- `src/hooks/AuthProvider.tsx`
- `vite.config.ts`
- `docs/PROJECT_REFERENCE.md`
- `docs/PREVIEW_DEPLOYMENT.md`
- `PLAN.md`
- `SESSION_STATE.md`

## Verification

- GitHub Actions run 35556402435: canonical verify gate passed for commit `ade41cf0fd248a9e1c0d6ec540b1608f8c40c5cb`.
- Vercel deployment `dpl_DjjQTX9cfGqD4aGg5RZCEHn3BowE`: READY on the `preview` branch.
- Appwrite preview-origin registration: reported complete by the user.
- PostHog project 619969: connected; no events ingested yet; zero errors/recordings before deployment configuration.
- Smoke flag `mosaic-phase-3-7-smoke` (ID 898417): created active, client-only, 100% rollout for live verification.
- Phase 3.7 live PostHog dashboard/source-map verification: blocked on Vercel PostHog environment variables.
