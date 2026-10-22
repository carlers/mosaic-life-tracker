# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 owner-provided encrypted archive TOC PASS; offline data decoding preflight.

## Verified baseline
- Isolated Supabase stable feature/1027-supabase-recovery-20261020@277db87915f95f807936035af37abc2318e67ac0; exact-SHA full Quality Gate #39732857270, signed GoTrue Core App Lab #39732857286, nine-table Synthetic Restore Lab #39732857266 and real GoTrue reset-and-restore #39732857308 all SUCCESS.
- Owner executed private Fedora `inspect-encrypted-backup-toc.sh` on `mosaic-dev-20261022T031628Z.age`: METADATA_ONLY_NOT_RESTORED; 707 TOC entries, 75 Mosaic-owned entries, 9 Mosaic-owned data entries, 537 platform managed entries (490 definitions), auth users/identities/sessions present, exactly 6/6 critical data entries present, missingRequiredEntries empty, restoresPerformed 0. Result **does not** verify data decoding or actual restore.
- Read-only hosted mosaic-dev aggregate at previous checkpoint: 81 Auth users, 78 marked disposable/banned/frozen and 3 unmarked; 81 Auth identities, 184 sessions, 58 tasks (9 live), 53 categories (1 live), 49 owner revisions, 81 authorities (78 frozen), no Storage buckets/objects. Hosted Diary/retirement not installed. No cloud mutations performed in this work.

## Task
- Add credential-free, read-only private backup preflight that authenticates age ciphertext, builds strict six-entry TABLE DATA plan from archive TOC, reports extra Mosaic-only table identifiers for review and uses anonymous Linux seekable memfd (256 MiB cap) to decode selected SQL to /dev/null without DB connection or plaintext disk file. No data, tokens, role names or secret keys appear in the output.
- Add negative tests for absent or duplicate objects and synthetic encrypted archive CI rehearsal; document exact operator command and limitations. No app version impact; no provider, dev/main, Production or live user data changes.

## Next action
- Run focused task Quality Gate + disposable synthetic lab. If green, squash into isolated Supabase feature and verify full canonical and all three Supabase labs on merged SHA.
- Owner then runs the offline decode-only check in supabase-poc/RESTORE_TOC.md and shares its sanitized JSON/final PASS line. Determine the additional custom tables and Auth/managed-schema compatibility before designing any real restore into separately initialized disposable Supabase.
- Actual encrypted snapshot recovery, Auth/passwords and multi-owner privacy verification, device/Preview/security gates, hosted Diary/category migrations, public signup and release all remain unverified/blocked. Keep #1027, #1029, #857 open; never upload backup/private key, bypass managed roles or promote dev/main/Production without separate approval.
