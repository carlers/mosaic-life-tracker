# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 Bucket List/task-link owner-private mapping foundation, no hosted tables.

## Accepted
- Appwrite Production main bef14fb791a361e8c1f902a5c4adf4536e57aae7 and dev 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged. Supabase personal candidate isolated; hosted Settings migration UNAPPLIED.
- Real historical seven-table encrypted Scratch R2 20261025T031343499Z verified and restored on Fedora; native >=30-day lock readback proved. Do not repeat. NEXT Fedora command only when all pre-social features and bidirectional migration bundled.
- Synthetic eight-table PG17 age/TOC/Settings/RLS exact restore real CI #40199736849 PASSED after PR #1322 client compatibility fix, Quality #40199736896, Synthetic #40199736838 and GoTrue #40199736855 passed.
- PR #1323 source-only verified owner Settings change stream and bigint pull checkpoint, focused CI #40200595607 passed; recovery branch 776ea6c83ed9656326d5aa09c9780df281f6f640, canonical Quality/GoTrue/eight-table/Core running.
- Main Brevo automated alerts, unattended backup and pruning disabled, Proton sender replacement case pending with support.

## Current source-only task
- Separate Bucket List and task-link mapping: preserve historical IDs, long task reference IDs, tombstones, source timestamps, and explicit verified legacy→Supabase owner mapping. Quarantine missing/foreign/deleted target references rather than silently dropping them. No hosted SQL, app writer or data migration. Nine unit tests for both domains, ownership and link integrity.
- Prior #1325 Settings native RxDB pilot is accepted into isolated recovery source but remains disabled for Appwrite shared local collections and hosted settings; do not treat it as a public settings release.

## Next action
- Focused CI then merge source-only Bucket mapping into isolated recovery branch after accepted #1325 stable tests; canonical Quality/8-table/GoTrue/Core. Next private Bucket SQL/CAS and full ten-table DR, signed link transport and safe Settings migration/backfill. No hosted SQL, Appwrite Production changes or Fedora request until one final pre-social bundle.
