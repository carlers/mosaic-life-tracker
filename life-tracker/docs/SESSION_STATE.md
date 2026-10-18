# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 — day-level reconciliation after owner task changes, purely isolated investigation.

## Accepted base and safety
- Owner approved and completed v0.29.11 → dev: [PR #960](https://github.com/carlers/mosaic-life-tracker/pull/960) `dev@6ad5d271a4717e10ddd8be9ff74b846236407425`, canonical provenance CI #39124311386 passed, exact Vercel dev deployment READY; main/Production unchanged. #957 fixed and closed. #858 remains OPEN. No authorization for another dev/main/Production promotion.
- Parent non-deploying lab `chatgpt/858-calendar-reconcile-layout-lab-20261018@352e804372e3afa568ae322f53c967a97e356f36` had focused CI [#39125774450](https://github.com/carlers/mosaic-life-tracker/actions/runs/39125774450) SUCCESS and [72-sample React/layout benchmark #39125774481](https://github.com/carlers/mosaic-life-tracker/actions/runs/39125774481) SUCCESS.
- Real browser RxDB Dexie `patch()` changed the TaskDocument reference while keeping original document title unchanged. Sample metadata returned `before === after: false`, emitted old and new references, confirmed patched title. This supports strict task-reference comparisons on this path, not in-place mutable objects.
- Synthetic one-task update at 1000 tasks spread across one month: **all regenerated per-day arrays 377.8ms vs stable untouched day-array references 50.0ms React render**; 1000 same-day dense 340.3 vs 333.7ms. Recreating every task object removes benefit (380.2 vs 382.9ms). Four groups/3 repeats, CPU 2x; not real PWA.
- `startTransition` was *not* faster in heavy 1000-task cases: dense median sync ~381ms vs transition ~406ms; monthly sync ~439ms vs transition ~471ms. Forced layout-read 1–2.4ms in this proxy, so React commit/reconciliation dominates, not layout read. Lab data do not independently quantify browser paint/compositing.

## Current diagnostic
- This task `chatgpt/858-daycell-props-comparator-lab-20261018` forks prior lab SHA. Research-only `DayCell.tsx` compares all non-task props exactly; in `?dayCellCompare=1` mode compares task-by-task reference/order instead of regenerated array identity. Baseline mode retains the shallow React.memo comparator. This experimental URL flag MUST NOT reach product code or any stable branch.
- Same baseline `CalendarCarousel`, `MonthView`, `useTasksByDate` grouping, 3 rendered grids; test full local task fixture at 25/250/1000 same day, 1000 across month/years, structural refs and cloned-all task snapshots; n=3 interleaved. Log React Profiler, commit/reveal, two-frame, layout-read and DOM counts; assert changed TaskBlock and row counts. Retain real RxDB identity test and scheduling samples.
- Lab-run source is a *dev-server fixture*, not cold installed PWA, so proposed product behavior must be checked separately before any Preview.

## Next action
- Commit only diagnostic DayCell, Playwright script, branch-only workflow, and checkpoint; run exact-SHA focused and lab CI and repair failures. If data shows a consistent strong improvement, make a clean source-only comparator change based directly on `dev`, with regression tests for edits, completions, date moves, deletion, reorder, categories, shared, friend, and theme. Require focused and browser success before proposing a new Preview. Keep #858 OPEN; do not alter dev/main/Production without user approval.
