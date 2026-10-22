# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: #1245 v0.43.7 Day View memoized prop stability and opt-in real-overlay diagnostics.

## Baseline
- Owner accepted v0.43.6 nested-sheet row jitter fix and explicitly authorized a further optimization exploration.
- `dev@fcfd860c3bc4d975ab62ac5b6523ad3b206c03f6` v0.43.6, fully accepted through PR #1255. Main remains `c938c825370f8270b46f19119b06a1f74d35842b`.
- Earlier #1245 fixes: retained Diary exit, timely parent settling, stable task/category DOM ownership, and no Day View ancestor scaling under nested overlays. Preserve these contracts.
- Real Day View profiling in disposable 2-vCPU Ubuntu / Chromium / Vite dev mode exposed repeated DaySlide prop-reference churn, especially in an empty shared-owner label map, display timestamp object, shared-task handlers, reorder status handler and per-day Diary placement/handler. Dev-mode CPU measurements are not real-phone speed or a shipping performance budget.

## Scoped implementation
- Stabilize timestamp-display object by the three primitive preferences, preserving edits to those preferences.
- Keep one stable empty owner-label map when the calculated map has no entries; preserve nonempty owner labels and future share updates.
- Stable callbacks for shared move error, leaving a shared task, and task reorder active state with their actual dependencies.
- Introduce a small memoized per-date Diary slide adapter: memoize normalized saved Diary placement and keep its write handler stable by `dateStr` + `setSetting`. It forwards changed saved placement, date, current writer and every ordinary DaySlide prop—no unsafe custom comparator or stale value omission.
- Extend opt-in performance probe to 50/200 task real Day View Memo / Task Action / Add Photo open/close; no hard performance CI threshold and no browser correctness assertions for decorative frame timing.
- New DOM behavior test verifies identical input rerenders are skipped but changed Diary placement, writer and date propagate.
- v0.43.7 version triplet. No backend/schema, Task Action height, global BottomSheet, dev/main/Production changes.

## Verification and delivery
- Sandbox exploratory benchmarks and separate baseline/optimized comparisons showed mixed/noisy results; no consistent numerical speedup claim. Code changes must pass focused TS/lint, DOM adapter behavior, Diary/nested browser contracts, production size build and task [verify:browser].
- Target task branch: `chatgpt/1245-day-slide-prop-stability-v0437-20261022` from dev `fcfd860`; stable Preview: `perf/1245-day-slide-prop-stability-v0437-20261022` from the same dev head.
- After focused green, squash task into stable Preview, require canonical full gate + exact-SHA Vercel READY. No promotion to dev/main or Production unless separately approved.
- Manual phone acceptance and production-like profiling remain outstanding. #1245 OPEN.
