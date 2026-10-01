# Session checkpoint

Updated: 2026-10-01
Current task: Rebuild owner Day View task reordering cleanly from `dev`.
Status: Implementation is on `chatgpt/task-reorder-clean` targeting stable Preview branch `feature/task-reorder-clean`; verification and delivery remain.
Next action: Run canonical verification, fix any failures, squash into the stable feature branch, then perform real-device acceptance.
Blockers: None.

## Scope
- Same-category vertical task sorting only. Cross-category task movement is intentionally deferred.
- Long-press the task title for 500 ms to activate; movement before activation remains normal scrolling/gesture input.
- The actual TaskItem follows the pointer while dnd-kit moves siblings optimistically. There is no visible grip, custom drag overlay, hidden source row, manual placeholder, or custom pointer coordinator.
- The active floating task uses the normal Mosaic background, not its category color.
- Release persists one final order; task data stores a date/category-scoped integer `order`.

## Working set
- `src/components/home/views/{DayViewSheet,DaySlide,CategorySection,SortableTaskItem,TaskItem}.tsx`
- `src/hooks/useTasks.ts`
- task schema/migration/sync/backend manifest
- interaction/browser and data regression coverage
- this checkpoint, project reference, and manual acceptance checklist

## Verification target
- Schema migration preserves existing display order by defaulting legacy tasks to order 0 and retaining createdAt-desc as the tie-breaker.
- Sync/bootstrap schema carries task order; new tasks append and reorder persistence normalizes one category group.
- Browser coverage verifies delayed activation, source movement under the finger, live sibling displacement, no disappearing rows, drop order, and real Day View sheet gesture locking.
- Final delivery requires exact-SHA canonical acceptance and a READY Vercel Preview. Real Samsung/PWA acceptance remains a separate human check.
