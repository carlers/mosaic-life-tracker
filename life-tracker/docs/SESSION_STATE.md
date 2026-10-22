# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 privacy-safe source row-count audit after real encrypted snapshot decode.

## Verified baseline
- Stable isolated Supabase feature/1027-supabase-recovery-20261020@ecb5baf80707f6d5d5fae332f4fcc4f51891cac7: exact-SHA Quality Gate #39738976067, signed Core App Lab #39738976121, Synthetic Restore Lab #39738976137 and real GoTrue Restore Lab #39738976108 all SUCCESS.
- Owner privately authenticated original `mosaic-dev-20261022T031628Z.age` archive and passed offline metadata (707 TOC objects, six critical TABLE DATA entries) and seekable memfd DATA-only decode `SELECTED_DATA_DECODE_PASS`; no database restores or account data read into chat.
- Original archive includes 27 Auth TABLE DATA entries (including sessions and refresh tokens) and five other Mosaic TABLE DATA entries: `mosaic_candidate_private.beta_signup_invitations`, `mosaic_candidate_private.core_sessions`, `mosaic_poc_internal.owner_revision`, `public.mosaic_poc_items`, `public.mosaic_sync_probe`. Their row counts are unknown; none may be discarded or replayed without role/data migration review.
- Hosted mosaic-dev read-only last known aggregate: 81 Auth users, 78 marked test/banned/frozen and three unmarked; 58 tasks, 53 categories, 49 owner revisions, 81 authorities, no Storage buckets/objects; hosted Diary and category retirement absent. No provider mutation from this task.

## Task
- Create a safe count-only preflight that reads all PostgreSQL TABLE DATA entries from authenticated original ciphertext through capped anonymous Linux memfd and pg_restore COPY pipeline; returns per-table record counts only, with no row contents, IDs, emails, hashes, tokens, SQL execution, DB connections or disk plaintext.
- Add negative parser and generated-encrypted-archive CI acceptance, operator runbook and current checkpoint. No user-visible version impact; no hosted writes, dev/main merge, or Production deployment.

## Next action
- Finish focused task branch Quality Gate + synthetic row-count test, squash into only isolated Supabase candidate, and verify exact-SHA four canonical/real GoTrue/synthetic labs.
- Owner runs `python3 supabase-poc/audit_private_archive_rows.py <absolute-age-archive> <absolute-identity>` from updated isolated Fedora checkout and shares sanitized JSON only in this private chat. Compare core row counts to hosted snapshot time and reconcile nonempty Auth/storage/legacy tables prior to restoring any data.
- Real backup recovery still requires independently initialized disposable Supabase Postgres 17, explicit table dependencies, signed password and two-owner RLS, full restored row counts and data hashes, role/Auth/SMTP/Storage compatibility, public signup/Preview/mobile release gates. Keep #1027/#1029/#857 open; never upload private archive/age key or bypass managed privileges. No unauthorized dev/main/Production promotion.
