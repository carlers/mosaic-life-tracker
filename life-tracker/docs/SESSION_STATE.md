# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 disposable Supabase core application vertical slice, v0.32.0 candidate.

## Baseline and authorization
- Resume from accepted `refactor/1027-signed-core-auth-20261020@c36f6be5c381d42eeadd31e07555330c3bb5664a`, PR #1075. Verified canonical #39400581257 and trusted #39400819910 SUCCESS.
- Task branch `codex/1027-supabase-core-app-20261020`. User authorizes implementation, disposable infrastructure verification and isolated Preview; no Production, real-user migration, dev/main promotion or 1.0 release.
- Version impact MINOR: 0.32.0; inspected active remote versions through dev 0.31.7.

## Implemented candidate
- Explicit provider-aware React root, neutral UI identity, signed Auth coordinator and real task/category RxDB bootstrap in the actual app; default Appwrite retained.
- Server-generated fresh-only canonical identities, private backend authority, per-signed-session leases and database insert/CAS guards. Existing Auth accounts are not enrolled. No existing-user migration or Appwrite source fencing claim.
- Backend-scoped local database; foreground/manual refresh routed to current provider; Appwrite sync startup rejected under Supabase. Core Friends loading no longer waits forever for a disabled subscription.
- Disposable real Supabase/UI browser workflow and negative lease/owner tests. Memory-only credentials; online sign-in required after reload. Recovery completion, conflict review UI, migration/reverse deltas and full MVP remain unfinished.

## Verification and blockers
- Initial task 8775781b: local 57 focused tests and build passed. Remote focused #39407272607 failed only the SyncStatusSheet async dispatch assertion; corrected provider-router import preserves the assertion and all 9 sheet tests pass. Real stack lab #39407272652 failed; detailed log download is blocked by results-receiver.actions.githubusercontent.com. Added GitHub browser annotations for actionable diagnostics in the next run.
- Repair also fences the legacy Home/profile network path, disables unsupported public profile actions, labels local preferences and limits app logout to its own device. Local 31 repair tests passed. Final remote focused and real signed UI lab acceptance still required.
- This runtime lacks Supabase management credentials. Added a secure SUPABASE_ACCESS_TOKEN requirement for api.supabase.com to the environment draft.
- Chromium CDN redirects to blocked storage.googleapis.com; local Supabase images require blocked public.ecr.aws. Draft additions saved; not runtime-applied. System Chromium is present. Dedicated GitHub disposable lab is the independent real-stack verification route.
- No hosted SQL/Auth/user-data mutation, protected promotion or deployment configuration write performed.

## Next action
- Run focused checks, inspect the real signed UI lab, repair failures as one batch, then squash the green task into an isolated stable Preview and require canonical/trusted deployment acceptance.
- Finish persistent offline session/cross-tab coordination, complete core mutation/browser coverage and conflict handling; then hosted signed security, old-Appwrite-PWA cutoff, identity migration, forward/reverse deltas and recovery with disposable accounts. Keep #1027/#967 open and put exact CI/PR/deployment evidence in the issue checkpoint.
- Diary #1029 is next after a working core release. Never promote dev/main or migrate real users without the separately required approval.
