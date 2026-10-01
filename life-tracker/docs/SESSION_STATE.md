# Session checkpoint

Updated: 2026-10-01
Current task: Polish Day View task reordering to remove the visual oscillation near category pills without changing accepted reorder behavior.
Status: `feature/task-reorder-clean` commit `77c6e381643d6b7f864baac922f110c2d39c6cc4` is the accepted no-known-bugs baseline. The remaining issue is visual-only: while dragging near a category pill / first task boundary, the first task can repeatedly jump up and down.
Next action: Replace the broad category append target with a header-specific start target, add a browser regression for stable header/first-row insertion, run full canonical verification, promote back to `feature/task-reorder-clean`, and verify Preview delivery.
Blockers: None.

## Baseline
- Fresh-open task rendering is correct on the accepted Samsung/PWA check.
- Same-category and cross-category reordering work.
- Consecutive drags work.
- Legacy multi-task groups with duplicate `order: 0` render correctly.
- Stable Preview is READY for `77c6e381643d6b7f864baac922f110c2d39c6cc4`.

## Jitter diagnosis
- Each category currently registers one low-priority droppable over the entire category and interprets it as append-to-end.
- Each task row registers high-priority top/bottom droppables for before/after insertion.
- Near the category pill / first-row boundary, collision can alternate between the category target (append) and the first row's upper target (insert first).
- Those two projections move the insertion gap between opposite positions. Moving that gap shifts the first row's geometry, which can feed the next collision result and produce visible up/down oscillation.
- dnd-kit's collision priority resolves overlapping targets by priority, but it does not make two adjacent targets with different semantic destinations equivalent.

## Planned polish
- Restrict the category-level droppable to the category header/pill row instead of the entire category body.
- Make the header target mean insert-at-start. This matches the first task's upper-half target, so crossing that boundary cannot change the projected insertion slot.
- Keep row before/after targets for precise placement; the last row's lower half remains the append path.
- Empty and collapsed categories remain droppable through their header, where start and end are equivalent for empty groups and start is deterministic for collapsed groups.
- Preserve the drag proxy, overlay, immutable drag snapshot, persistence, optimistic reconciliation, and runtime teardown.
