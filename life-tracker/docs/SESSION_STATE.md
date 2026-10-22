# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1029 core+private Diary app bridge acceptance, #857 category retirement, #1027 public launch.

## Isolated release state
- Stable Supabase candidate `feature/1027-supabase-recovery-20261020@ceff90f215a777dfc264d6bfad2a80a6f0d87929` includes signed Diary SQL source, transport, native RxDB pilot and app bridge. No hosted Diary table/Realtime publication or opt-in Diary Preview enabled. No public signup, dev/main or Production changes.
- Focused app bridge CI #39700677505 SUCCESS and stable unit/DOM/browser checks #39701006930 SUCCESS, but **build failed** because one dynamic Realtime table type assertion still referred to deleted compile-time `TABLES` identifier. Isolated signed Supabase Core App Lab #39701006926 is pending. Fix in this task branch is just a one-line TS type assertion repair, not a change to session fencing.
- Protected core-only v0.32.5 tasks/categories works per owner manual two-device test. #857 retirement reconciled task `85625abd3517422daf2c5e75638ec5fc5ccfa850` focused green but not shipped; server atomic category+tasks race and Appwrite provider parity unresolved.

## Current task branch
- `chatgpt/1029-core-diary-realtime-build-fix` starts at `ceff90f2...`; changes only outdated type `as typeof TABLES[number]` -> `as string` for the newly dynamic per-profile subscribed table names. All event validation still checks `tables.includes` and owner/session filters.
- Compile/error scope only. No Preview version bump, SQL migration, hosted data or public Auth change.

## Next action
- Run focused CI then squash into isolated stable and confirm exact merge SHA full Quality Gate + signed Core App Lab; do not activate Diary until signed hosted migration (including Realtime), two signed owners, offline/concurrent and private conflict E2E pass.
- Complete category #857 retirement/atomic deletion, Appwrite reversibility, backup/restore and old PWA upgrade, public Auth abuse controls, current dev/main reconciliation and explicit Production approval before release.
