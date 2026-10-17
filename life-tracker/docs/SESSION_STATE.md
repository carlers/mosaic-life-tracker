# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 jointly optimize Calendar and Todo Home first mount (owner approval). Prototype only.

## Boundary

- Accepted stable Scratch Preview v0.29.6: `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`; dev/main/Production and 1.0 unchanged. No promotion authorization.
- Candidate `chatgpt/858-local-mount-prototype-20261017` derives from accepted stable. Browser synthetic profiling only; Appwrite held, no backend writes, no deploy. Version remains 0.29.6 until justified user-testable Preview candidate.

## Verified upstream facts

- #858 CI #39034283811: 1000 persisted same-day text tasks, Calendar Home-ready 664ms, Todo 2888ms (online, 2x CPU; offline 666/2973), n=3. Calendar observer-only suppression did not improve readiness.
- Distribution CI #39035865412: 500 visible Calendar tasks 827–859ms vs 741ms outside mounted months. App-wide query remains even with no visible tasks.
- Ephemeral ablation CI #39036689557: Todo baseline / disabled DnD p50 2404/1450ms at 500 tasks and 5306/2104ms at 1000. Disabling Motion layout alone had little impact. This broke dragging intentionally and cannot ship.
- Diagnostic branch #902fe7a passed focused #39037189414 and slow startup #39037189437. These do not verify this new candidate.

## Current work / next action

- Prototype retains all Todo task content but uses one shared viewport observer, 800px overscan, and hook-safe registration only around visible rows; first 12 rows per category and active dragged source remain registered. Same markup and task actions; still must prove first-gesture after scroll, auto-scroll, Diary/shared, keyboard and cancel.
- Calendar mounts image observer/storage hooks only inside image-bearing TaskBlocks, preserving text-only appearance and image loading. Earlier observer-only suppression was inconclusive; a real readiness gain is NOT yet claimed.
- New isolated `issue-858-local-mount-prototype.yml` executes production build/PWA and offline/slow-online 0/25/500/1000 Calendar-vs-Todo diagnostic without live accounts. Inspect first CI, fix failures, compare **within-run** measurements, and reject any regression. Add targeted gesture and image correctness tests before Preview.
- Keep #858 OPEN until Calendar and Todo performance gains are demonstrated and accepted. Real authenticated Scratch sync, 401, photo-heavy data, actual installed Android/iOS PWA remain pending. #936 and #914 independent pre-1.0 gates.
