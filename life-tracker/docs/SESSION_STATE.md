# Session checkpoint

Updated: 2026-09-28
Current task: friend request delivery and friend task-image delivery hardening.
Status: friend request delivery is working in Preview; task attachments were found to be owner-only Storage files, so friends could see the task row but not its image. The task-image upload contract now grants authenticated-user read access while keeping owner-only writes, and the currently used task-image files for the two active test accounts were repaired in Appwrite.
Next action: complete full canonical acceptance for the task-image change, merge the task branch into the stable Preview branch, verify the hosted friend calendar with an image on both accounts, and keep dev promotion gated on explicit user instruction.
Blockers: disaster restore rehearsal remains deferred by plan.

## Working set
- src/lib/storage.ts
- tests/unit/taskImagePermissions.test.ts
- appwrite-functions/message-action/
- src/lib/friendData.ts
- docs/PROJECT_REFERENCE.md
- docs/DELIVERY.md

## Completed substeps
- Friend request lifecycle is server-controlled and working in Preview.
- Profile image access was fixed separately; this task specifically covers task attachments.
- Task attachment uploads now grant authenticated-user read access while preserving owner-only update/delete permissions.
- Existing task attachment files for the active two-account Preview test data were repaired in Appwrite Storage.
- Added a focused regression test for task-image permission invariants.
- Quality Gate focused verification passed on commit 26a1dd795e4f87ca5a1251ffae0636d1ab81374c.

## Remaining substeps
- Full canonical acceptance for the final task-image commit.
- Squash-merge into the stable Preview branch and verify its Vercel deployment.
- Manual two-account hosted verification: friend calendar task image loads and task-photo viewer opens normally.
- Promote Preview to dev only after explicit user instruction.

## Constraints
- Preserve account isolation and server-mediated friend calendar reads.
- Task image read access is authenticated-user scoped; write/delete remain owner-only.
- Do not broaden task-row permissions or bypass message-action friendship checks.
- Never automatically promote Preview to dev.

## Verification
- Quality Gate focused verification passed: contracts, test discovery, and the new task-image permission regression test passed.
- Existing Preview Quality Gate for the underlying task-image permission implementation also passed.
- Full canonical acceptance for the final checkpoint commit remains pending.
