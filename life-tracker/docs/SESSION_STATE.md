# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 pre-social Supabase owner-private Bucket List/link RxDB parity on isolated task PR #1330.

## Accepted/protected
- Appwrite Production and `dev`/`main` unchanged. Supabase hosted Bucket/Settings migrations, hosted writer, backup scheduling/pruning, alerts, provider switch and social rollout are NOT approved.
- Real historical seven-table Scratch R2 encrypted snapshot 20261025T031343499Z restored on Fedora; native >=30-day R2 retention lock verified. Do not repeat successful Fedora work. NEXT Fedora only one consolidated SHA-pinned command after all pre-social features and bidirectional migration prepared.
- Previous eight-table Settings/GoTrue encrypted synthetic restore CI passed.
- #1328 owner-private Bucket/task-link SQL, same-owner FKs/RLS, authority/CAS and two-owner signed GoTrue: Quality #40216685875 and Core App #40216685860 PASS; accepted on isolated recovery at `088d280de7ae059042603390164ea18d446306d3`.
- #1329 SHA-pinned ten-table age/PG17 full-byte TOC, independent exact COPY restore, signed original-password two-owner and tombstone replay: real lab #40220162318 PASS on task b466da583b44b14a051591434857e730185f2182, with same-tree focused Quality #40220162278 PASS; squash accepted on isolated recovery at `0614aec35533060a36782a51c88a8cbfa25275cd`. **No hosted R2 ten-table archive** or Storage/media restore yet. Full stable Quality #40220981715 PASS and ten-table lab #40220981721 PASS; independent GoTrue #40220981711 FAIL: old six-table disposable fixture lacked explicit encrypted SHA since new checksum guard. The task's GoTrue lab now computes exact synthetic SHA, requiring CI-mode-only digest and 18 Python regressions.
- Both accepted PRs are source-only. No Supabase database install or live app writer.

## Current work
- #1330 fixes independent legacy six-table GoTrue fixture SHA pin without weakening the hardened ten-table path. Its exact SHA CI GoTrue and focused Quality must pass before merge.
- #1330 isolated signed owner Bucket/link incremental `bigint` pull, no-upsert create/current owner master, strict expected-revision CAS and original immutable reference checks. Long/foreign/deleted/missing target IDs fail before acknowledgement; 255-character historical source links remain recoverable by an encrypted quarantine, not silently shortened.
- Previous #1330 focused Quality #40218135814 PASS on 006493151f63964b5d6361934e442e2045df12d0. This task-branch merge reconciles accepted #1329 source files and inherited branch ancestry WITHOUT force and adds a concise checkpoint; exact new focused Quality and stable canonical still required.
- Found actual ZIP gap: `src/lib/exportData.ts` filters dangling Bucket links; `restoreData.ts` cannot replay them. Existing user ZIP is not a lossless cross-provider history source. Issue #1027 records need for separate encrypted signed quarantine/export and count/hash replay; never silently broaden ZIP Restore or weaken owner foreign-key constraints.

## Next action
- Verify #1330 exact focused Quality and source checks; squash to isolated recovery only when green; run full stable canonical and review protected Preview without hosted writes.
- Complete full owner-private Bucket/Settings RxDB isolation, signed historical inventory/quarantine and ZIP/media parity; then guarded Appwrite Cloud/Oracle ↔ Supabase single-writer bidirectional dry run, actual ten-table R2/Storage DR and one final Fedora acceptance. Only separately approved promotion can touch `dev`/`main`/Production or provider ownership.
