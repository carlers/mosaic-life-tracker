# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 signed Settings source-only CREATE/CAS transport; no runtime writer.

## Accepted
- Appwrite Production main bef14fb791a361e8c1f902a5c4adf4536e57aae7 and dev 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged. Supabase personal candidate isolated; hosted Settings migration UNAPPLIED.
- Real historical seven-table encrypted Scratch R2 20261025T031343499Z verified and restored on Fedora; native >=30-day lock readback proved. Do not repeat. NEXT Fedora command only when all pre-social features and bidirectional migration bundled.
- Synthetic eight-table PG17 age/TOC/Settings/RLS exact restore real CI #40199736849 PASSED after PR #1322 client compatibility fix, Quality #40199736896, Synthetic #40199736838 and GoTrue #40199736855 passed.
- PR #1323 source-only verified owner Settings change stream and bigint pull checkpoint, focused CI #40200595607 passed; recovery branch 776ea6c83ed9656326d5aa09c9780df281f6f640, canonical Quality/GoTrue/eight-table/Core running.
- Main Brevo automated alerts, unattended backup and pruning disabled, Proton sender replacement case pending with support.

## Current source-only task
- Extend existing signed candidate CREATE/master with Settings typed mapping and supported owner-private create only, no upsert or auto retry and conflict master check.
- Extend signed CAS RPC allowlist with strictly typed and bounded Settings value/updated timestamp/is_deleted, still no direct UPDATE/DELETE, refuse owner/key/client revision changes. Unit tests cover owner/session switch, invalid server/master data, stale CAS, wrong types and conflict. No app/RxDB writer activated.

## Next action
- Focused tests then stable canonical on isolated branch. Gated RxDB Settings integration, owner-private Bucket List/task links, full offsite DR profile, migration/rollback and single final Fedora pre-social validation remain before separately approved public Supabase cutover and social.
