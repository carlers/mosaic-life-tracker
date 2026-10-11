# Session checkpoint

Updated: 2026-10-11 13:44 UTC
Current task: Bucket List MVP, issue #405. User explicitly authorized narrowed MVP implementation.

## Scope and sources
- Task branch: `chatgpt/bucket-list-mvp-405-20261011`, based on `dev@832fc93229ccfef619f54a9426c8ffc2dee59282`. Production `main@3af1049358de4e7474d6478a335b6bb779d03b46` was not changed.
- Product boundary: owner-only aspirations, independent of dated tasks/Backlogs (#407), friend feeds and notifications. Title, optional description, active/achieved with resettable achieved-at timestamp, edit/delete. No images, archive, collections, linked steps or sharing.
- Version candidate: v0.18.0 (MINOR), unaccepted; keep unchanged through successful Preview. No dev/main promotion authorized.

## Implementation
- Dedicated RxDB bucketList model, isolated local hook/page and lazy detail route, Home and Me links; seventh replication pilot, CAS mapping and server allowlist.
- Git-owned `bucket_list_items` table and additive migration `010-bucket-list` (not applied). Included in account-erasure worker/policy, server tombstone retention, v3 portable user export/restore with v1/v2 compatibility.
- Regression tests for mapping/isolation, backend manifest/erasure, migration.
- Shared Appwrite Scratch project must be coordinated with #526; **no Appwrite mutations, Functions activation, secrets or Production changes performed**.

## Verification and next steps
- Submit focused CI at this task head; inspect errors and fix. Review backup/restore regressions, schema contracts and size guard.
- Prepare the stable `feature/bucket-list-405` only after focused green; run full canonical GitHub checks and Vercel Preview. Do not claim cloud authenticated acceptance until coordinated Scratch migration/Function exact-SHA deploy, account-private/offline cross-device tests, old-client compatibility and manual iOS/Android/swipe/theme review.
- Advance dev/main only by separate user approval. Maintain issue #405 with actual evidence and unresolved gates.
