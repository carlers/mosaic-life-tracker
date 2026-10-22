# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #857 date-effective category retirement with atomic category+tasks deletion, plus #1029 private Diary / #1027 public Supabase release.

## Exact source/acceptance
- Isolated Supabase stable `feature/1027-supabase-recovery-20261020@3aac4e1dc76dc86379b545c60fbe6757a929cb42` has owner-private Diary signed RxDB app path + owner-filtered Realtime wake, **not provisioned on hosted**. Exact-SHA private Diary publication Quality Gate #39703623556 and signed Core App Lab #39703623438 passed.
- Category retirement v0.33.0 feature `chatgpt/857-category-retirement-reconciled@85625abd3517422daf2c5e75638ec5fc5ccfa850` focused #39654659963 SUCCESS, and atomic signed category deletion extension `chatgpt/857-atomic-category-tombstone@e8fedf8764ae6eb45be17c890ec2aef060bbab3a` focused #39704527901 SUCCESS. This task branch replays them on the **newer Diary+Realtime stable** while preserving concurrent transport/protocol changes.
- Core-only v0.32.5 owner data hosted remains invitation-only; `dev@ddd953842d636c41b6d8ad983684f2594c4c3e25` already v0.41.0 Appwrite; `main@c938c825370f8270b46f19119b06a1f74d35842b` is v0.29.1 Appwrite. Do NOT merge this isolated v0.33.0 candidate to newer dev/main without explicit version, provider, data and feature reconciliation; never deploy Production or open signup unapproved.

## This branch
- `chatgpt/857-core-diary-reconciled-atomic` starts at isolated stable `3aac4e1d...`.
- Includes date-effective category `retiredOn` field RxDB v2 migration and Supabase additive `retired_on`, editable historical entries with stable owner/category identity, configurable retirement cutoff and restore, future/backlogs existing-task visibility, typed-confirm independent destructive category+all-tasks action and regression tests. Category edits preserve original historical task category IDs, not implicit rehome.
- Adds a signed **server-transactional** task cascade on category tombstone, no category resurrection, row-locked live category assignment guard; real disposable E2E uses two independent GoTrue sessions to race task INSERT against deletion, asserts no committed active tasks in deleted category, checks restore of retirement remains non-destructive and foreign-owner reads are denied. Soft tombstones/owner revision triggers remain authoritative.
- Combined Supabase mapper/CAS keeps both latest Diary fields and new retirement metadata. Signed lab workflow installs Diary SQL (00003), category retirement (00004), Diary Realtime (00005), atomic cascade (00006) with owner-only catalogue checks; no live-hosted SQL changes.
- Proposed isolated Preview version v0.33.0; do not deliver while hosted schema lacks retirement/Diary.
- CAUTION: Concurrent task reassign into deleted category may deadlock and safely abort one transaction; verify owner-visible retries. The test captures an INSERT race; full reassign/offline and mobile checks remain required. Independent Appwrite backend retirement parity/provider return and two old hosted orphaned tasks require separate owner-approved migration/recovery.

## Next action
- Focused CI on reconciled branch, fix failures in batch, then isolated stable squash with same-SHA full Quality Gate and signed Core App Lab (actual GoTrue SQL races). No hosted migration or preview on a failure.
- Stage signed two-owner hosted owner-private Diary and category migrations only after reviewed backup and recovery/rollback preflight; protected versioned Preview + iOS/Android/PWA upgrade/offline conflict acceptance, current dev/app parity, public Auth rate-limits and final exact release approval required before opening public signup/Production.
