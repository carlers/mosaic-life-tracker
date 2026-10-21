# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #857 category retirement / explicit destructive deletion; #1029 Diary public-launch dependency; #1027 public core+Diary release.

## Baseline
- Isolated Supabase candidate stable `feature/1027-supabase-recovery-20261020@4479983878e4129a46936683352270752c503603` includes #1029 **SQL-only** owner-private Diary foundation; exact-SHA Quality Gate #39650558703 and Supabase Core App Lab #39650558595 running at branch creation. Signed Diary browser transport is **not yet implemented**, UI Diary remains unavailable on Supabase, hosted Diary table not provisioned.
- Existing approved owner-only core sync uses task and category Realtime and user has manually confirmed immediate cross-device updates on protected v0.32.5 Preview. Two preexisting orphaned tasks still need owner-consented recovery. The 2026-10-21 user scope is **public release (not invitation-only) only after private Diary and category retirement/deletion are complete**; social/chat/alerts/images deferred.
- Current Appwrite Production and newer dev/main app branches must not be altered/promoted without verified reconciliation, migration/restore, and exact release approvals.

## This branch
- Task `chatgpt/857-category-retirement-contract-current`, based on isolated core+Diary foundation stable SHA above. No version bump or UI enablement: source-only category lifecycle projection and tests.
- New `categoryLifecycle.ts` uses an inclusive owner-local YYYY-MM-DD retirement cutoff, showing a category on historical dates, hiding empty retired categories on later dates, still displaying future/undated existing tasks as read-only assignment categories, and requiring exact total task counts before destructive deletion.
- Unit tests cover leap dates, cutoff boundary, no silent future/backlog task loss, restored categories, all-days deletion count, and invalid stored date refusal.
- **Not yet enabled:** RxDB category schema migration, owner-scoped Supabase/Appwrite retirement CAS mapping, Category Manager controls, add-task disabling, actual cascade tombstones, dated Day View integration, conflict/owner tests. Existing interim auto-rehome v0.32.5 behavior remains until these are separately proven.

## Next action
- Focused Quality Gate on this task branch, fix failures, then squash to isolated beta stable and run same-SHA canonical checks (no end-user version until functional build).
- Implement persistence + UI + signed CAS and privacy/retention support before exposing category retirement; integrate owner-private Diary HTTP/RxDB writer and signed two-device negative tests before enabling Diary profile.
- Finish independent DR/restore, release architecture with current dev/main, public Auth/rate-limit/abuse protection, app-update/iOS acceptance and explicit target approval prior to removing invite hook or touching Production.
