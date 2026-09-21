# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: the corrected PostHog personal API key now allows the feature-branch Vercel build to complete, but the stable `preview` branch still points to older commit `7b96149`; browser flag traffic remains unverified on a build that includes the corrected environment
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: The `preview` branch was advanced to verified commit `ade41cf0fd248a9e1c0d6ec540b1608f8c40c5cb` (`fix: disable RxDB ignoreDuplicate in production`). GitHub Actions run 35556402435 passed the canonical verify gate. Vercel deployment `dpl_DjjQTX9cfGqD4aGg5RZCEHn3BowE` is READY and carries the stable branch alias `mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app`. The user reports the Vercel/Appwrite preview setup is complete. The Vercel connector still reports the older `main` deployment as the project's `production` target, so current phone verification should use the registered `preview` alias unless the provider UI later reflects a production-branch change.
Next action: Advance the deployment-only `preview` branch from `7b9614953639596dfc2eb1b3ea7c96c920daeae9` to verified commit `4a39732696da24978f428f4ff710919c3cab0fc2`, wait for the stable preview alias to redeploy with the corrected PostHog environment, then reload and re-check flag `mosaic-phase-3-7-smoke`.
Blockers: The feature-branch Vercel deployment `dpl_BHiU4xr2NtEUY4djvw4jPG42tiW8` is READY on commit `4a39732`, confirming the corrected personal API key no longer breaks the build. PostHog still shows no client traffic, but the stable `preview` ref is still on `7b96149`, so the canonical phone-test alias has not yet been rebuilt from the verified corrected-env commit. The Vercel connector still cannot expose client environment values directly.

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
- PostHog project 619969: connected; still no ingested events after a logged-in phone session; zero errors and zero recordings.
- Smoke flag `mosaic-phase-3-7-smoke` (ID 898417): active, client-only, 100% rollout; `last_called_at` remains null.
- Source maps: 47 valid symbol sets uploaded at 2026-09-21 03:43 UTC, confirming build-time PostHog credentials.
- Stable `preview` deployment `dpl_12Ro3CTQr6B4Vuy9wRVHBUAptdwN`: READY on commit `7b9614953639596dfc2eb1b3ea7c96c920daeae9`.
- Phase 3.7 live browser verification: blocked on distinguishing Brave/content blocking from missing client `VITE_*` embedding.
