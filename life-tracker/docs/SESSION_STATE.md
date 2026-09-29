# Session checkpoint

Updated: 2026-09-28
Current task: friend task-image delivery.
Status: friend request delivery is working in Preview. Task rows are delivered to authorized friends, but task attachments were stored with owner-only read permissions, so the image request failed. The task-image upload contract is now friend-readable while owner writes remain restricted, and the existing task-image files for the active two-account test data were repaired in Appwrite Storage.
Next action: complete canonical verification on this clean task-image branch, merge it into the stable Preview branch, verify hosted friend-calendar task images, and keep dev promotion gated on explicit user instruction.
Blockers: full restore rehearsal remains deferred by plan.

## Working set
- src/lib/storage.ts
- tests/unit/taskImagePermissions.test.ts
- appwrite-functions/message-action/
- src/lib/friendData.ts
- docs/DELIVERY.md

## Completed substeps
- Root cause isolated to Appwrite Storage file permissions rather than friend-calendar task delivery.
- New task-image uploads grant authenticated-user read access while retaining owner-only update/delete.
- Existing task-image files for the two active Preview test accounts were repaired in Appwrite Storage.
- Added a focused regression test covering the task-image permission contract.

## Remaining substeps
- Run full canonical acceptance on the final task-image commit.
- Merge into the stable Preview branch and verify its deployment.
- Manual two-account hosted verification: friend calendar task image loads and task-photo viewer opens normally.
- Promote Preview to dev only after explicit user instruction.

## Constraints
- Preserve task-row account isolation and server-mediated friend calendar authorization.
- Task image read access is authenticated-user scoped; update/delete remain owner-only.
- Do not weaken task-row permissions.
- Never automatically promote Preview to dev.

## Verification
- Focused regression test is included in the final branch.
- Existing Preview Quality Gate for the friendship delivery remains green.
- Final canonical acceptance for this clean task-image branch is pending.
