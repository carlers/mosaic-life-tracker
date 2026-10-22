# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1029 private Diary end-to-end app bridge, #857 historical category lifecycle, #1027 public personal release.

## Current live baseline
- Isolated Supabase stable `feature/1027-supabase-recovery-20261020@c1b4db018f2df9bf91b6acb29d9ccfe24fbebd3c` includes signed owner-only Diary SQL/pull/create/CAS/RxDB pilot and source-only third writer under a single authenticated core lease. Focused runtime #39699728726 SUCCESS; merged-SHA Quality Gate and signed Supabase Core App Lab pending. No hosted Diary migration, UI profile enablement, or public signup.
- Owner manually verified two-device tasks/categories Realtime on protected v0.32.5 core-only Preview. Hosted Supabase Auth remains invitation-only; no live DB/Prod/Appwrite switch.
- #857 retirement/cascade branch `chatgpt/857-category-retirement-reconciled@85625abd3517422daf2c5e75638ec5fc5ccfa850` focused #39654659963 SUCCESS, not yet merged; server-side atomic concurrent deletion protection and Appwrite provider schema parity remain release blockers.
- Explicit owner target: public tasks/categories/calendar/Backlogs **plus private Diary**, category retirement and explicit category+tasks deletion; social/chat/alerts/shared/media deferred. Do not release before signed privacy, disaster recovery, PWA migration, safe Auth abuse controls and exact approved cutover.

## This task branch
- `chatgpt/1029-core-diary-app-bridge` based on stable `c1b4db...`; no production or hosted changes and no Preview version bump until user-testable.
- Adds explicit `core-diary` feature profile to backend capabilities + Supabase config (core and private Diary only; social/chat/alerts/image uploads disabled).
- App Supabase bootstrap/coordinator starts all three local RxDB collections under one verified owner lease. Exposes conditional Diary replication state, resync and conflict review, while legacy core-only still starts exactly two writers.
- Auth provider selects only explicit profile, tracks dynamic writer activity and subscribes to optional owner-filtered Diary INSERT/UPDATE wake hints. Never applies Realtime payload as data or includes DELETE events.
- Preserves offline Diary drafts and allows an accessible owner-only conflict comparison; disallows keep-local if privacy/date/attachment/creation identity changed.
- Diary editor in core-diary hides public/friends visibility, social reaction fetch and photo uploader, while useDiary rejects unsupported public/photo changes BEFORE writing an unsyncable local entry.
- Adds feature/config, three-table realtime and private Diary conflict negative tests; existing core-only behavior should remain intact.
- No hosted Diary table or Realtime publication yet. *Not safe to activate* until disposable signed client/browser & cross-account tests, hosted additive migration, capability UI Preview and backup/return acceptance.

## Next action
- Run task-focused Quality Gate, repair TS/UI/behavior failures, squash to isolated stable only on green and rerun exact-SHA full Quality Gate + signed local lab.
- Add guarded local/hosted Diary Realtime publication migration and end-to-end signed owner/private negative + offline/two-device sync tests on disposable accounts, then versioned protected Preview for user acceptance. Ensure no actual public signup before rate/abuse, backups, PWA return, category deletion race, Appwrite parity, and current dev/main reconciliation.
