# Session checkpoint

Updated: 2026-10-01
Current task: Repair persistent Day View task reordering on the feature branch.
Status: Production fix and DOM coverage are complete; browser verification is isolating the remaining synthetic touch-coordinate behavior.
Next action: Run the browser-only gate with post-lift destination measurement; if it still cannot move the projected gap, repair the production touch sensor rather than weakening the contract.
Blockers: None currently.

## Completed substeps
- Kept the active source TaskItem mounted for the full drag instead of re-parenting the gesture owner across category subtrees.
- Made native touch events authoritative after long-press activation so browser pointer cancellation cannot abort an otherwise valid touch drag.
- Replaced live re-parenting with a measured projected gap so surrounding rows still shift live while the overlay follows the finger.
- Retained the final optimistic task order after release until the RxDB live query reflects the persisted order, preventing release-time snap-back.
- Roll back the optimistic projection if persistence rejects instead of leaving an unsaved order on screen.
- Added DOM regressions for stable source ownership, optimistic release state, failed-write rollback, touch pointer-cancel fallback, and true touch cancellation.
- Updated the browser touch helper to measure the destination after lift and again after movement, avoiding stale pre-lift row geometry.

## Verification
- Full gate #1461 passed lint, unit, handlers, build, both DOM shards, dependency audit, and browser shard 1/2; its sole browser 2/2 failure was the old re-parenting expectation.
- Full gate #1462 again passed non-browser checks; browser 2/2 showed the projected gap remaining at index 0, indicating either stale synthetic coordinates or touch ownership.
- Browser-only verification requested for the post-lift geometry correction.
- Hosted Preview/manual mobile acceptance pending stable-branch merge.
