# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: the stable `preview` deployment is READY on verified commit `4a39732`, but a fresh phone/browser reload still produced no PostHog flag call; the leading remaining configuration risk is Vercel branch-specific Preview env scoping
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: The `preview` branch was advanced to verified commit `4a39732696da24978f428f4ff710919c3cab0fc2` after GitHub Actions run 35559281361 passed the canonical verify gate. Vercel deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1` is READY and carries the stable branch alias `mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app`. This deployment was built after the PostHog personal API key was corrected. The user reports the Appwrite preview-origin setup is complete. The Vercel connector still reports the older `main` deployment as the project's `production` target, so phone verification should continue to use the registered `preview` alias.
Next action: In Vercel Settings → Environment Variables, verify `VITE_POSTHOG_TOKEN`, `VITE_POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, and `POSTHOG_HOST` are available to the general Preview environment or specifically to the `preview` branch, not only `chatgpt/phase-3-7-posthog`. Redeploy `preview`, reload once, then re-check PostHog.
Blockers: The stable preview was loaded after redeploy, but PostHog project 619969 still reports `ingested_event: false`, smoke flag 898417 still has `last_called_at: null`, and there are zero errors/recordings. Vercel supports branch-specific Preview variables, so variables scoped only to `chatgpt/phase-3-7-posthog` would not be present on the deployment-only `preview` branch. The connected Vercel tool cannot list env values/scopes directly.

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
- Fresh stable-preview reload after deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1`: no PostHog flag call (`last_called_at` still null), no ingested events, zero errors, zero recordings.
- Phase 3.7 live browser verification: blocked on verifying Preview environment-variable scope for the `preview` branch.
