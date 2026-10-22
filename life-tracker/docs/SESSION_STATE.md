# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 historical Appwrite R2 recovery, erased-account privacy filtering and cutover preflight.

## Verified milestones
- Isolated `feature/1027-supabase-recovery-20261020@b52cec9a89e2fa7e631c330864f048f1c07439ba` has four exact-SHA SUCCESS workflows: Quality Gate #39769064416, Core App #39769064429, Synthetic Restore #39769064451, Real GoTrue #39769064422. No app Preview/Production promotion.
- Fresh encrypted Supabase `mosaic-dev` snapshot independently restored to a new private Fedora PG17 stack, six Auth/core tables containing **403 exact source/target rows**, and the owner reported real original-password sign-in, fresh writer authority, matching populated-owner signed reads, restored cross-owner read denial. Preserve both private recovery instances and source archives. NOT complete managed Auth/service rollback.
- Production Appwrite Cloud Mosaic remains table-read quota suspended (HTTP 402), with six Auth users. Its separate existing Appwrite DR Drill project contains 17 tables/2,952 rows, six Auth users and 137 files.
- The operator's R2 `20261018T110129330Z` original Appwrite Cloud backup completed 2026-10-18 11:02:24Z. Authenticated manifest/users/17 table data objects show six Auth users, **2,987 rows**, 137 files. DR project differs by 35 net rows and is not proven source-equivalent.
- Owner ran the existing read-only `preflightSnapshot` plus authenticated external erasure-marker reader on original R2 archive: **all 37 encrypted manifest data objects / 137 raw media blobs hash verified, and 11 distinct external privacy-deletion markers decrypted/authenticated**. The global marker count does NOT indicate how many of the six archived accounts were erased. Original snapshot is >36h stale and NOT current source authority; post-Oct-18 changes, offline drafts and full restore acceptance remain unverified.

## Current task scope
- Repair `scrubDeletedUserRow` omission of `owner_id` and `invitee_id` as explicit user-link fields; this otherwise permits old `task_shares` rows for erased owners/invitees and `diary_reactions` owner references to survive a historical restore. Add narrow invariants for both erased sides and surviving users. No R2, Appwrite, Supabase, `dev` or Production changes.
- No user-visible version impact. Follow focused CI -> squash to isolated branch -> exact merged-SHA four canonical green workflows.

## Next action
- Verify focused code regression and canonical merged-SHA four labs, then privately compute R2 archive AFTER mandatory privacy-deletion filtering: intersect 11 global marker owners with six snapshot accounts, count removed rows by table and excluded files (no IDs/content disclosed). Old `task_shares` source snapshot has zero such rows; the fix guards future/reverse DR.
- Resolve divergent Oct 15-16 DR project vs Oct 18 historical R2 row differences, recover latest Appwrite source deltas/queued offline edits and original-owner identity mapping, and implement **server-enforced** stale Appwrite PWA writer cutoff before any live import or provider cutover.
- Complete hosted Auth rollback, private Diary + category retirement + atomic deletion, two-owner signed hosted and offline/device tests and public registration review before separate `dev`/`main`/Production approval. Keep #1027/#1029/#857 open.
