# Session checkpoint

Updated: 2026-10-01
Current task: Clean up and harden the completed task-reorder/day-swipe feature before any merge from `feature/task-reorder-clean` into `dev`.
Status: Cleanup is implemented on `chatgpt/cleanup-task-reorder-before-dev`. Focused verification is green; exact-SHA full canonical verification is requested before promotion back to the stable feature branch. Nothing has been merged to `dev`.
Next action: Complete the full Quality Gate, fix any failures, squash-promote the cleanup into `feature/task-reorder-clean`, verify its stable Preview, then perform one final functional smoke test before deciding whether to merge to `dev`.
Blockers: None.

## Accepted behavior baseline
- Fresh-open and legacy multi-task rows render correctly.
- Same-category, populated cross-category, and empty-category reordering work across consecutive drags.
- The category-pill/first-row insertion boundary is visually stable.
- Quick mouse drags over task title/memo navigate days; stationary 500 ms title holds reorder.
- Neighboring Day View slides keep the same vertical geometry when becoming active.
- These behaviors were manually accepted before this cleanup and remain protected by browser contracts.

## Audit of feature branch versus dev
- Required product/data changes: task `order` schema + migration + sync/restore/backend mappings, append/reorder persistence, dnd-kit runtime, Day View gesture arbitration, and regression coverage.
- Iteration residue was concentrated in the reorder UI/runtime: a ~600-line `DaySlide`, dnd drop-surface code mixed into `CategorySection`, duplicated placement helpers/signatures, obsolete drag-source props/markers, redundant drag refs/flags, and an unused direct `@dnd-kit/helpers` dependency.
- Persistence also read more local task rows than necessary when appending or reordering.

## Cleanup
- `DaySlide` is now orchestration only; presentation, dnd runtime, droppable surfaces, and pure projection logic are separated into focused modules.
- Pure reorder target parsing/projection/equality/group derivation has unit coverage independent of browser gesture tests.
- Removed obsolete task drag-source props, dead placement helpers/signature generation, redundant dnd flags/refs, and unused diagnostics.
- Removed the unused direct `@dnd-kit/helpers` dependency and lock entry.
- Drag projection clones only source/destination task arrays rather than every category array on each target change.
- Drag lifecycle state is held in one session ref instead of three independent refs.
- Add-task and reorder persistence queries are scoped to the relevant category/day instead of reading all local task rows.
- Existing fail-closed persistence, RxDocument materialization, overlay ownership, collision geometry, optimistic reconciliation, and gesture behavior are unchanged.

## Verification
- Latest focused Quality Gate passed on `b5132ff68ab325c7025644e512002fb6164423f3`.
- Full exact-SHA Quality Gate is requested by this checkpoint.
- Stable feature promotion and Vercel Preview verification remain.
- No merge to `dev` has been performed.
