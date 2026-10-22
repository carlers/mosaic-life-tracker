# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: #1245 v0.43.7 nested-sheet prop-stability Preview repair for cross-day drag.

## Accepted baseline and candidate
- `dev@fcfd860c3bc4d975ab62ac5b6523ad3b206c03f6` v0.43.6 is the prior owner-accepted baseline. `main@c938c825370f8270b46f19119b06a1f74d35842b` unchanged.
- v0.43.7 task #1258 `7f22b34e652245b8393b5936bcf695c308f6bba4` focused and both browser shards passed on CI attempt 2. Squashed to stable Preview `perf/1245-day-slide-prop-stability-v0437-20261022@9d9657694de0e0e46bb3719362483503fc3d7107` with identical tree.
- Stable canonical Quality Gate #39808662909 failed one browser shard on cross-day held touch drag; all static, build, audit, DOM, and other browser tests passed. Do NOT treat this SHA as accepted or deployed.

## Root cause isolation (disposable Ubuntu/Chromium sandbox)
- The cross-day destination insertion test timed out intermittently on the v0.43.7 candidate; two targeted diagnostic repetitions at 60s also hung after beginning the move back from the day-edge into destination rows. The same exact instrumented test on untouched dev v0.43.6 passed in ~9s.
- Reverting ONLY the new `DaySlideWithDiaryPlacement` memo wrapper to direct `DaySlide` with original inline `normalizeDiaryPlacement` / `onMoveDiary` made the previously failing targeted test pass. Three more repeated runs passed, all without changing the gesture test or release timeout. Memo wrapper breaks live cross-day projection in this code path.
- Keep the safe v0.43.7 changes: timestamp-display memoization keyed by real preferences, stable empty owner label map, shared-task callback identity, and reorder-active callback identity. Remove the memo wrapper and its unit test, and update the generated component index. Per-date Diary placement references remain intentionally unoptimized pending a drag-safe design.
- Retain the opt-in 50/200-task real Day View Memo/Task Actions/Add Photo profiler. Earlier synthetic dev-mode timings were mixed/noisy; do not claim a numerical speedup.

## Delivery
- Repair task branch `chatgpt/1245-v0437-cross-day-drag-compatibility-20261022` starts from rejected stable SHA `9d965769`; target the same existing stable Preview branch through normal focused [verify:browser] then squash.
- Version remains v0.43.7: this fixes an unaccepted candidate, not a new successful user-facing version.
- Require full canonical quality gate and exact-SHA Vercel READY before calling the stable Preview accepted; no direct `dev`/main/Production promotion. Keep #1245 OPEN for manual phone verification and further benchmarks.
