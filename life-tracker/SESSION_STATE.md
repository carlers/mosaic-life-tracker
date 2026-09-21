# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: the gated Phase 3.7 live exception probe is verified and deployed on the stable `preview` alias; one authenticated browser visit to the explicit probe URL is now required to generate the controlled `$exception`
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: Commit `d0885fa818cba0216b5e50f1aff4a95ec85bec44` adds a one-shot, query-gated handled exception probe that remains inactive on normal URLs and sends only after authenticated Appwrite identity resolves. GitHub Actions Verify run 35562106729 passed. The deployment-only `preview` branch now points to that exact verified commit, and Vercel deployment `dpl_6cD2boBgugucsge3bzaSPprbGdF3` is READY on the stable alias `mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app`. PostHog also reports a fresh valid uploaded symbol set from the probe build.
Next action: While logged in, open `https://mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app/?__mosaic_posthog_probe=phase-3-7-exception` once. After auth resolves, re-query PostHog for the new exception and verify authenticated distinct ID, minimal properties, source-map symbolication, and continued absence of recordings/autocapture data.
Blockers: User browser interaction is required to trigger the deployed one-shot probe. Normal URLs do not trigger it. After evidence is captured, remove the temporary runtime probe, verify the clean commit, and redeploy `preview` before closing Phase 3.7.

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

- GitHub Actions run 35562106729: canonical verify gate passed for probe commit `d0885fa818cba0216b5e50f1aff4a95ec85bec44`.
- Vercel deployment `dpl_6cD2boBgugucsge3bzaSPprbGdF3`: READY on deployment-only `preview`, stable alias attached, same verified probe commit.
- PostHog source maps: fresh valid symbol set uploaded from the probe build at 2026-09-21 04:45 UTC.

- GitHub Actions run 35559281361: canonical verify gate passed for commit `4a39732696da24978f428f4ff710919c3cab0fc2`.
- Vercel deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1`: READY on the `preview` branch and stable branch alias.
- Appwrite preview-origin registration: reported complete by the user.
- PostHog project 619969: connected; still no ingested events after a logged-in phone session; zero errors and zero recordings.
- Smoke flag `mosaic-phase-3-7-smoke` (ID 898417): active, client-only, 100% rollout; `last_called_at` remains null.
- Source maps: 47 valid symbol sets uploaded at 2026-09-21 03:43 UTC, confirming build-time PostHog credentials.
- Stable `preview` deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1`: READY on commit `4a39732696da24978f428f4ff710919c3cab0fc2` after the PostHog personal API key correction.
- Fresh stable-preview reload after deployment `dpl_6r2X7nwauZDavAVHekcYtqQmfLj1`: PostHog still shows `last_called_at: null`, `ingested_event: false`, zero errors, and zero recordings; these fields do not by themselves prove `/flags` was not called because Mosaic emits no `$feature_flag_called` or ordinary analytics events.
- User screenshot: all five PostHog variables are configured for Vercel Preview; branch-scope hypothesis ruled out.
- Phase 3.7 live browser verification: controlled `$exception` probe is deployed and awaiting one authenticated browser visit; PostHog ingestion/symbolication/identity evidence remains pending.
