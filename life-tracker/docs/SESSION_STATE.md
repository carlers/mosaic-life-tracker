# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #857 atomic category-and-all-tasks deletion; #1029 private Diary Realtime; #1027 public personal launch.

## Baseline and approvals
- Isolated Supabase candidate `feature/1027-supabase-recovery-20261020@3aac4e1dc76dc86379b545c60fbe6757a929cb42` includes source-only signed owner-private Diary app bridge and disposable guarded Diary Realtime migration; previous exact-SHA full Quality Gate #39701503217 and signed Core App Lab #39701503224 succeeded, current publication gates #39703623556 / #39703623438 running at task start. Hosted Diary not provisioned and public signup still gated.
- Category-retirement task `chatgpt/857-category-retirement-reconciled@85625abd3517422daf2c5e75638ec5fc5ccfa850` passed focused Quality Gate #39654659963 but remains unmerged. Current dev `ddd953842d636c41b6d8ad983684f2594c4c3e25` and main `c938c825370f8270b46f19119b06a1f74d35842b` are newer Appwrite lines and never automatically promoted. Existing hosted working owner tasks/categories data left untouched.
- Owner requires private Diary and category retirement/restore + explicit category-and-all-tasks deletion for public personal app; social/photos deferred. No Production/public Auth/dev/main or provider cutover permission beyond gated staged candidate work.

## This branch: chatgpt/857-atomic-category-tombstone
- Based on category task `85625abd...` (v0.33.0 unshipped): adds **disposable-only SQL** transaction-owned category deletion trigger, tombstoning every remaining active owner task, including remotely created tasks, as part of category CAS commit; INSERT/assignment guard serializes future category links with a category row lock; prevents deleting and then resurrecting a category via normal CAS. All rows remain soft-tombstoned with signed authority/revision triggers; no physical deletion or automatic historical repair.
- Signed E2E uses two real independent GoTrue sessions/owner leases; records category retirement, verifies historical tasks unchanged, races an INSERT against destructive category CAS, asserts no live orphaned tasks, blocks post-delete insertion and category resurrection, verifies foreign-account denial.
- Existing category UI E2E updated to require typed-name confirmation for destructive deletion, matching the reviewed retirement/delete UX. Disposable signed DB catalog gate verifies guard/cascade triggers and owner-only CAS grants.
- **Remaining concern:** task move/CAS concurrent with destructive deletion may cause a PostgreSQL deadlock and safe transaction abort; actual signed E2E and retry semantics must be reviewed before release. Appwrite category `retiredOn` remote parity, orphan cleanup and provider return still missing.
- No hosted migration or Preview activation. Source changes intentionally kept on branch separate from newer Diary stable, requiring preservation/reconciliation before merge.

## Next action
- Run focused tests and repair; reconcile v0.33.0 branch on current isolated Diary stable (do not overwrite later Diary mapping, Realtime), run exact-SHA full Quality Gate + signed disposable lab including real two-session race.
- Stage hosted migration only after backups/private-data checks; then protected Preview, Android/iOS/PWA/offline acceptance. Complete Appwrite reversibility, production upgrade compatibility, public Auth anti-abuse/rate limits and explicit target approval before signup/production changes.
