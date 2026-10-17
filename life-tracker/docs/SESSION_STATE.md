# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 slow-network cold Home, identifying competing speculative route JS downloads.

## Current boundaries
- Stable Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4` v0.29.6: full canonical #39013268008 SUCCESS, trusted READY #39013382108; installed-device acceptance pending; no dev/main/1.0 promotion authorized.
- Isolated `chatgpt/858-defer-neighbor-preload-20261017` has **test-only disposable source mutation** and benchmark workflow, no shippable runtime change.
- Previous experiments discarded first-install SW deferral (<111ms Home and no paint improvement) and Auth route splitting (Login paint regression). Source: [#858 checkpoint](https://github.com/carlers/mosaic-life-tracker/issues/858#issuecomment-6231645081).
- Paired HTML-first import experiment [#39017677504](https://github.com/carlers/mosaic-life-tracker/actions/runs/39017677504) SUCCESS: Home ready 5713→5390ms (~323ms), but wall time / first paint unchanged, and Login FCP capture in two candidate samples was null (must not interpret its invalid median). App shell download became earlier, but ~79 JS requests still contend.

## Structural hypothesis and execution
- AppLayout preloads adjacent protected routes in a first-mount effect, including `/explore` when `/home` is displayed, with only an idle callback / 500ms timeout. This runs before RxDB ready, before Home's owner-data mark and even while AppDataShell is not mounted. The slow synthetic waterfall shows `ExplorePage`, `SetUsernameSheet`, `BottomSheet` and other route-related chunks finishing near Home readiness.
- Paired same-runner Vite production-build test temporarily disables **only the Home-neighbor preload effect**, leaving actual swipe previews/nav unchanged. Compare required JS requests, Home-ready and first paint on slow network; check controlling PWA offline repeat and fast startup too. All Appwrite calls held; synthetic empty cached account, no real private data. Only pursue product scheduling change if gain is material and swipe UX preserved.
- If confirmed, move speculative neighbor preloading behind *real usable Home data* and guard cleanup/account transition. Add targeted tests, version PATCH, focused + full canonical stable Preview and hosted manual checks. Preserve all all-route PWA precache, auth isolation, migration and backend boundaries. No dev/main without new authorization.
