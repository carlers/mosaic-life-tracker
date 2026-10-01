# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: Implementation and regression coverage complete on the ChatGPT task branch; full canonical CI requested.
Next action: Repair any canonical CI failure, then squash-merge into `feature/persistent-task-ordering` and verify the stable Vercel Preview.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Made native touch events authoritative after long-press activation so browser pointer cancellation cannot abort an otherwise valid touch drag.
- Replaced live re-parenting with a measured projected gap so surrounding rows still shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back.
- Roll back the optimistic projection if persistence rejects instead of leaving an unsaved order on screen.
- Added DOM regressions for stable source ownership, optimistic release state, failed-write rollback, touch pointer-cancel fallback, and true touch cancellation.

## Verification
- Full canonical GitHub Actions acceptance requested on the final task SHA.
- Hosted Preview/manual mobile acceptance pending stable-branch merge.
