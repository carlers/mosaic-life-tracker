# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: The post-lift coordinate correction still leaves the live projected gap at its source position in Chromium; a temporary browser event trace is now instrumented to isolate touch delivery versus hit-testing.
Next action: Inspect the browser-only trace, repair the production sensor or projection path indicated by it, remove the diagnostic trace, then pass full canonical CI and merge to `feature/persistent-task-ordering`.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Made native touch events authoritative after long-press activation so browser pointer cancellation cannot abort an otherwise valid touch drag.
- Replaced live re-parenting with a measured projected gap so surrounding rows still shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back.
- Added DOM regressions for stable source ownership, optimistic release state, failed-write rollback, touch pointer-cancel fallback, and true touch cancellation.
- Verified stale pre-lift destination geometry is not the remaining browser failure.

## Verification
- Full non-browser checks previously green.
- Browser-only run #1463: shard 1 passed; shard 2 still failed the live task-reorder test with the gap remaining at index 0.
- Diagnostic browser-only run requested with raw touch/pointer event trace.
