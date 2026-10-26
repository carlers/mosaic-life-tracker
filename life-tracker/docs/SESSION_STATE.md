# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 historical personal task/Diary photo references versus recovered Supabase Storage bytes, isolated task branch `chatgpt/1027-personal-photo-byte-parity-20261026`.

## Accepted isolated recovery / protected services
- Production stays Appwrite: Git main `bef14fb791a361e8c1f902a5c4adf4536e57aae7` and dev `497919bed4b6ce85b826f2d86fc767920344ec17` untouched. Hosted Supabase Bucket/Settings schema UNAPPLIED; no live provider switching, SMTP alerts, backup pruning, social features or private user-data mutation.
- Existing real historical 7-table Scratch R2 age backup `20261025T031343499Z` restored on Fedora, with native >=30-day lock readback. Owner requires exactly ONE final consolidated pre-social Fedora command, no repeated partial local stages.
- Isolated recovery `fe2f5d080c3b9a720f7e5d2fb82089c00f06d91e` accepts signed private Bucket/link SQL #1328, 10-table age PG17 DR #1329, signed Bucket transport #1330, isolated Bucket/link RxDB #1333, full link-history/quarantine #1334, age history archive writer #1335, Appwrite historical reader #1337, independent age decrypt verifier #1338, Bucket replay parity #1339, complete raw personal Appwrite content #1340 and seven-domain owner/generation/content join #1341. All are SOURCE-ONLY, not active user migration.
- Exact recovery `fe2f5d`: full Quality #40257460924, synthetic #40257460894, history age #40257460955, eight-table #40257460945, ten-table #40257461176, GoTrue #40257461011 ALL PASS. Core App #40257460990 waiting at protected Preview approval; no hosted deployment or Product acceptance.

## Current source-only task
- New pure `candidatePhotoMigrationAudit.ts` joins the frozen seven-domain owner snapshot and inspects all historic task image/Diary photo IDs including deleted rows. Compares independently pinned source Appwrite Storage metadata bytes/SHA against restored Supabase owner UUID object paths/bytes/SHA; requires all representable original objects, including orphan photos, and no extra/foreign target blobs. Reports missing historical refs, unrepresentable long IDs, and retains them for separately encrypted quarantine. No real Storage API calls, deletes, uploads or plaintext archival.
- Unit suite `supabaseCandidatePhotoMigrationAudit.test.ts`: verifies tombstones, duplicated reference usage, orphan sources, byte drift, missing/extra/foreign blobs, malformed Diary JSON, long legacy references, source lease tamper and independently pinned inventory counts. CI NOT YET VERIFIED.
- Original source Writer Freeze issuer, real full Appwrite Storage byte archive, photo restore tied to the owner source, archived ZIP/media replay and reverse-provider acceptance remain **unimplemented or unverified**. Result always `providerCutoverEligible:false`.

## Next action
- Run task full-diff focused Quality; fix failures, squash accepted source-only task into isolated recovery and verify full canonical restore/security gates. Do not approve protected Preview or activate hosted schemas.
- Then implement trusted server-exclusive source/old-PWA fencing, authenticated encrypted full owner PostgreSQL/Auth/Storage/ZIP source + archive/photo replay, owner cross-device offline sync and reversible Appwrite Cloud/Oracle ↔ Supabase migration. Only after all pre-social automated work, ONE bundled Fedora acceptance; Production separately authorized.
