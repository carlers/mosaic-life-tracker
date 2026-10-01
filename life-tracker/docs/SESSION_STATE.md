# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: Dedicated task-grip ownership passes the real Chromium reorder contract; remaining failures are test-harness adjustments caused by the new accessible grip plus one missing React flush in rollback coverage.
Next action: Pass browser/focused verification with those test fixes, then run full canonical CI, squash-merge into `feature/persistent-task-ordering`, and verify Vercel Preview.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Replaced the unreliable title long-press sensor with a dedicated task reorder grip using `touch-none`, matching the proven category-reorder ownership model while preserving normal task-title scrolling/taps.
- Unified active dragging on the pointer stream; the grip prevents browser pan takeover so movement is no longer lost to touch `pointercancel`.
- Replaced live re-parenting with a measured projected gap so surrounding rows shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back; persistence rejection rolls back to live order.
- Updated DOM, browser, manual-acceptance, and project-reference coverage for the grip model.
- The real Chromium task-reorder test now passes.

## Verification
- Browser run #1465: reorder-containing shard 2/2 passed completely.
- Browser shard 1/2 failed only because a fuzzy title-button locator also matched the new accessible reorder button; title locators are now exact.
- Focused checks failed only because the rejected-persistence test asserted before React flushed the async rollback; the regression now awaits that flush.
- Browser/focused verification pending on the corrected tests.
- Hosted Preview/manual mobile acceptance pending stable-branch merge.
