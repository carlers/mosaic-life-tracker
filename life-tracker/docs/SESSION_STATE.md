# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: Implementation and focused/browser verification are green on the task branch; full canonical verification is requested on the final task SHA.
Next action: Pass full canonical CI, squash-merge PR #169 into `feature/persistent-task-ordering`, then verify its Vercel Preview deployment.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Replaced the unreliable title long-press sensor with a dedicated task reorder grip using `touch-none`, matching the proven category-reorder ownership model while preserving normal task-title scrolling/taps.
- Unified active dragging on the pointer stream; the grip prevents browser pan takeover so movement is no longer lost to touch `pointercancel`.
- Replaced live re-parenting with a measured projected gap so surrounding rows shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back; persistence rejection rolls back to live order.
- Updated DOM, browser, manual-acceptance, and project-reference coverage for the grip model.
- Real Chromium task-reorder coverage passes with no page-scroll takeover during the grip drag.

## Verification
- Browser/focused run #1466: focused checks passed; browser shard 1/2 passed; browser shard 2/2 passed.
- Full canonical Quality Gate requested on the final task SHA.
- Hosted Preview/manual mobile acceptance pending stable-branch merge.
