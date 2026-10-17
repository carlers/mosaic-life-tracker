# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 structural Calendar and Todo local-first cold startup — v0.29.8 preloaded-app-shell Preview candidate.

## Approved boundary

- User requested a structural audit and faster default Calendar mount, explicitly retaining both Calendar and Todo optimization as #858 scope. Existing v0.29.7 Scratch Preview `perf/858-startup-diagnostics-20261017@34ac29ed0790ea796c9d350c9da2796b2ab29e7a` remains the accepted starting point; canonical #39044763288 and trusted Preview #39044882214 SUCCESS.
- This task changes only initial `AppDataShell` **already-preloaded module reveal**, with unchanged task queries, RxDB schema, account identity, sync behavior, Calendar/Todo visual tree and network boundaries. Maintain the `React.lazy` import, Suspense loading UI and original failure/retry behavior when the module is not loaded. Do not prematurely mount RxDB-backed providers before the protected-route DB-ready gate.
- Release candidate version 0.29.8 (new user-testable PATCH iteration). No dev/main/Production/backend/1.0 promotion approval.

## Measured causal evidence

- [Isolated critical path #39048530590](https://github.com/carlers/mosaic-life-tracker/actions/runs/39048530590) SUCCESS: with cached-PWA mobile Chromium 2× CPU, synthetic owner IndexedDB 0/25/1000 tasks, n=3, offline/slow online, DB ready ~160–184ms and `AppDataShell` module ready ~144–153ms; `HomePage` doesn't mount until 492–517ms. The ~333–335ms DB→Home wait persists at 0 tasks and both connection modes, excluding query/render/network as its main explanation. No physical-device claim.
- [Four-way same-bundle Suspense A/B #39049692367](https://github.com/carlers/mosaic-life-tracker/actions/runs/39049692367) SUCCESS: original nested lazy boundaries vs bypass Home only vs bypass `AppDataShell` only vs both. Slow-online Home-owner-ready p50 for 0/25/1000 tasks: original 587/578/719ms, **direct preloaded shell only 284/300/478ms** (saving 303/278/241ms). Home-only direct 560/570/724ms (minor/none). First 1000-task DOM 770→528ms, all preview tasks retained. Offline for 1000 727→493ms. This is an isolated causal diagnostic, not manual acceptance; interaction/lazy failure edge cases remain.
- Focused experiment checkpoint #39049775650 SUCCESS after fixing a diagnostic-only docs heading. Direct-loaded-shell effect chosen for a narrow production candidate; Home's own nested lazy route remains untouched.

## New task change

- Task branch `chatgpt/858-direct-preloaded-shell-20261017` from stable v0.29.7.
- `src/components/layout/routeModuleLoaders.ts`: export a synchronous read-only `AppDataShell` component snapshot, subscriber and notifications after the existing cached import finishes. No independent second module import or cache.
- `src/components/layout/AppLayout.tsx`: `useSyncExternalStore` subscribes to that snapshot in protected AppLayout. Once cached user, database and module are ready, mount directly rather than re-suspending. When the module isn't resolved, preserve the **exact existing lazy component and Suspense** (including failed load path); do not replace it with an indefinite custom spinner. The original `AppDataShell` children and route swipe props remain.
- `tests/components/AppDataShellPreload.test.tsx`: regression for memoized module, once-only listener, already-loaded first React commit and a preloading in-flight subscriber. Existing browser shards must verify route gestures, account and offline fallback.
- Update package/package-lock/appVersion to 0.29.8 once; no unrelated styling or infrastructure edits.

## Next action

- Run task focused+browser checks, resolve any lint/types/react/react-router failures with a scoped repair; compare build/PWA metrics against v0.29.7. After task gate green, create PR to existing `perf/858-startup-diagnostics-20261017`, squash only the candidate and run full canonical checks + trusted Scratch Preview READY. Never promote to dev/main/Production until explicitly approved.
- Independently verify real authenticated and installed device cold-start with cached 0/25/100/500/1000 and distributed tasks, offline/slow/401/account switching, first task interactability, Diary/shared/photos/drag after scroll, iOS/Android. #858 remains OPEN until those are accepted. #936 privacy and #914 backend compatibility are independent pre-1.0 gates.
