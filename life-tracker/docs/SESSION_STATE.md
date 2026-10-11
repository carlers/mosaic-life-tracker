# Session checkpoint

Updated: 2026-10-11 UTC
Current task: #405 v0.19.1 **urgent RxDB DB6 local schema compatibility repair** after user on-device screenshot.

## Observed regression and fix
- User's existing-device Preview showed “Local database unavailable”, RxDB DB6 on `life_tracker_db.syncMeta` at v0.19.0; the persisted **version 2** schema allowed tasks/categories/diary/settings/friendships/messages/bucketList, while the shipped **also version 2** schema added bucketTaskLinks. Same version, changed schema hash: RxDB correctly refused opening. **Do not erase/recreate local IndexedDB or ask user to clear browser storage; unsynced changes must be preserved.**
- Fix on task branch `chatgpt/fix-syncmeta-db6-v0191-405-20261011` from stable `feature/bucket-list-405@465b66e2`: bump `syncMetaSchema.version` **2→3**, add **identity migration strategy 3** retaining all existing freshness metadata, keep strategies 1/2, regression tests for old v2 and full v0→v3 migration chain; stamp **v0.19.1** in package/package lock/app version. No other database schemas, Appwrite settings or user-data writes.
- Version 0.19.0 feature stable CI [38154128316](https://github.com/carlers/mosaic-life-tracker/actions/runs/38154128316) SUCCESS but did not test an existing v2 IndexedDB; Vercel exact-sha stable ready; this is a test coverage gap now addressed.
- Scratch migration 011 completed and 11-file combined Function `message-action@6acbb81e4a02f7368340` active, verified, no backend change needed for local DB fix. Previous Function deployment retained for rollback. Stable Preview registered alias: https://mosaic-life-tracker-git-feature-7a0dd1-carls-projects-72516fde.vercel.app .

## Next action
Run focused CI on task branch and resolve failures. Squash PR into stable `feature/bucket-list-405` (not dev/main), check exact stable canonical CI + Vercel READY and unchanged Scratch Function. Once green, user should refresh/reopen stable Preview and attempt normal sign-in with original browser storage intact; old v2 local data should migrate without deletion. Distinguish CI, hosted provider checks, and user real-device acceptance. Leave #405 open; do not merge dev/main or mutate Production.
