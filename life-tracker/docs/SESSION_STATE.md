# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 source-only owner Bucket List/link read, CREATE/master and strict CAS follow-up, stacked after draft #1329 and #1328.

## Accepted
- Appwrite Production main bef14fb791a361e8c1f902a5c4adf4536e57aae7 and dev 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged. Supabase personal candidate isolated; hosted Settings migration UNAPPLIED.
- Real historical seven-table encrypted Scratch R2 20261025T031343499Z verified and restored on Fedora; native >=30-day lock readback proved. Do not repeat. NEXT Fedora command only when all pre-social features and bidirectional migration bundled.
- Synthetic eight-table PG17 age/TOC/Settings/RLS exact restore real CI #40199736849 PASSED after PR #1322 client compatibility fix, Quality #40199736896, Synthetic #40199736838 and GoTrue #40199736855 passed.
- PR #1323 source-only verified owner Settings change stream and bigint pull checkpoint, focused CI #40200595607 passed; recovery branch 776ea6c83ed9656326d5aa09c9780df281f6f640, canonical Quality/GoTrue/eight-table/Core running.
- Main Brevo automated alerts, unattended backup and pruning disabled, Proton sender replacement case pending with support.

## Current source-only task
- Source-only private Bucket List + task link mapper preserves owner-verified exact legacy IDs, source fields, tombstones, and long historical task references. Missing, foreign or deleted targets are quarantined rather than dropped. Nine mapping/privacy regressions; no new SQL, live writer or data migration. Settings RxDB source-only PR #1325 and canonical TS fix #1326 remain present.

## Source-only next SQL work (not yet accepted)
- PR #1327 merged on recovery branch d5a9c905ca2a4863f2fea264efd6278230a577c3; commit record confirms focused Quality and prior Settings full Quality, Eight-Table, GoTrue, Synthetic and Core App technical gates successful. Protected hosted Preview still requires approval.
- Draft PR #1328 stages two **UNAPPLIED** private bucket/link tables with owner-composite FKs, signed-owner-only RLS, authority/revision triggers, CAS RPCs, catalog validation and a signed GoTrue two-owner fixture in the disposable Core App workflow. Lease release and deleted-target negatives included. The link target SECURITY DEFINER trigger now refuses a foreign signed owner **before** probing target existence; matching signed negative cases cover both present and absent foreign targets. Real SQL/CI acceptance unverified; no hosted data change.
- Older 6/7/8-table restore modes now reject Bucket/link TABLE DATA and all unreviewed public candidate personal tables instead of silently omitting them. Two additional mock-manifest regressions (11 total) and Vitest assertion added. No ten-table restore enabled.

## Ten-table dependent recovery source (not yet CI accepted)
- Draft PR #1329 branches from #1328 only: explicit SHA-pinned ten-table mode and restored row allowlist; old 6/7/8 profiles keep fail-closed protection. TOC uploader profile requires both Bucket/link entries; not enabled on hosted.
- New GitHub disposable PG17/age workflow seeds synthetic signed Settings and Bucket/link rows, rejects old modes, restores exact ten-table COPY/row parity on new target and verifies original-password two-owner privacy, achieved Bucket and link tombstones. Fifteen Python manifest/mode cases and expanded Vitest TOC checks are staged. **Real ten-table CI and full R2 media recovery unverified.**

## Bucket List/link read-only follow-up (not accepted)
- Isolated signed candidate transport now lists `buckets` and `bucket_task_links`, owner-binds JWT and URL query, fences session changes, validates all fields/revisions and retains RxDB logical tombstones. No runtime writer, hosted schema, or provider switch. Six focused mock HTTP regressions added; tests not yet CI-accepted.
- #1328 owner-spoof target probe was identified and repaired on its own branch after #1329 fork; reconcile the stacked branches before any stable merge. PR #1328 final focused checkpoint SHA a97cd1c66d0eb489826f4e75ee097bf44acb2ee9; other CI runs unverified.

## Signed Bucket/link owner transport expansion (unverified CI)
- Source-only `candidateCreateTransport` supports signed owner master and no-upsert Bucket/link creates, with full verified target inventory required before link inserts; long/missing/foreign/deleted-active links remain quarantined, not rewritten. `candidateCasTransport` supports explicit revision owner RPCs with immutable reference matching before acknowledgement. No live RxDB wiring or hosted schema.
- New Bucket read and write unit fixtures include strict bigint cursors, logical tombstones, signed owner filters, account switch, ambiguous/409 HTTP and stale/typed-null CAS negatives. Focused static source inspection passed nine targeted invariants, but **no npm/Vitest/PG/GitHub Actions execution is confirmed**. Version impact NONE (no user-visible feature activated).

## Next action
- Verify #1328 focused Quality and Core App disposable signed SQL tests, repair until green; then verify #1329 exact focused Quality and real ten-table encrypted PG17/GoTrue recovery lab. Accept the stacked PRs in order into isolated recovery only after gates; subsequently owner-link CAS/pull, ZIP/Settings reconciliation, bidirectional provider dry run, and one final pre-social Fedora acceptance. No hosted/app/Production writer, scheduling, pruning, social or routine Fedora. No hosted/app/Production writer, scheduling, pruning, social or routine Fedora.
