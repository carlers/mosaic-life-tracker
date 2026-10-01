# Session checkpoint

Updated: 2026-10-01
Current task: Restore long-press Day View task reordering and prevent task rows from disappearing when a drag starts.
Status: Complete. The verified long-press reorder fix is merged into `feature/persistent-task-ordering` and its Vercel Preview is ready.
Next action: Manual touch-device acceptance on the stable feature Preview using `docs/MANUAL_TASK_REORDER_ACCEPTANCE.md`.
Blockers: None.

## Completed substeps
- Removed the visible task reorder grip; the existing task-title gesture state machine now activates reorder only after a stationary 500 ms long-press.
- Kept native scrolling/swiping available before activation, then switched active touch movement to a non-passive native touch stream so Android pointer cancellation cannot kill an already-lifted drag.
- Changed drag snapshots to task ID/category placements while rendering current task documents, preventing drag start from replacing the visible task collection with a frozen document copy.
- Kept the source TaskItem at its original keyed position for the whole drag and moved only a same-height projected gap among non-source rows.
- Replaced moving-row hit targeting with category hit detection plus measured visible-row midpoints for deterministic insertion.
- Preserved optimistic release ordering and rollback on persistence failure.
- Updated component, gesture-hook, browser, reference, and manual-acceptance coverage for the long-press contract.
- Exact task SHA `1c1d47ff456929695a2b94a862973ad34c22f8b3` passed full Quality Gate and canonical acceptance.
- Squash-merged PR #171 into `feature/persistent-task-ordering` as `5a2572da404abe0641cd634b6d49ad72edc9e11d`.
- Vercel deployment `dpl_D8CUk4pdWPYRZqcYRQSEhHh7T7g7` for the merge SHA reached READY with no alias error.

## Verification
- Lint, unit tests, handler tests, both DOM shards, production build, dependency audit, both browser shards, and canonical acceptance passed on the exact task SHA.
- Browser coverage includes the 500 ms title long-press interaction and the real Day View Sheet + Swiper + BottomSheet nesting.
- Remaining acceptance is human/manual touch-hardware verification; no real-device check has been claimed.
