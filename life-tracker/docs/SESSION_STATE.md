# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1029 Diary single-lease runtime, next after signed RxDB pilot; #857 category retirement, #1027 public core+Diary launch.

## Verified starting point
- Supabase isolated stable `feature/1027-supabase-recovery-20261020@bed8d4cc16d4a9e4a566201c3747afaeada3e030` contains owner-private Diary DB migration source, signed transport and native RxDB pilot, but the hosted Diary table and app runtime/UI are NOT activated. Diary pilot task `9448fc8de6a0a5c771b908101e50c753a401555b` passed focused #39699159433. Merged exact-SHA full Quality Gate #39699311911 and Core App Lab #39699311346 pending at branch creation.
- Stable core-only v0.32.5 Preview task/category Realtime manually accepted by owner. Public signups remain invite-gated. No dev/main, Production, live schema, PWA/provider migration or social changes.
- User's approved target: public tasks/calendar/categories/Backlogs and PRIVATE Diary; category retirement and explicit category+tasks deletion, no evolving category labels. Social/chat/alerts/sharing/images deferred. Retired categories v0.33.0 task `chatgpt/857-category-retirement-reconciled@85625abd3517422daf2c5e75638ec5fc5ccfa850` focused #39654659963 succeeded but remains isolated; remote race/atomic cascade and Appwrite parity unverified.

## This task branch
- `chatgpt/1029-diary-single-lease-runtime` based on `bed8d4c...`, no Preview version bump because not externally selected.
- Introduces *explicit source-only* `featureProfile:'core-diary'` on `createCandidateCoreRuntime` with mandatory diary collection. The legacy `core-only` option still starts exactly two writers. The third Diary RxDB pilot is created only under the matching profile and joins the **same signed session, verified legacy mapping, Appwrite fencing and exclusive owner lease**; shutdown, partial-failure cleanup, initial readiness, resync and conflicts all account for the third writer. No separately acquired backend lease.
- Adds runtime tests for three-domain single-lease operation, start failure cleanup and unaffected legacy two-domain flow.
- **Not enabled in AppSupabaseCoreBootstrap, capability UI, hosted schema or installed PWAs.** The returned third-conflict data requires visible conflict-review wiring and signed end-to-end owner verification before feature activation. No public signup changes.

## Next action
- Run task-focused Quality Gate, repair failures; squash to isolated stable if green, then same-SHA full Quality Gate and signed lab. Next implement opt-in app/bootstrap/coordinator/runtime UI Diary conflict state, Realtime wake and validated hosted migration to actually enable the private Diary.
- Complete #857 server-side atomic category deletion and Appwrite provider parity, user consented orphan recovery, upgrade/PWA, backups/restore and public Auth abuse controls; reconcile newer dev/main before exact-release authorized public launch. Keep current working hosted beta untouched until verified.
