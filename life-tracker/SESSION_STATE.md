# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: hosted preview and PostHog source-map upload are live, but browser flag traffic still does not reach PostHog even after a Shields-off reload; the smoke flag remains uncalled
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: The `preview` branch was advanced to verified commit `ade41cf0fd248a9e1c0d6ec540b1608f8c40c5cb` (`fix: disable RxDB ignoreDuplicate in production`). GitHub Actions run 35556402435 passed the canonical verify gate. Vercel deployment `dpl_DjjQTX9cfGqD4aGg5RZCEHn3BowE` is READY and carries the stable branch alias `mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app`. The user reports the Vercel/Appwrite preview setup is complete. The Vercel connector still reports the older `main` deployment as the project's `production` target, so current phone verification should use the registered `preview` alias unless the provider UI later reflects a production-branch change.
Next action: Verify in Vercel Settings → Environment Variables that `VITE_POSTHOG_TOKEN` is the PostHog project token (not a personal API key), `VITE_POSTHOG_HOST` is `https://us.i.posthog.com`, and both variables are enabled for Preview. Redeploy `preview`, then reload and re-check flag `mosaic-phase-3-7-smoke`. If still uncalled, inspect the browser network request to `/flags?v=2`.
Blockers: Vercel source-map credentials are confirmed working (47 PostHog symbol sets uploaded), but PostHog project 619969 still reports no ingested events and smoke flag 898417 has `last_called_at: null` after Brave Shields were disabled and the page reloaded. The Vercel connector cannot read client environment variables or the protected built bundle; its `get_project` wrapper also has a schema mismatch. The remaining leading cause is missing/incorrect Preview-scoped `VITE_POSTHOG_TOKEN` or `VITE_POSTHOG_HOST`.

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
