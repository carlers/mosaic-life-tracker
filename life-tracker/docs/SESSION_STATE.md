# Session checkpoint

Updated: 2026-10-12
Current task: issue #655 — measurable PWA update asset preparation progress, task branch and stable Preview only (no dev/main promotion).

## #655 approved implementation
- Base: dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1. Stable Preview: `feature/pwa-progress-655`; repair task branch: `chatgpt/pwa-progress-655-repair`. No dev/main promotion authorized.
- Preview v0.20.0: compiled custom Workbox `injectManifest` SW measures cache-preparation progress by actual uncompressed emitted file sizes or file count; browser-managed install/activation has indeterminate status. No duplicate downloads or forced activation. Existing push and offline-cache contracts remain required.
- Original [PR #659](https://github.com/carlers/mosaic-life-tracker/pull/659) was squash-merged into stable Preview at 52943d014d63fb594985dccf20b31e327c714c33; full CI and Vercel failed. Issue #655 has delivery plan.
- Repair: adapt the compiled-service-worker inspector to Vite's static template literals (a build-policy test issue); update one lifecycle snapshot test; and fill bytes for plugin-supplied additional precache assets via a post-generation script using emitted `dist` sizes. New regression tests cover these contracts.
- Size review: task-startup and GIPHY-enabled Vercel aggregate thresholds narrowly reviewed under #655; PWA policy unchanged. Verify exact Preview CI and deployment before testing.
- Automated verification: original task focused green. Repair full CI and final stable Preview canonical/Vercel checks pending; no device acceptance claimed.
- Next: complete repair CI, address any budget/build errors without weakening safeguards, squash repair to `feature/pwa-progress-655`, confirm exact-SHA canonical+Vercel READY, and hand off for device testing. `dev` and `main` remain untouched.

## Previous workstream checkpoints

Updated: 2026-10-12
Current task: Issue #645 Phase 2 D1/D2 repository source discovery pilot; user authorized task branch and stable Preview, not dev/main merge.

## Scope and exact base
- Base: dev@deb497fa032e7e95842f1e79f3a77b45bf3f369e; source-only documentation/tooling changes, no app version bump.
- Task: chatgpt/repo-discovery-645; stable Preview: refactor/repo-discovery-645.
- Existing Phase 1 version-only focused selector remains accepted separately on refactor/focused-version-stamps-645; do not pull it into this branch implicitly.
- Preserve Scratch/Production separation, Preview canonical gate and explicit promotion approvals. The global checkpoint on dev previously referred to Bucket List #405; its completed dev promotion is live Git truth.

## Work
- D1: docs/REPO_MAP.md is a concise optional user-intent-to-source starting hint; docs/README.md links it.
- D2: docs/COMPONENT_INDEX.md indexes all eligible component/page TS modules plus App and protectedRoutes, grouped by source folder. scripts/lib/repo-component-index.mjs and scripts/generate-repo-index.mjs implement offline --write/--check; existing contracts reject stale inventory. Tests cover current completeness, determinism, additions/moves/deletions and Markdown path escaping.
- No runtime behavior, app styles, Appwrite configuration, dependency additions or CI-gate weakening.

## Next action
- Confirm this task commit focused CI green, review exact PR diff, squash through task PR into stable refactor/repo-discovery-645, then verify full canonical acceptance and exact-SHA Vercel READY. Post evidence to issue #645; leave dev/main untouched. D3 isolated cold-chat discovery measurement remains separate and pending.


## #640 device-accepted Day View first-open fix — dev promotion integration
- On 2026-10-12 the user explicitly accepted version 0.19.4 on device and authorized merging into dev.
- Original stable Preview: perf/day-view-idle-warmup-20261011 @ 50437830c719a2ded06132b86e27dcb609733ed4, full canonical https://github.com/carlers/mosaic-life-tracker/actions/runs/38163183012 SUCCESS, Scratch Vercel exact-SHA READY.
- Because dev advanced independently, integrate that verified Day View tree with current dev rather than merging the stale Preview directly. Preserve dev's #405 reviewed build-size ceilings, latest unrelated functionality and documentation; preserve exact accepted v0.19.4 behavior. Re-verify integrated Preview and exact-SHA dev promotion. #640 issue carries detailed evidence.
- Exact GIPHY-enabled integration build crossed only three aggregate asset/precache size caps (raw +6124 B, gzip +1345 B, precache +6275 B); three caps narrowly reviewed under #640, retaining unchanged entry/initial/Home limits and baseline. Run hosted Scratch parity before promotion.
