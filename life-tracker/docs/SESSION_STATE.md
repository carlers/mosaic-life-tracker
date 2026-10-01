# Session checkpoint

Updated: 2026-10-01
Current task: Rebuild Day View task reordering so same-category and cross-category drags remain stable across repeated use.
Status: Implementation is on `chatgpt/task-reorder-draggable-droppable`; exact-SHA canonical verification and stable Preview promotion remain.
Next action: Run the full Quality Gate on the exact task-branch SHA, repair any failures, then squash-promote into `feature/task-reorder-clean`, verify Vercel READY, and run the Samsung/PWA manual reorder protocol.
Blockers: None.

## Implementation
- Task rows no longer use `useSortable` or dnd-kit's `OptimisticSortingPlugin`.
- Each task uses plain `useDraggable`; the title remains the only drag handle and keeps the 500 ms hold/tolerance sensor.
- Each visible row exposes high-priority top/bottom droppable halves for before/after insertion; each category surface is a lower-priority append target for populated, empty, and collapsed categories.
- The provider uses one official `DragOverlay`; dnd-kit's Feedback plugin targets that overlay, so it does not create a placeholder or move/reparent the real task row.
- The real source task stays mounted in its original React parent inside a collapsed source slot. Only a lightweight insertion gap moves during drag.
- Projection is recalculated from the immutable drag-start placement and the current droppable target; release persists only the final source/destination groups.
- Existing fail-closed persistence, optimistic reconciliation, sheet-runtime teardown, and normal Mosaic overlay background are preserved.

## Verification
- Existing browser contracts cover same-category reorder, cross-category insertion, empty-category drop, immediate second drag, pre-hold movement cancellation, sheet gesture locking/cancel, and close/reopen runtime rebuild.
- Initial full Quality Gate run #1520 exposed and confirmed three implementation defects: render-time droppable ref access, nullable drag-source typing, and an incorrect Feedback override that disabled the official overlay. All three are fixed; exact-SHA canonical rerun is pending.
- Real-device Samsung/PWA acceptance remains required after stable Preview delivery.
