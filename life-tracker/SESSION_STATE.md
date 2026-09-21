# Session state

Updated: 2026-09-21
Current task: Phase 3.7 PostHog foundation complete; next is Phase 4 manual accessibility verification
Status: Phase 3.7 is complete. Hosted PostHog ingestion is proven, the repaired production exception resolved both frames back to `src/lib/posthog.ts`, authenticated events carry no person profile properties, no ordinary product analytics or session recordings were produced, and project IP discard is enabled. The temporary live exception probe has been removed. Commit `8d03923d36bf17b009667b4f8f036d0d0de8693e` is the clean application checkpoint and is READY on the stable `preview` alias.
Roadmap pointer: Phase 3.7 is checked complete. Next is the manual/browser WCAG protocol in `docs/ACCESSIBILITY_AUDIT.md`; calendar-grid semantics and A11Y-33 remain separate later batches.
Checkpoint: The source-map failure was caused by Mosaic's SDK-free exception serializer omitting PostHog's injected chunk/release metadata. `src/lib/posthog.ts` now attaches frame `chunk_id` and event `$release_id`; `vite.config.ts` uses PostHog event release mode. A hosted event from app commit `a115b48...` resolved both frames to `../../src/lib/posthog.ts`. The clean no-probe commit `8d03923...` passed canonical Verify run 35568141824 and PostHog Browser Contract run 35568141909, and Vercel deployment `dpl_2NEUwTifcrWqpg8t2mDnA7rqvjbX` is READY on deployment-only `preview`. A fresh valid source-map symbol set uploaded at 2026-09-21 06:24:57Z for the clean build.
Next action: Run the manual accessibility protocol in `docs/ACCESSIBILITY_AUDIT.md`: keyboard-only traversal, screen-reader names/roles/states/live announcements, 200% zoom/~320 CSS px reflow, phone touch targets, rendered contrast, and non-gesture alternatives. Close the WCAG roadmap checkbox only after those browser checks are recorded.
Blockers: None for Phase 3.7.

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
- `tests/e2e/posthog-browser.spec.mjs`
- `.github/workflows/posthog-browser-contract.yml`
- `docs/PROJECT_REFERENCE.md`
- `PLAN.md`
- `SESSION_STATE.md`

## Verification

- Hosted source-map evidence: event `01a0c29d-a89b-7e83-b103-f72d70a0d384` carried release `01a0c26d-9254-0000-5ac2-f15cc532199c`; both app frames were `resolved: true` to `../../src/lib/posthog.ts`.
- Live identity/privacy evidence: the authenticated PostHog person properties object is `{}`; recent events for that distinct ID were only the intentional `$exception` probes; session-recordings query returned zero results.
- IP discard: PostHog project 619969 has `anonymize_ips: true`; the post-change live events contain no raw `$ip` property. GeoIP-derived fields can still appear and are distinct from retained raw IP.
- Browser behavior: PostHog Browser Contract run 35568141909 passed and verifies anonymous → authenticated flag refresh, fresh anonymous identity after logout/reset, re-identification refresh, minimal flag request bodies, exception metadata, and absence of replay/autocapture request paths.
- Canonical application gate: GitHub Actions Verify run 35568141824 passed for clean commit `8d03923d36bf17b009667b4f8f036d0d0de8693e`.
- Hosted clean checkpoint: Vercel deployment `dpl_2NEUwTifcrWqpg8t2mDnA7rqvjbX` is READY on `preview`, exact commit `8d03923...`, stable alias attached, no alias error.
- Clean source-map upload: PostHog symbol set `01a0c2a3-9cb8-0000-6926-9f576fc32044` is valid and was uploaded at 2026-09-21 06:24:57Z.
