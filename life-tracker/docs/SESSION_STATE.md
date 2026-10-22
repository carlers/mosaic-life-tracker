# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 zero-cost encrypted logical backup preparation for the isolated Supabase core+Diary candidate before hosted schema changes.

## Verified stable baseline
- `feature/1027-supabase-recovery-20261020@31dd343987d183fa0516ae1f2c6d2313cbb6593c` includes owner-private Diary, date-effective category retirement and transactional category+task tombstones. Exact-SHA full Quality Gate #39707242313 SUCCESS; signed disposable Core App Lab #39707242358 SUCCESS, including two-owner real HTTP Diary privacy and a source artifact job.
- Live `mosaic-dev` remains Supabase Free, active, invite-only, with two core Realtime tables under RLS; hosted Diary table and category `retired_on` are absent. No hosted migrations or real data changed. Existing auth/users and historical orphaned tasks require preservation.
- Appwrite `dev` and `main` have newer divergent application trees. The existing v0.32.5 protected Supabase core-only Preview does not include new Diary/retirement. No direct stable-candidate promotion, public signup switch, or Production modification is permitted before explicit gates.

## Current task branch
- `chatgpt/1027-encrypted-hosted-backup-20261022` based on exact stable SHA. Add an opt-in, source-read-only `supabase-poc/hosted-encrypted-backup.sh` operator helper: exact `mosaic-dev` project host/user guard, absolute output outside Git, default fail-closed/no overwrite, encrypted streaming `pg_dump` through age, on-disk ciphertext mode 0600 and decrypt→`pg_restore --list` structural validation.
- No database backup or separate-target restore has actually been performed. A successful archive check is NOT a verified restore. PostgreSQL logical dump excludes global roles, external object bytes, environment/SMTP/GoTrue settings and separately escrowed secrets.

## Next action
- Run `[verify:focused]` on the coherent script+runbook checkpoint commit and squash PR into isolated stable only after green; then exact-SHA canonical Supabase Quality Gate + signed Core App Lab again.
- Operator must create a real encrypted off-repo hosted logical backup, independently restore to a disposable matched Supabase environment, validate Auth identity/owner-private row hashes/RLS/CAS/grants and config/media escrow. Only after recovery proof review/apply scoped additive Diary, retirement and atomic-delete hosted migrations; then signed hosted privacy, protected Preview, old-PWA/iOS and public signup abuse checks.
- Keep #1027/#1029/#857 open. No dev/main/Production promotion, release, hosted SQL or auth policy change from this task.
