# Session checkpoint

Updated: 2026-10-01
Current task: Fix blank/dark task shells appearing immediately when Day View opens before any drag.
Status: Drag-proxy fix is implemented on `chatgpt/fix-fresh-open-task-shells`; the first full run exposed a React ref lint violation in the proxy wrapper, now fixed. Exact-SHA canonical verification is rerunning before stable Preview promotion.
Next action: Run canonical verification for the drag-proxy fix, promote it to `feature/task-reorder-clean`, verify the new Preview is READY, then repeat manual acceptance step 1 before any drag.
Blockers: None.

## Diagnosis
- The visible `TaskItem` was also the element registered with dnd-kit via `useDraggable`, and its render state was driven directly by dnd-kit's `isDragSource`.
- The device screenshot shows untouched rows rendered with Mosaic's drag-source background while their task content is absent, before the user initiated a drag.
- Browser coverage had verified drag/drop behavior after activation but did not assert that every real task row remained readable on a fresh untouched runtime.

## Fix
- Keep the title button as the 500 ms activation handle.
- Register a separate invisible full-row geometry proxy as dnd-kit's draggable element.
- Never pass dnd-kit's `isDragSource` state into the real `TaskItem`; React-owned task content remains independent of dnd-kit source feedback.
- Keep the existing official `DragOverlay`, insertion-gap projection, category drop targets, persistence, and runtime teardown unchanged.
- Add a browser regression that every task row has readable content and no task row is marked as dragging before any gesture.

## Remaining verification
- Focused/full Quality Gate.
- Stable Vercel Preview.
- Real Samsung/PWA fresh-open check, then the existing consecutive same/cross-category drag acceptance.
