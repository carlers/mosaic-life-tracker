# Session checkpoint

Updated: 2026-10-11
Current task: #405 private Bucket List, Scratch-only rollout explicitly approved. Stable Preview `feature/bucket-list-405` v0.18.0; `dev`/`main` remain v0.17.4, unchanged.

## Delivered

- Stable Preview frontend and offline-first owner-only Bucket List; separate from task/backlog/social data, title+memo, achieve/reopen, edit/delete, portable backup v3, erasure, tombstone retention, owner CAS. Existing Diary/Category shared replication implementation preserved. Final pre-rollout GitHub canonical [38147856267](https://github.com/carlers/mosaic-life-tracker/actions/runs/38147856267) SUCCESS at `207ab3db`, Vercel deployment `dpl_Aj7h73gvcnAy7PPn1dZ8qt9NYGbF` READY on same SHA. Stable alias: https://mosaic-life-tracker-git-feature-7a0dd1-carls-projects-72516fde.vercel.app .
- Explicitly confirmed Scratch project `6a96e82d000d1310b3be` (`life_tracker`, fra): provisioned additive Git-owned table `bucket_list_items` with eight available columns, owner-only row security + `create("users")`, `idx_bucket_owner_updated` index available; no preexisting records changed.
- Recorded prior active Scratch `message-action` deployment `6acb0cd8735b3060c9af` (#526), retained for rollback. From exact stable Git SHA `207ab3dbdb90edf08d5a9553796e7b20146c17ef`, packaged 11 source/runtime files, built new deployment **inactive**, confirmed READY, activated **`6acba22560abbd99d124`**, read-back verified. Preserved existing task-shares and Backlog handlers, variables, trigger events and empty schedule.
- Live new-deployment no-user-data smoke: `get_notifications` 200 empty, invalid `task_shares` 400, invalid `get_friend_calendar` 400, all completed under active deployment; origin wildcard `*.vercel.app` currently registered.
- Current task branch `chatgpt/bucket-list-scratch-readiness-405-20261011` updates `appwrite:preview:prepare` additive migration allowlist for migration 010 and associated unit/docs recovery contract. Must pass focused → stable Preview canonical/Vercel again.

## Next action

Verify additive 010 guard and tests; merge task into stable Preview after focused. Confirm exact final GitHub canonical & Vercel READY and new active deployment unchanged. User can then test authenticated create/edit/achieve/reopen, two devices/offline, owner privacy and routes. A green server smoke does NOT prove signed-in browser or physical iOS/Android acceptance; those require user testing. No Production, `dev`, or `main` mutation; keep #405 open until acceptance/release approval.
