# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1029 owner-private Diary signed RxDB pilot on isolated Supabase core+Diary launch branch; #857 retirement and #1027 public release remain active.

## Verified baseline
- Isolated Supabase branch `feature/1027-supabase-recovery-20261020@ed0bb5ed56a11e9232f9f65f28760b8c0d3ff77d` includes Diary SQL table/RLS/signed CAS and owner-fenced transport, not yet hosted or active in the UI. Exact-SHA canonical Quality Gate #39654508051 and signed Core App Lab #39654509055 **SUCCEEDED**.
- Core task/category Realtime Preview v0.32.5 works according to owner manual two-device test. Current Supabase Auth remains invite-only. No public signup or Production/provider cutover.
- Owner requires public core tasks/calendar/categories/Backlogs **PLUS owner-private Diary**, category retirement/restore and explicit category+tasks destructive deletion before launch, social/chat/alerts/sharing/image uploading deferred; release safeguards preserved.
- `chatgpt/857-category-retirement-reconciled@85625abd3517422daf2c5e75638ec5fc5ccfa850` has focused Quality Gate #39654659963 SUCCESS, but needs rebase/reconcile onto later isolated stable, signed lab, server-side concurrent task deletion protection and Appwrite parity before release.

## Current task branch
- `chatgpt/1029-diary-rxdb-pilot` based on isolated stable `ed0bb5ed56a11e9232f9f65f28760b8c0d3ff77d`. **Source-only, no preview version bump or user-facing capability.**
- Added third `diary` branch to `supabase-poc/candidateRxdbPilot.ts`: private owner/date/attachment-sensitive canonical mapping; signed owner pull, create, read, exact-revision CAS; only content/emoji/updatedAt/tombstone mutable. Immutable date/privacy/createdAt/photos cannot be rewritten; conflicting offline changes remain durably pending, not silently acknowledged; foreign owners and physical deletes denied.
- Added `tests/unit/supabaseCandidateDiaryRxdbPilot.test.ts` for exact signed cursor, BigInt revisions, idempotent create, CAS patch, tombstone, immutability, simultaneous device edit conflicts, foreign rows, account switching.
- These pilot primitives are not yet bootstrapped as third app-owned writer. No backend authority or browser UI selection changes here. Do not claim synced Diary until runtime, signed hosted/local E2E and manual cross-device tests pass.

## Next action
- Execute task-focused Quality Gate; repair any type/security/test failures, then review/squash isolated stable, exact-SHA canonical and signed lab.
- Extend `candidateCoreRuntime`, `supabaseCoreBootstrap`, coordinator, Auth startup/Realtime and capability profile to opt-in core+Diary *only after* signed smoke tests and hosted owner-fenced RLS migration. Preserve explicit lease/stop/foregound/offline protections and no dual-write.
- Finish #857 all-day task cascade race and remote schema before hosting category feature. Reconcile newer dev/main and Production-safe Appwrite return; independent backup/restore, public signup anti-abuse, existing PWA upgrades and device acceptance are public launch blockers. Two older orphaned beta tasks remain untouched pending owner-approved recovery.
