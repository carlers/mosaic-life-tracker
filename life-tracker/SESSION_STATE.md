# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: Phase 3.7 live ingestion is now proven from the user's normal Mosaic browser context. The one-shot probe produced two handled `$exception` events for the authenticated distinct ID; the attached PostHog person has no profile properties, no session recordings were created, and no ordinary analytics events were emitted for that identity. Phase 3.7 remains open because both stack frames failed source-map resolution and project-level IP anonymization is currently disabled.
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: Probe commit `d0885fa818cba0216b5e50f1aff4a95ec85bec44` passed GitHub Actions Verify run 35562106729 and is deployed READY on stable `preview` alias via Vercel deployment `dpl_6cD2boBgugucsge3bzaSPprbGdF3`. The user opened the explicit authenticated probe URL, but PostHog project 619969 still shows `ingested_event: false`, zero exception events/issues, and therefore no live identity or symbolication evidence. Fresh valid source-map upload still proves the build-only PostHog credentials are working.
Next action: Fix the two remaining live blockers: (1) enable PostHog project 619969 `anonymize_ips` so server-side IP/GeoIP enrichment is dropped, and (2) repair source-map symbolication for the manually constructed `$exception` stack. After those fixes, rebuild Preview and rerun the one-shot probe, then remove the temporary probe and close Phase 3.7 only if symbolication/privacy checks pass.
Blockers: PostHog ingestion/identity/replay checks pass, but source-map resolution fails for `/assets/index-D5AfOyYK.js` with `Invalid source map: bad json: expected value at line 1 column 1`; both sampled app frames are unresolved. PostHog project 619969 reports `anonymize_ips: false`, and the received exception was enriched server-side with IP/GeoIP properties. Remote PostHog setting changes require explicit user approval.

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

- Live PostHog probe from the normal Mosaic browser succeeded at 2026-09-21 05:10:30Z and 05:10:51Z, producing two handled `$exception` events under authenticated distinct ID `6a9bc9316412bceaa5ba`.
- Privacy/identity evidence: the PostHog person properties object is `{}`; only the intended `$exception` events were present for that identity in the probe window; session recordings query returned zero results.
- Source-map evidence: both app frames in `/assets/index-D5AfOyYK.js` remained unresolved with `Invalid source map: bad json: expected value at line 1 column 1` despite valid uploaded symbol-set metadata.
- Project privacy setting: `anonymize_ips` is currently false, so PostHog added server-side IP/GeoIP enrichment to the exception event.

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
