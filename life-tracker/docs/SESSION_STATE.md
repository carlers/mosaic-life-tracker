# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #856 — owner-approved stable Preview → dev promotion (v0.34.8).

## Accepted source, regression and approval
- The owner reports cross-day task dragging, mobile edge release and settling now work well, and explicitly approved final cleanup/polish followed by a merge to dev. Preserve issue #856's cross-day dates, task/category projections, long-held touch safeguards, neutral slot and quiet successful move.
- Accepted stable Preview `feature/cross-day-drag-856-20261020@6921e154b2e21983acc2975965cb11bddcbd9678` (v0.34.8), [PR #1117](https://github.com/carlers/mosaic-life-tracker/pull/1117). Focused/browser task Gate #39451733357 SUCCESS; full canonical Gate #39452162714 SUCCESS at attempt 3 (earlier unrelated same-day reorder flakes did not repeat on the final run). Exact-SHA Vercel deployment `dpl_4EtDD7rP4Dffur1AvZhDyKq5v8Lj` READY.
- Live `dev@0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0` is **diverged** from the original cross-day Preview: it separately accepted #953 accent-color placements v0.34.4. Do **not** overwrite that already-approved dev behavior or promote the original divergent preview directly.
- Merge authorization is for dev only; not main, Production, new backend services or v1.0.

## Integrated Preview preflight
- Integration task branch `chatgpt/856-integrate-dev-accent-20261021` derives from the accepted feature Preview and reapplies all dev-only #953 theme/pinch-zoom files by their exact approved dev Git blobs.
- Preserve v0.34.8 version in package.json, package-lock.json and appVersion.ts. Merge the one dev-only `mosaic-date-header` class into the feature's DayViewSheet, and union docs/COMPONENT_INDEX entries for crossDayTaskDrag/useContinuousTaskDrag and dev's useCalendarPinchZoom/UiColorSettings. Keep the feature checkpoint instead of replacing it with stale #953 state.
- No new task behavior, data schema, Appwrite sync or user-facing redesign. Integration must pass new focused task checks, squash into stable feature Preview, full exact-SHA canonical CI, and new Vercel READY evidence.
- Before the final approved dev merge, fail-closed preflight: check latest refs, versions, exact canonical status, READY Preview deployment, mergeability and GitHub synthetic merge-tree equality with accepted Preview tree. No production promotion. Capture merge SHA, two parents, dev CI and Vercel when available.

## Remaining manual acceptance
- Physical iOS/Android repeated drag and smooth settling, device-specific offline sync, and extreme >87-day virtual rebase remain manual. Issue #856 may remain open through production acceptance; report explicitly.
