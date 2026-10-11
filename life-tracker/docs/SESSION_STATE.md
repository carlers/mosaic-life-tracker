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
- Regression tests for mapping/isolation, backend manifest/erasure, migration, v3 cross-account restore, and legacy Replace preserving aspirations. Corrected export backup type and existing test fixtures.
- Shared Appwrite Scratch project must be coordinated with #526; **no Appwrite mutations, Functions activation, secrets or Production changes performed**.

## Next action

Refactor duplicate owner-only replication pilots to stay under unchanged size limits; verify focused, then full stable Preview. Scratch activation remains separately gated. No dev/main promotion without approval.

## Verification and next steps
- First focused CI 38145491726 failed on checkpoint heading, then focused CI 38145839330 succeeded at 86d751dc54801fd57cffff13c3143d0c9532c81b (only checkpoint diff). Subsequent changes added the seventh sync-manifest test. Verify the complete branch with focused CI and full canonical Preview gates; neither full TypeScript nor bundle sizing is yet established.
- Repair PR into stable `feature/bucket-list-405` after focused green; rerun exact stable SHA full canonical GitHub checks and Vercel Preview. Do not claim cloud authenticated acceptance until coordinated Scratch migration/Function exact-SHA deploy, account-private/offline cross-device tests, old-client compatibility and manual iOS/Android/swipe/theme review.
- Advance dev/main only by separate user approval. Maintain issue #405 with actual evidence and unresolved gates.

## Current repair (2026-10-11)

- Stable Preview `feature/bucket-list-405@d792f275` canonical CI 38146449849: 941/941 unit, DOM/browser and dependency jobs green; build exceeds four unchanged size ceilings (homeClosure gzip +190B; total assets raw +10,745B, gzip +2,451B, precache +10,966B). Two handler assertions expected six rather than seven GC tables.
- Task repair `chatgpt/bucket-list-size-repair-405-20261011` consolidates the same owner-only Diary/Category/BucketList replication logic into one shared primitive, retaining per-domain mappings and equality fields; handler regression counts updated. Request focused and then stable Preview full gate. No budget increases.
- No scratch backend changes or `dev`/`main` promotion; feature is NOT authenticated Preview-accepted. Conditional next stage: coordinate additive `010-bucket-list` migration and reviewed Function deployment only after explicit shared Scratch authorization.
