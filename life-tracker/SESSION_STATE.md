# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: the deployment-only `preview` branch now points to verified commit `4a39732696da24978f428f4ff710919c3cab0fc2`, and the stable preview deployment is READY with the corrected PostHog credentials; a fresh phone/browser reload is now required before live PostHog traffic can be rechecked
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: The `preview` branch was advanced to verified commit `4a39732696da24978f428f4ff710919c3cab0fc2` after GitHub Actions run 35559281361 passed the canonical verify gate. Vercel deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1` is READY and carries the stable branch alias `mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app`. This deployment was built after the PostHog personal API key was corrected. The user reports the Appwrite preview-origin setup is complete. The Vercel connector still reports the older `main` deployment as the project's `production` target, so phone verification should continue to use the registered `preview` alias.
Next action: Fully reload the stable `preview` alias on the phone/browser, exercise the app once while logged in, then re-check PostHog project 619969 for smoke-flag `last_called_at`, exceptions, identity/privacy behavior, and replay/autocapture absence.
Blockers: No deployment blocker remains. The stable preview is now rebuilt from verified commit `4a39732` with the corrected PostHog credentials. Live PostHog verification remains pending until the browser loads this deployment and produces fresh traffic.

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

- GitHub Actions run 35559281361: canonical verify gate passed for commit `4a39732696da24978f428f4ff710919c3cab0fc2`.
- Vercel deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1`: READY on the `preview` branch and stable branch alias.
- Appwrite preview-origin registration: reported complete by the user.
- PostHog project 619969: connected; still no ingested events after a logged-in phone session; zero errors and zero recordings.
- Smoke flag `mosaic-phase-3-7-smoke` (ID 898417): active, client-only, 100% rollout; `last_called_at` remains null.
- Source maps: 47 valid symbol sets uploaded at 2026-09-21 03:43 UTC, confirming build-time PostHog credentials.
- Stable `preview` deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1`: READY on commit `4a39732696da24978f428f4ff710919c3cab0fc2` after the PostHog personal API key correction.
- Phase 3.7 live browser verification: pending one fresh reload/use of the updated stable preview before re-querying PostHog.
