# Session checkpoint

Updated: 2026-10-01
Current task: Fix remaining blank task rows in categories containing multiple legacy tasks and harden reorder rendering edge cases.
Status: Root cause is confirmed and the repair is implemented on `chatgpt/fix-multi-task-legacy-order-render`. Browser coverage performs consecutive cross-category drags from migrated RxDocument-like groups whose initial orders are all zero. Plain task inputs retain object identity to avoid unnecessary cloning; only RxDocuments are materialized. Exact-SHA full canonical verification is running before promotion to `feature/task-reorder-clean`.
Next action: Complete canonical verification, promote the accepted fix to the stable feature branch, verify Vercel READY, then repeat fresh-open and consecutive reorder acceptance on Samsung/PWA.
Blockers: None.

## Root cause
- `useRxCollection` exposes RxDB query results directly, so Day View receives real `RxDocument` instances even though the public TypeScript shape is `TaskDocument`.
- The task-order v2 migration intentionally assigns every legacy task `order: 0` so old created-at ordering is preserved until a user first reorders that group.
- DaySlide's render placement normalizes visible positions to `0..n-1`. For the second and later task in a legacy multi-task category, the positional order therefore differs from the stored `order: 0`.
- That mismatch path used `{ ...task, categoryId, order }`. RxDB schema fields such as `id`, `title`, and `completed` are prototype-backed getters on `RxDocument`, so spreading the document omitted them. The result was a structurally present TaskItem with a checkbox but no title/content.
- Moving another task out of the category normalized/persisted the affected group, removing the order mismatch and making the blank row appear to repair itself.

## Fix
- Materialize every DaySlide task exactly once at the runtime boundary: use RxDB `toJSON()` when available, otherwise clone an already-plain task.
- Build placement, rendered rows, overlays, action callbacks, and optimistic category/order overrides from those plain snapshots only.
- Preserve the existing legacy equal-order tie-breaker; opening Day View does not silently rewrite task order.
- Keep the drag proxy, title long-press handle, official overlay, insertion gap, category targets, fail-closed persistence, and runtime teardown unchanged.
- Add unit coverage for RxDocument-backed materialization, duplicate legacy orders, and optional task fields.
- Add browser coverage using RxDocument-like tasks with every legacy order set to zero; all rows must be readable before any drag.

## Edge cases covered
- Two or more legacy tasks with equal `order: 0`.
- Gapped/non-normalized order values before first reorder.
- Cross-category optimistic placement while live RxDB still reports the old category/order.
- Memo/image/reaction fields surviving materialization.
- Empty categories and source-category-emptying behavior remain covered by existing reorder tests.
- Consecutive same-category/cross-category drags and fresh-open runtime rebuild remain covered.
