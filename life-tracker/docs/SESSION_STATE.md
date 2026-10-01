# Session checkpoint

Updated: 2026-10-01
Current task: Restore long-press Day View task reordering and prevent task rows from disappearing when a drag starts.
Status: Long-press reorder repair and regression coverage are implemented on `chatgpt/restore-task-long-press-reorder`; stable Preview/manual device acceptance remains.
Next action: Deliver through `feature/persistent-task-ordering`, then run the manual touch acceptance checklist on the stable Preview.
Blockers: None.

## Completed substeps
- Removed the visible task reorder grip; the existing task-title gesture state machine now activates reorder only after a stationary 500 ms long-press.
- Kept native scrolling/swiping available before activation, then switched active touch movement to a non-passive native touch stream so Android pointer cancellation cannot kill an already-lifted drag.
- Changed drag snapshots to task ID/category placements while rendering current task documents, preventing drag start from replacing the visible task collection with a frozen document copy.
- Kept the source TaskItem at its original keyed position for the whole drag and moved only a same-height projected gap among non-source rows.
- Replaced moving-row hit targeting with category hit detection plus measured visible-row midpoints for deterministic insertion.
- Preserved optimistic release ordering and rollback on persistence failure.
- Updated component, gesture-hook, browser, reference, and manual-acceptance coverage for the long-press contract.

## Verification target
- Focused component coverage pins the 500 ms activation boundary, pre-threshold movement cancellation, non-dragged row visibility, stable source mounting, optimistic persistence, rollback, and touch cancellation ownership.
- Browser coverage pins long-press movement/release and the real Day View Sheet + Swiper + BottomSheet nesting.
- Final delivery requires exact-SHA canonical acceptance and a ready Vercel Preview; manual touch hardware acceptance remains separate.
