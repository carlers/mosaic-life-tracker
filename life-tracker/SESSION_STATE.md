# Session state

Updated: 2026-09-21
Current task: Phase 3.7 live PostHog staging/manual verification
Status: Phase 3.7 live ingestion/identity/replay checks are proven. PostHog project 619969 now has `anonymize_ips: true`. Commit `a115b48bb68e6fe11e3d10c5d2952394d04cedba` adds the missing runtime source-map metadata (`chunk_id` / `$release_id`) plus a deterministic Playwright browser contract; canonical Verify and the browser contract both pass, and that exact commit is READY on the stable `preview` alias. One final live probe is required to verify symbolication and absence of IP/GeoIP enrichment on a newly ingested event.
Roadmap pointer: Phase 3.7's automated gate is green; close it only after the live requirements in `docs/PROJECT_REFERENCE.md` §24.15 are verified. Phase 4 WCAG browser/manual evidence follows.
Checkpoint: Source-map root cause was the custom SDK-free `$exception` serializer: the Rollup plugin injected PostHog chunk/release metadata into the browser bundle, but Mosaic did not copy it onto manually constructed exception events. `src/lib/posthog.ts` now mirrors PostHog core by mapping `_posthogChunkIds` to frame `chunk_id` and `_posthogReleaseId` to `$release_id`; `vite.config.ts` explicitly uses source-map `releaseMode: 'event'`. GitHub Actions Verify run 35564506345 and PostHog Browser Contract run 35564506825 both passed for `a115b48...`. Vercel deployment `dpl_9E5dkBu6vxokMc4TZrMgoWSc6qR9` is READY on deployment-only `preview` with the stable alias attached. PostHog reports a valid uploaded symbol set from the repaired build path.
Next action: In the normal external Mosaic browser/PWA where data is visible, open `https://mosaic-life-tracker-git-preview-carls-projects-72516fde.vercel.app/?__mosaic_posthog_probe=phase-3-7-exception` once while logged in. Then inspect only the new event for resolved source frames, `chunk_id`, `$release_id`, no `$ip`/`$geoip_*`, empty person profile properties, no ordinary analytics, and zero replay. If those pass, remove the temporary live probe, verify/redeploy the clean build, and evaluate the remaining Phase 3.7 live contract items before closing.
Blockers: One final browser-triggered live event is needed to validate the repaired source-map association and the newly enabled IP anonymization against PostHog's real ingestion pipeline. The Playwright workflow covers the browser/network contract deterministically but does not replace PostHog's hosted symbolication service.

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

- GitHub Actions Verify run 35564506345: success for commit `a115b48bb68e6fe11e3d10c5d2952394d04cedba`.
- PostHog Browser Contract run 35564506825: success; Chromium verified probe-before-redirect behavior, anonymous→authenticated flag requests, one authenticated handled exception, no profile fields, injected source-map metadata, and no replay/autocapture endpoints in the browser contract.
- PostHog project 619969: `anonymize_ips: true` as of 2026-09-21 05:17 UTC.
- Vercel deployment `dpl_9E5dkBu6vxokMc4TZrMgoWSc6qR9`: READY on deployment-only `preview`, commit `a115b48...`, stable alias attached, no alias error.
- PostHog source maps: valid uploaded symbol-set metadata exists for the repaired build path; final hosted symbolication remains pending one new live exception.
- Prior live probe evidence (before the repair): two handled authenticated `$exception` events arrived; person properties were `{}`; only intended exception events were present for that identity in the probe window; session recordings were zero. Those prior frames were unresolved and were enriched with IP/GeoIP because anonymization was not yet enabled.

