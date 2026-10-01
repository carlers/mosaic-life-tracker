# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: Production fix and regression coverage are complete on the ChatGPT task branch; the second full gate exposed one stale browser assertion from the pre-fix re-parenting model, now corrected.
Next action: Pass full canonical CI on the updated browser contract, then squash-merge into `feature/persistent-task-ordering` and verify the stable Vercel Preview.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Made native touch events authoritative after long-press activation so browser pointer cancellation cannot abort an otherwise valid touch drag.
- Replaced live re-parenting with a measured projected gap so surrounding rows still shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back.
- Roll back the optimistic projection if persistence rejects instead of leaving an unsaved order on screen.
- Added DOM regressions for stable source ownership, optimistic release state, failed-write rollback, touch pointer-cancel fallback, and true touch cancellation.
- Updated the browser touch contract to assert the stable source anchor plus projected gap during drag and the final visible order after release.

## Verification
- Full gate #1461: lint, unit, handlers, build, both DOM shards, dependency audit, and browser shard 1/2 passed.
- Browser shard 2/2 failed only because its reorder assertion expected the old pre-fix DOM re-parenting; the remaining 14 tests in that shard passed.
- Updated full canonical gate pending on the new final SHA.
- Hosted Preview/manual mobile acceptance pending stable-branch merge.
