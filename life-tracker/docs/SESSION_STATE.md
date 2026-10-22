# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 fix encrypted hosted backup helper exit 141 on Fedora; continue core+Diary release recovery gate.

## Verified source baseline
- Isolated `feature/1027-supabase-recovery-20261020@b5653aa007a041bb9c823563d68b408d4895f108` has candidate owner-private Diary and date-effective category retirement / atomic deletion, plus a source-read-only encrypted hosted backup helper. Merged-source Quality Gate #39710007352 SUCCESS; signed Core App Lab #39710007344 SUCCESS.
- Supabase Free `mosaic-dev` hosted remains protected / invite-only with task/category Realtime, no hosted Diary or retired_on, no hosted migrations or public signup. Do not promote to `dev`, `main` or Production without approved gates. Appwrite dev/main diverge.
- Fedora operator already cloned isolated branch, connected PostgreSQL 18.6 client using the official project pooler and generated a private local age key. The backup run returned **141 (SIGPIPE)** with **zero published files**, so NO backup has been produced, and no user data was changed.

## Current isolated fix
- `chatgpt/1027-backup-sigpipe-fix-20261022` fixes inspection where `pg_restore --list` closes the pipe after TOC/header and upstream `age` gets SIGPIPE. Independently decrypt complete age archive to /dev/null (verify full ciphertext authentication); metadata-only `age | pg_restore --list` must report pg_restore success and permits upstream producer 141 only, rejecting other nonzero statuses. Preserve fail-closed cleanup, no plaintext file, exact project host restrictions and nonclobber.
- Add deterministic Vitest mock regression for expected early-reader SIGPIPE, unreadable age archive, failing pg_restore and wrong project. Local bash mock smoke exercised these cases successfully; task-focused CI pending until task branch push.

## Next action
- Commit task checkpoint [verify:focused], run focused green, squash PR onto isolated stable, ensure exact-SHA full Quality Gate + signed Core App Lab green.
- Then operator: `cd ~/mosaic-supabase-backup/life-tracker && git pull --ff-only`, confirm script updated; re-enter database password (cleared by previous `unset PGPASSWORD`), run encrypted script with **fresh** outside-repo output name, check generated `.age` archive and printed checksum. Never send DB password, encryption private key, or encrypted archive through chat.
- Independent isolated restore and Auth/Storage/config/global-roles recovery verification **still required** before hosted Diary/category migrations, public signup or Production release. Keep #1027/#1029/#857 open.
