# Session checkpoint

Updated: 2026-10-01
Current task: Clean up and harden the completed task-reorder/day-swipe feature before any merge from `feature/task-reorder-clean` into `dev`.
Status: Cleanup is complete on `feature/task-reorder-clean`. Stable code commit `25b3645cb797c65b40a77eff46d13397683d0f72` passed the full canonical Quality Gate and its Vercel Preview is READY. Nothing has been merged to `dev`.
Next action: Run one final smoke test on the stable Preview covering same-category reorder, cross-category reorder, category-boundary dragging, mouse day swipe from task text, and adjacent-day spacing. If accepted, decide whether to merge `feature/task-reorder-clean` into `dev`.
Blockers: None.

## Accepted behavior
- Fresh-open and legacy multi-task rows render correctly.
- Same-category, populated cross-category, and empty-category reordering work across consecutive drags.
- The category-pill/first-row insertion boundary is visually stable.
- Quick mouse drags over task title/memo navigate days; stationary 500 ms title holds reorder.
- Neighboring Day View slides keep the same vertical geometry when becoming active.
- These behaviors were manually accepted before the cleanup and remain protected by browser contracts.

## Cleanup completed
- Reduced `DaySlide` from the accumulated reorder implementation to a small orchestration component.
- Split presentation, dnd runtime, droppable geometry, and pure reorder projection into focused modules.
- Added pure unit coverage for target parsing/projection/equality/affected-group derivation; retained browser tests for gesture/collision/runtime regressions.
- Removed obsolete drag-source props, duplicate state flags/refs, dead placement helpers/signature generation, and unused diagnostic DOM markers.
- Removed the unused direct `@dnd-kit/helpers` dependency and lock entry.
- Drag projection now clones only source/destination task arrays instead of all category arrays on each target change.
- Drag lifecycle state uses one session ref rather than three independent refs.
- Add-task persistence reads only the relevant date/category rows; reorder persistence reads only the affected user/day rather than every local task.
- Existing schema migration, sync/restore/backend order mappings, fail-closed persistence, RxDocument materialization, overlay ownership, collision geometry, optimistic reconciliation, and gesture behavior remain unchanged.

## Verification
- Cleanup task branch full Quality Gate passed on `db69f768b977677c0980b1b387a2e5071d649026` after rerunning one unrelated `restoreData.test.ts` timing failure; the rerun passed all unit/handler checks.
- Stable feature full Quality Gate passed on `25b3645cb797c65b40a77eff46d13397683d0f72`: checks, build, both DOM shards, both Chromium shards, dependency audit, and canonical acceptance are green.
- Stable Vercel deployment `dpl_DPyAC1xo4yY556FbPNWdGtHNS4Ky` is READY.
- Build-size comparison versus the pre-cleanup feature baseline: app assets decreased from 2,147,439 B to 2,141,502 B raw (-5,937 B), from 649,765 B to 648,458 B gzip (-1,307 B), and precache unique bytes decreased by 5,937 B. Entry size is effectively unchanged.
- No merge to `dev` has been performed.
