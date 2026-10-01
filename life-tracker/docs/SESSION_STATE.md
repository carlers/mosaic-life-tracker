# Session checkpoint

Updated: 2026-10-01
Current task: Polish Day View task reordering to remove the visual oscillation near category pills without changing accepted reorder behavior.
Status: Automated implementation and delivery are complete on `feature/task-reorder-clean`. Stable commit `9cee1ac448212fdbeb917a68bfce9ba26f35fe56` passed the full canonical Quality Gate and its Vercel Preview is READY. Real-device Samsung/PWA visual acceptance of the near-category-pill drag zone remains.
Next action: On the stable Preview, repeatedly drag a task across the category pill / first-task boundary and release both on the pill-side start slot and inside the projected gap. Confirm there is no repeated up/down oscillation and normal same/cross-category behavior remains intact.
Blockers: None.

## Checkpoints
- `77c6e381643d6b7f864baac922f110c2d39c6cc4` is the accepted no-known-bugs functional baseline before this visual polish.
- `9cee1ac448212fdbeb917a68bfce9ba26f35fe56` is the current polished stable commit.

## Jitter root cause
- The old low-priority category droppable covered the whole category and meant append-to-end.
- Task rows use high-priority top/bottom targets for before/after insertion.
- Near a category pill / first-row boundary, collision could alternate between category append and first-row prepend.
- Once the insertion gap appeared, it could occupy the pointer position while being non-droppable, causing a transient no-target state.
- Those target changes moved the gap itself, which changed row geometry and fed the next collision result, producing the visible up/down oscillation.

## Fix
- Category-level collision is restricted to the category header/pill row.
- Header drops mean insert-at-start, matching the first row's upper-half destination.
- Header spacing is included in the header droppable so there is no small dead strip directly below the pill.
- The projected insertion gap is itself a droppable for its exact insertion index. Header, adjacent row halves, and the gap therefore agree on the same destination around a boundary.
- True no-target movement keeps the last valid visual projection stable; release outside a valid target commits nothing.
- The last row's lower half remains the append path; empty and collapsed categories remain droppable through their header.
- Drag proxy ownership, overlay behavior, immutable drag snapshot, optimistic reconciliation, persistence validation, and runtime teardown remain unchanged.

## Verification
- Task-branch exact-SHA full Quality Gate passed on `03ee06815029ae5cb0c848d61af749499d9afdcb`.
- Stable feature full Quality Gate passed on `9cee1ac448212fdbeb917a68bfce9ba26f35fe56`, including both Chromium browser shards.
- Browser regression covers moving between the category header, first-row boundary, and projected gap without layout oscillation, then releasing on the gap.
- Existing empty-category, same-category, populated cross-category, consecutive-drag, cancel, legacy-order, and runtime-rebuild coverage remains green.
- Vercel deployment `dpl_Hvsbf5X9TsrzMMG4sDybebUKFemD` is READY on the stable feature alias.
- Real-device Samsung/PWA visual acceptance has not yet been claimed.
