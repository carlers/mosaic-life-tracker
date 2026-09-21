# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: PostHog verification is paused. The user reports that opening the stable Mosaic link from ChatGPT shows `Database not initialized`; because Mosaic is local-first and the link may be opening in a separate in-app browser/webview storage context, the immediate priority is to verify the app in the user's normal external browser/PWA before treating this as a repository database regression.
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: Probe commit `d0885fa818cba0216b5e50f1aff4a95ec85bec44` passed GitHub Actions Verify run 35562106729 and is deployed READY on stable `preview` alias via Vercel deployment `dpl_6cD2boBgugucsge3bzaSPprbGdF3`. The user opened the explicit authenticated probe URL, but PostHog project 619969 still shows `ingested_event: false`, zero exception events/issues, and therefore no live identity or symbolication evidence. Fresh valid source-map upload still proves the build-only PostHog credentials are working.
Next action: Have the user copy the stable preview URL and paste it into the same external browser/PWA context where Mosaic was previously used (Brave/Chrome, not the ChatGPT in-app browser). If the database/data appears there, resume Phase 3.7 from that context. If `Database not initialized` reproduces in the normal browser/PWA, investigate RxDB bootstrap immediately and keep PostHog paused.
Blockers: Browser/storage context is not yet confirmed. Do not clear IndexedDB or create/edit data in the blank instance. PostHog remains secondary until normal Mosaic data visibility is confirmed.

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

- Live authenticated probe visit: no event ingested; PostHog project 619969 remains `ingested_event: false` with zero `$exception` events/issues.

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
