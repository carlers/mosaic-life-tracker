# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: Reorder interaction architecture revised on a dedicated ChatGPT branch; canonical CI and hosted touch acceptance are pending.
Next action: Run canonical CI, repair any failures, merge the verified change back to `feature/persistent-task-ordering`, then verify Preview.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Made native touch events authoritative after long-press activation so browser pointer cancellation cannot abort an otherwise valid touch drag.
- Replaced live re-parenting with a measured projected gap so surrounding rows still shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back.
- Added DOM regressions for stable source ownership, optimistic release state, touch pointer-cancel fallback, and true touch cancellation.

## Verification
- Canonical CI pending on the task branch.
- Hosted Preview/manual mobile acceptance pending.
