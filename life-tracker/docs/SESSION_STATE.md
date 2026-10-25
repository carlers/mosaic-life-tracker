# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 source-only Settings RxDB pilot adapter; no runtime writer.

## Accepted
- Appwrite Production main bef14fb791a361e8c1f902a5c4adf4536e57aae7 and dev 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged. Supabase personal candidate isolated; hosted Settings migration UNAPPLIED.
- Real historical seven-table encrypted Scratch R2 20261025T031343499Z verified and restored on Fedora; native >=30-day lock readback proved. Do not repeat. NEXT Fedora command only when all pre-social features and bidirectional migration bundled.
- Synthetic eight-table PG17 age/TOC/Settings/RLS exact restore real CI #40199736849 PASSED after PR #1322 client compatibility fix, Quality #40199736896, Synthetic #40199736838 and GoTrue #40199736855 passed.
- PR #1323 source-only verified owner Settings change stream and bigint pull checkpoint, focused CI #40200595607 passed; recovery branch 776ea6c83ed9656326d5aa09c9780df281f6f640, canonical Quality/GoTrue/eight-table/Core running.
- Main Brevo automated alerts, unattended backup and pruning disabled, Proton sender replacement case pending with support.

## Current source-only task
- After accepted #1324 typed Settings CREATE/CAS/master source transport, extend isolated generic RxDB pilot to domain=settings using signed owner pull/create/master/CAS and native RxDB checkpoints. Preserve byte-exact opaque values, tombstones, unknown portable keys, local pending edits and parked conflict reviews. Reject owner/key swaps, spoofed revisions, provider-specific avatar/social settings and session changes. Existing Production Appwrite and candidate core runtime remain unchanged: NO Settings writer enabled.
- Add substantive unit tests for source-only Settings pilot including create and revision CAS, tombstone pull, foreign identity, explicit conflict and key immutability, no physical delete or implicit owner/provider switch.

## Next action
- Focused CI and isolated stable full Quality/8-table/GoTrue/Core gates. Next build gated complete Settings owner-private collection migration/backfill and exclusive-writer runtime, then Bucket List/task links, full personal DR and reversible provider return. ONE final Fedora acceptance only when all pre-social work is ready. No Production cutover/social authorization.
