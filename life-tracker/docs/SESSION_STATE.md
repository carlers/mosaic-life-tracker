# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1029 private Diary Realtime publication contract, #857 historical category retirement, #1027 public personal launch.

## Verified live baseline
- Isolated Supabase candidate `feature/1027-supabase-recovery-20261020@ae9ef8a53a0a78271ab73f24ff8da46ea9f29c7e` includes private Diary schema, owner-signed transport, RxDB pilot, single-lease third writer, gated `core-diary` browser bridge, private conflict UI and owner-filtered notification wake; exact-SHA full Quality Gate #39701503217 and signed Supabase Core App Lab #39701503224 both **SUCCESS**. No hosted Diary table or category retirement column; core-only v0.32.5 Preview remains live.
- Production `main@c938c825370f8270b46f19119b06a1f74d35842b`, `dev@ddd953842d636c41b6d8ad983684f2594c4c3e25` are separate Appwrite lines. No public signup or provider cutover authorized.
- Owner scope: public core+private Diary, category retirement/restore and separately confirmed category+tasks deletion, no evolving labels. Social/chat/alerts/sharing/images deferred. iOS, PWA upgrade, backup/restore, security, provider return remain gates.

## Current task branch
- `chatgpt/1029-diary-realtime-catalog` starts from accepted `ae9ef8a...` and stages **disposable lab only** private Diary Realtime publication migration and owner-RLS/grants catalog validation. Existing Postgres Changes are wake hints; browser consumes only signed owner INSERT/UPDATE notifications then uses authenticated incremental pull. No client DELETE subscription or direct payload application.
- Migration must refuse uninstalled Diary, missing publication/RLS/owner SELECT or unsafe anon and direct UPDATE/DELETE privileges. Signed local Supabase Core App Lab must install/verify it after private Diary table migration.
- The added publication does NOT install anything on hosted `mosaic-dev`. No Preview version, public signup, dev/main or Production mutation.

## Next action
- Focused Quality Gate, then isolated stable exact-SHA full Gate + signed Core App Lab if green; diagnose true failures. Host changes only after explicit signed two-owner/offline data isolation acceptance, trusted backup/restore and rollout checks.
- Resolve #857 server-atomic all-task cascade and concurrent write denial, preserving history. Reconcile current Appwrite dev/main, safe rollback and public Auth anti-abuse before launch. Keep issues open.
