# Session checkpoint

Updated: 2026-10-01
Current task: Eliminate dead/inert task rows and stale drag runtime in Day View cross-category reordering.
Status: Implementation is on `chatgpt/fix-task-reorder-runtime`; browser/full verification and stable Preview delivery remain. Samsung/PWA manual acceptance is still required.
Next action: Finish browser verification, run exact-SHA full Quality Gate, squash into `feature/task-reorder-clean`, verify Vercel READY, then run the first-open/reopen/consecutive-drag device protocol.
Blockers: None.

## Root causes addressed
- dnd-kit's default Feedback path creates an inert hidden placeholder and promotes the real draggable node. Current experimental dnd-kit has an open cross-container React reconciliation defect in this cleanup path; the observed dark rows match inert/dead feedback shells.
- Preventing OptimisticSortingPlugin DOM reordering alone was insufficient because Feedback still owned/promoted the real task node.
- Cross-category `dragover` also moved the active `SortableTaskItem` between different `CategorySection` React parents while it was still the registered drag source.
- Sheet Day View remains mounted while closed, so the prior provider/local reorder state could survive close → reopen unless explicitly torn down.
- Committed optimistic placement previously needed stronger integrity validation and lifecycle retirement.

## Fix design
- Sheet-mode reorder runtime/provider exists only while Day View is open on the active day; close/date change destroys the registry and resets parent reorder-lock state.
- One official dnd-kit `DragOverlay` supplies feedback with `dropAnimation={null}`. Because Feedback has an overlay, it does not create a placeholder or move the real TaskItem.
- `dragover.preventDefault()` continues to block OptimisticSortingPlugin DOM reparenting.
- Real task components never change category/order during an active drag. The source stays mounted in its original category inside a collapsed wrapper; projection is represented only by a lightweight React insertion gap.
- Projection is recalculated from the immutable drag-start snapshot on each dragover, so source registration does not need to migrate groups.
- Post-drop placement renders optimistically only when it contains exactly the current live task IDs once each. Matching/invalid placement is retired in an effect, never via render-time state updates.
- Persistence generations remain serialized; failure of an older generation clears newer optimistic state derived from it.
- Browser coverage now requires no dnd placeholder during active drag, an official overlay, a still-mounted real source slot, clean runtime destruction/rebuild across close/reopen, persisted reconciliation, and immediate second-drag usability.
- No schema/Appwrite/sync-mapping changes are required.
