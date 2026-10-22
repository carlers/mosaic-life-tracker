# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 safe metadata-only inspection of encrypted live snapshot before isolated Supabase recovery.

## Verified boundary
- Isolated `feature/1027-supabase-recovery-20261020@04b0d42ed6143ec835377f0121cbefd73a0a01f9`: canonical Quality Gate #39713598138 and signed Core App Lab #39713598104 SUCCESS.
- Owner-created, off-repository `mosaic-dev-20261022T031628Z.age` was checksum-verified and fully decrypted into `pg_restore` with exit 0. Its plaintext contents/private key are local only and unavailable to a connected chat agent.
- Local PostgreSQL 17.11 on 127.0.0.1:25077 has native `auth.users` and no Mosaic app tables. Full raw archive restore failed/rolled back on protected managed `realtime.list_changes` definition. No independent restore accepted.
- Hosted `mosaic-dev` has task/category schema and isolated Realtime only, no private Diary/retirement migrations. Do not modify hosted data, Auth, dev/main or Production before independent restore and release gates.

## Scoped task
- `chatgpt/1027-safe-backup-toc-20261022`: read-only age archive TOC inventory, returning sanitized object counts, refusing missing core/Auth entries and avoiding managed object replay. Add parser regressions and `supabase-poc/RESTORE_TOC.md`.
- Local source checks, focused CI and source acceptance must be recorded after actual runs. No user-facing version bump; no API/project writes.

## Next action
- Verify exact source/CI and review the inventory logic; combine into isolated stable Preview only after required gates. The encrypted snapshot remains on the owner's machine. An actual restore still requires private local execution or an independently authorized secure worker with access to the encrypted snapshot and key. Do not request those secrets in chat.
- After a safe object-level restore plan and independently proven Auth/RLS/CAS recovery, separately authorize hosted Diary/category migrations, public signup and release. Keep #1027, #1029 and #857 open.
