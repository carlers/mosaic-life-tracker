# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 source-only Bucket List/task-link RxDB parity on `chatgpt/1027-bucket-rxdb-parity-20261026`.

## Accepted source / protected environments
- Production Appwrite and `main`/`dev` unchanged; Supabase hosted private Settings/Bucket SQL and live writers UNAPPLIED. No provider cutover, alerts, pruning or R2 data mutation.
- Actual historical encrypted seven-table Scratch R2 archive 20261025T031343499Z restored and >=30-day native retention verified on Fedora. Do NOT repeat. One final SHA-pinned pre-social Fedora acceptance only after remaining work.
- PR #1328 private Bucket/task-link owner-only SQL/RLS/CAS, signed two-owner Core App: exact Quality #40216685875 PASS and signed Core #40216685860 PASS; isolated recovery squash `088d280de7ae059042603390164ea18d446306d3`.
- PR #1329 SHA-enforced ten-table age/PG17 authenticated TOC, exact bytes independent restore and owner/tombstone replay: focused Quality #40220162278 PASS, disposable lab #40220648308 PASS; isolated recovery squash `0614aec35533060a36782a51c88a8cbfa25275cd`.
- PR #1330 owner-signed Bucket/link bigint pull/create/master/CAS and GoTrue 6-table legacy SHA fixture repaired: focused Quality #40221557777 PASS and GoTrue #40221557773 PASS; isolated recovery squash `5882d2d47d8df9eed87b35f2e5bffff49849e109`.
- Stable source `5882d2d` canonical Quality #40249161585 PASS; synthetic #40249161547 PASS, eight-table #40249161639 PASS, ten-table #40249161716 PASS, GoTrue #40249161754 PASS. Core App #40249161620 running at checkpoint time. Protected hosted Preview not accepted; no real 10-table R2+Storage restore yet.

## Current source-only work
- Added isolated Bucket and task-link RxDB pilot paths, signed pull/push, native checkpoints and conflict parking. Required independently checked same-owner target inventory before ANY link write; reject long/missing/foreign/deleted-active target IDs, preserve tombstones and original reference IDs, fence owner changes after async inventory, CAS only permitted fields. No core bridge or shipped Appwrite collection activated.
- New `supabaseCandidateBucketRxdb.test.ts` behavioral regressions exercise creation, bigint pull, tombstone, revision CAS, quarantine, immutable references, owner switch and explicit start guards. Focused CI and canonical acceptance NOT YET VERIFIED for this task branch.
- Historical source ZIP active-only filter excludes dangling Bucket links; current restore does not replay them. User ZIP is not migration-complete. See #1027 for separate signed full-history exporter/encrypted quarantine/hash replay requirement.

## Next action
- Obtain exact SHA focused Quality for the new Bucket RxDB task, repair until green and squash to isolated recovery; recheck canonical full CI/Preview gates.
- Then build durable encrypted same-owner historical link quarantine plus source/target audits and ZIP/media backfill, stage signed Bucket/Settings collection convergence and provider fencing, test reversible Appwrite Cloud/Oracle ↔ Supabase migration with independent full PostgreSQL/Auth/Storage recovery. Only then the user's one consolidated Fedora command. No hosted/private/Production writer or `dev`/`main` promotion without separate approval.
