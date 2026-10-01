# Session checkpoint

Updated: 2026-10-01
Current task: Rebuild owner Day View task reordering cleanly from `dev`.
Status: Complete. The clean dnd-kit implementation passed exact-SHA canonical acceptance and was squash-merged into `feature/task-reorder-clean` as `23a11c5dabd8a3eedb4e3817c027258f725cf5e2`.
Next action: Real-device manual acceptance on the final stable feature Preview using `docs/MANUAL_TASK_REORDER_ACCEPTANCE.md`.
Blockers: None.

## Delivered
- Same-category vertical task sorting only; cross-category transfer remains intentionally deferred.
- The task title is the invisible handle: hold stationary for 500 ms to activate, while movement before activation remains available to native scrolling/gestures.
- dnd-kit owns drag activation, top-layer task feedback, sibling displacement, drop animation, and final sortable index. Mosaic no longer has a custom pointer coordinator, manual hit testing, hand-built placeholder, hidden source-row choreography, or duplicate drag overlay.
- The active task uses Mosaic's normal background and stays glued to the pointer while siblings remain visible and move aside.
- Release persists exactly one final date/category-scoped integer task order; new tasks append and the first completed reorder normalizes the group.
- RxDB schema/migration, sync mapping, friend-calendar mapping, backup restore, portable Appwrite manifest, and production Appwrite `tasks.order` rollout all carry the order field. The live remote column is optional integer `0..999999`, default `0`, and is `available`.
- Existing rows preserve their previous newest-created-first display because legacy/missing order defaults to `0` and `createdAt` remains the tie-breaker until the group is explicitly reordered.
- Build-size budget was deliberately rebaselined from measured commit `89ec35b` for the accepted dnd-kit dependency growth, preserving the existing entry caps and ~5% aggregate headroom.

## Verification
- Final task head `d967cfd713983d95cecfb36ae9b484c8698485d6` passed Quality Gate run `36827380107`.
- Canonical acceptance passed after static/unit checks, production build/PWA/size checks, dependency audit, both DOM shards, and both browser-contract shards.
- Browser coverage includes delayed activation cancellation, promoted task movement under the finger, visible sibling displacement, final first-to-last order, and active sorting inside the real Day View sheet without Swiper/sheet dismissal stealing the gesture.
- PR #173 was squash-merged into `feature/task-reorder-clean` as `23a11c5dabd8a3eedb4e3817c027258f725cf5e2`.
- Real Samsung/PWA touch acceptance remains manual and is documented in `MANUAL_TASK_REORDER_ACCEPTANCE.md`.
