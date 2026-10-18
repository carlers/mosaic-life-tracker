# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 Todo idle drag/Motion and offscreen passive-target structural performance, diagnostic only.

## Approved boundary
- User requested continued structural optimization research: scale task loading/rendering intelligently, avoid marginal CSS tweaks, investigate actual parallelism. Keep #858 OPEN; v0.29.8 dev `bfb0fff0c1c283f599f32db8c2a426416fa65e7b` unchanged.
- No new stable Preview/dev/main/Production/1.0/backend approval; no experimental source may be shipped. This branch `chatgpt/858-idle-motion-lab-20261018` forks successful prior diagnostic `chatgpt/858-render-graph-lab-20261018@67b6fde56c753765de6a3bdec5594659cce04936`.

## Verified trigger
- [Same-binary render-graph CI #39101668402](https://github.com/carlers/mosaic-life-tracker/actions/runs/39101668402) SUCCESS, 147/147 synthetic cached-PWA, 2x CPU browser samples, all active-row cardinality assertions. Todo same-day 25/250/1000 startup p50 baseline 694/910/1592ms vs disabling drag runtime 620/814/1255ms; completely inert task rows 630/668/774ms. 1000 spread month baseline 952ms vs active-day-only 778ms. Calendar active-month-only 1000 month 746→659ms, but swipe safety is unverified. These options remove gestures, task controls, or eager neighbors, and cannot ship.
- Existing `useTaskReorderProximity` gates offscreen dnd-kit hooks but `TaskRowDropSurface` still creates two inert passive drop-target elements per offscreen row and Framer Motion layout wrappers on idle draggable rows. More targeted causes need A/B measurement rather than dropping drag.

## This diagnostic
- On synthetic-owner, test-only localStorage variants, keep `TaskReorderRuntime`, task controls and real dnd hooks mounted: `no-passive-targets` removes only inert offscreen absolutely positioned elements; `no-idle-motion` delays Framer layout animation until actual drag, Diary settle or task release; `no-idle-motion-no-passive` combines. The previous destructive `no-dnd` remains a reference ceiling only. The synthetic owner guard plus `VITE_MOSAIC_858_SCALING_LAB=1` prevent these branches in non-lab builds.
- Test 0/25/250/1000 dense and 1000 across month, 3 repetitions × five Todo variants × slow online, plus 1000 dense offline controls (90 full launches). Validate real RxDB persisted cardinality, all selected-day task row DOM counts, query->Home and first Add DOM response. No altered real user data or Appwrite calls. This does not prove touch/drag correctness or actual first paint.

## Next action
- Verify focused gate and own CI, repair any test issue. Compare matched medians and DOM counts in same binary. If narrow variants materially improve normal 25/250 scaling, construct a separately scoped behavior-preserving candidate branch and run browser regression for *first* 500ms long press, consecutive cross-category drags, edge auto-scroll, Diary/shared/photo heights and account isolation; device/manual acceptance remains required. No stable Preview or promotion without approval. Preserve existing 1.0 gates #936 and #914.
