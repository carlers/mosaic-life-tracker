# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 pre-social personal Supabase parity and recoverability. Production uses Appwrite Cloud, not Supabase.

## Verified existing boundary
- Production `main@bef14fb791a361e8c1f902a5c4adf4536e57aae7`, `dev@497919bed4b6ce85b826f2d86fc767920344ec17`, unchanged. Supabase code isolated on `feature/1027-supabase-recovery-20261020`. NO hosted Settings migration or writer.
- Real 20261025T031343499Z Scratch unified R2 snapshot had **seven** Auth/core/Diary data tables. Read-only remote byte watch, decrypted age, independent Fedora PG17/Auth/media restore, original-password owner isolation, synthetic photo and Cloudflare native >=30d lock GET readback PASSED. Not a Settings restore, full managed Auth/SMTP/OAuth backup or nonempty real-photo source proof.
- New owner-private Settings mapping, signed two-owner disposable SQL RLS/CAS/lease checks and unapplied Settings table from PRs #1313/#1314 have passed their dedicated Core App job; Preview deployment needs protected gate. Personal Bucket List/task links, active Settings sync, imports, old Appwrite writer fence and complete DR parity remain open.
- Main Brevo failed-backup notifier dormant. Gmail sender rewritten to authenticated Brevo From delivered to Proton, raw Proton sender did not; owner requested Gmail-free managed From/Proton Reply-To and opened Brevo support case. Isolated Reply-To code in PR #1312; no active email alerts, daily backup or pruning.

## Source-only eight-table Settings restore
- New explicit `--fresh-personal-settings-sha256 EXACT_DIGEST` enables eight-table fresh encrypted Settings/Diary recovery into a **new disposable loopback PG17**. Requires all eight source TABLE DATA entries, initialized empty personal target, exact owner/tombstone/revision COPY byte parity and session/lease exclusion. Old six-table digest and seven-table mode remain unchanged; any Settings-bearing archive under old mode FAILS rather than silently dropping rows. Invalid/ambient mode fails.
- Nine offline negative/positive tests, shell syntax, focused Quality and canonical stable still required. Real nonempty eight-table age→independent PG17 signed restore in CI must pass before any hosted Settings SQL/write. R2 full producer already backs up complete database; this change only extends the data-only restore allowlist.
- Never reinterpret the existing accepted seven-table R2 snapshot as Settings proof.

## Next action
- Owner demands **NO more Fedora commands until all pre-social personal-feature parity, offline/ZIP/import, encrypted full recovery, bidirectional Appwrite Cloud/Oracle↔Supabase migration rehearsals are finished in connected CI**. Then prepare ONE SHA-pinned resumable private pre-social command; no repeated manual drills or extra credential setup. Prior private recovery proofs are retained. Device checks and explicit protected Production cutover approvals remain separate. See docs/OPERATOR_ONEPASS.md and issue #1027.
- Next: accept focused & stable CI for eight-table allowlist, build actual synthetic encrypted eight-table disposable Auth/Settings restore, then signed Settings incremental transport. Do not modify hosted Scratch, `dev`, `main`, Production, user data, R2 objects or schedules.
