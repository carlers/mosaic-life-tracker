# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: Chromium tracing proved title long-press ownership is cancelled by native pan arbitration; task reordering now uses the same dedicated touch-owned grip pattern as category reordering.
Next action: Pass browser verification for the grip-owned drag, remove any remaining failures, then run full canonical CI, squash-merge into `feature/persistent-task-ordering`, and verify Vercel Preview.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Replaced the unreliable title long-press sensor with a dedicated task reorder grip using `touch-none`, matching the proven category-reorder ownership model while preserving normal task-title scrolling/taps.
- Unified active dragging on the pointer stream; the grip prevents browser pan takeover so movement is no longer lost to touch `pointercancel`.
- Replaced live re-parenting with a measured projected gap so surrounding rows shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back; persistence rejection rolls back to live order.
- Added DOM coverage for grip ownership, stable source mounting, optimistic release state, failed-write rollback, and cancellation.
- Updated the real-browser contract and manual acceptance to use the task grip, and removed the temporary event trace.

## Verification
- Previous full non-browser checks were green.
- Browser trace run #1464 confirmed Chromium emitted a single pointer move followed by pointer cancellation and no native touchmove for the title-based gesture.
- Browser-only verification pending for the dedicated grip implementation.
- Hosted Preview/manual mobile acceptance pending stable-branch merge.
