# Session checkpoint

Updated: 2026-10-12 UTC
Current task: Mosaic #640 — first Calendar day-cell tap after reload delayed even after a minute idle; every later tap instant.

## Verified defect and fix
- User rejected prior v0.17.7-v0.19.3 stable Preview optimizations. v0.19.3 exact stable Preview commit `08da46514fae1bbaded4b6a74812d642725d4728` had canonical CI SUCCESS and Scratch Vercel READY but failed mobile perceived-latency acceptance.
- Root cause now isolated by deterministic RED/GREEN DOM regression: `loadDayViewSheet()` warmed its dynamic import but `React.lazy` remained uninitialized until the first render. Its `Suspense fallback={null}` committed **no Day View sheet** on the first synchronous React commit despite a resolved preload. Running `DayViewPreloadFirstCommit.test.tsx` against the unchanged v0.19.3 module failed (`expected null not to be null`); against the new loader passed.
- Candidate task `chatgpt/dayview-preloaded-lazy-20261012`, v0.19.4, branches from v0.19.3 stable Preview: cache the actual resolved component, choose direct component at first mount when warm, preserve the original lazy+Suspense cold path for early taps. Freeze selected component type per mount so a still-loading tap does not unmount/remount when the import resolves. Remove redundant outer Suspense wrappers in Calendar and Home Search. Preserve idle scheduling after owner data readiness, without blocking on optional friend/profile loading; no startup fetches or backend changes. Extend the real CalendarBody browser test to assert its first warmed tap paints the shell in the same React flush, not merely eventually; add a DOM regression for warmup while friend carousel remains loading.
- Reference: React docs specify lazy(load) first invokes load at first render; May 2026 React issue #36569 reproduces ~300ms first mount delay on an already-preloaded module (unconfirmed upstream). The RED/GREEN Mosaic unit test independently establishes the actual faulty rendering branch; device-sized latency is still unmeasured.

## Next action and verification
- Local new regression RED on v0.19.3, GREEN on v0.19.4, TypeScript/ESLint and Vite/PWA seven size budgets passed. Local GIPHY-enabled build also passed without relaxing limits.
- Next: run complete DOM and project/version contracts; task `[verify:browser]` GitHub run, squash into existing `perf/day-view-idle-warmup-20261011` stable Preview branch; verify exact-source canonical CI, Vercel Scratch build/alias and build info. Do not promote dev/main or close #640.
- Real-device acceptance remains separate: verify v0.19.4 first day-cell tap after reload, both immediately and after one minute idle, then repeat opens/Back/swipes/far date. If lag remains, collect actual phone tap-to-paint timing before any further architecture change.
