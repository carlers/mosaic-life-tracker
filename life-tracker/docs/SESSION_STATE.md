# Session checkpoint

Updated: 2026-10-01
Current task: Polish Day View task reordering to remove the visual oscillation near category pills without changing accepted reorder behavior.
Status: The no-known-bugs baseline is `feature/task-reorder-clean` commit `77c6e381643d6b7f864baac922f110c2d39c6cc4`. The jitter fix is implemented on `chatgpt/polish-task-reorder-header-jitter`; focused verification passed and full canonical verification is next.
Next action: Run exact-SHA full Quality Gate, repair any failures, squash-promote to `feature/task-reorder-clean`, verify the stable Vercel Preview is READY, then repeat the near-category-pill drag acceptance on Samsung/PWA.
Blockers: None.

## Baseline
- Fresh-open task rendering is correct on Samsung/PWA.
- Same-category and cross-category reordering work.
- Consecutive drags work.
- Legacy multi-task groups with duplicate `order: 0` render correctly.
- `77c6e381643d6b7f864baac922f110c2d39c6cc4` remains the rollback/checkpoint commit if this visual polish regresses behavior.

## Jitter root cause
- The old low-priority category droppable covered the entire category and meant append-to-end.
- Task rows use high-priority top/bottom targets for before/after insertion.
- Near a category pill / first-row boundary, collision could alternate between category append and first-row prepend.
- Once the insertion gap appeared, it could also occupy the pointer position while being non-droppable, causing a transient no-target state.
- Those semantic changes moved the gap itself, which changed row geometry and fed the next collision result, producing the visible up/down oscillation.

## Fix
- Category-level collision is restricted to the category header/pill row.
- Header drops mean insert-at-start, matching the first row's upper-half target.
- Header spacing is inside the header droppable so there is no small dead strip immediately below the pill.
- The React-owned insertion gap is now a droppable for its exact projected index. Header, adjacent row halves, and the gap therefore resolve to the same insertion index around a boundary.
- True no-target movement keeps the last valid visual projection stable, while release outside a valid target still commits nothing.
- The last row's lower half remains the append path; empty and collapsed categories remain droppable through their header.
- Drag proxy ownership, overlay behavior, immutable drag snapshot, optimistic reconciliation, persistence validation, and runtime teardown are unchanged.

## Verification
- Focused checks passed after the implementation.
- Browser regression added for moving between category header, first-row boundary, and the projected gap without layout oscillation, then releasing on the gap.
- Existing empty-category, same-category, populated cross-category, consecutive-drag, cancel, legacy-order, and runtime-rebuild coverage remains in place.
- Full canonical verification and stable Preview promotion remain.
