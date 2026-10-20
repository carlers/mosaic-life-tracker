# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 disposable Supabase core app, v0.32.0 candidate.

## Scope and baseline
- Accepted source: `refactor/1027-signed-core-auth-20261020@c36f6be5c381d42eeadd31e07555330c3bb5664a`, PR #1075; canonical #39400581257 and trusted #39400819910 SUCCESS.
- Work: `codex/1027-supabase-core-app-20261020`, PR #1079 to isolated `refactor/1027-supabase-core-app-20261020`.
- User authorizes code, tests and isolated Preview. No Production, real-user migration, dev/main promotion or 1.0.

## Implementation
- Actual provider-aware root, neutral identity, signed Auth and task/category RxDB integration. Separate Supabase DB and provider-aware refresh; Appwrite startup rejected under Supabase.
- Fresh-only server-generated canonical identities, private backend authority and session leases enforced on inserts/CAS. Existing users are not enrolled; this does not fence old Appwrite PWAs.
- Core profile/social/task menus respect capabilities. Default Appwrite behavior retained. Memory-only credentials: reload requires sign-in.

## Evidence and current repair
- `2f2e73f341d751a894f1d674b191088cfbfbf493`: focused #39408795050 and actual Supabase app lab #39408795064 SUCCESS. Real UI category/task creation, offline completion and second-device isolation; signed lease/CAS/owner/revocation negatives.
- Expanded #39409630007 passed title editing and Backlog propagation, then first-device task control disappeared after going offline. Diagnostic #39410193248 showed a route ErrorBoundary while the remote row and second device remained intact. Lab now uses the built PWA and waits for the actual Backlogs main region before going offline; boundary diagnostics retained.
- Focused #39409630022 exposed lazy friend-module query timing; explicit import settling fixed locally (12 tests). #39410193415 failed checkpoint length; shortened here without relaxing contract.
- Local TypeScript/build/PWA/blocking bundle budgets and relevant tests pass. Full canonical/trusted delivery remains pending. CI is source of final exact-SHA evidence.

## Next action and blockers
- No Supabase management credential; secure SUPABASE_ACCESS_TOKEN requirement saved. Network draft adds storage.googleapis.com, public.ecr.aws and results-receiver.actions.githubusercontent.com; not applied. Real stack verification uses disposable GitHub lab.
- Finish current lab/focused repair, then squash green PR and require canonical/trusted acceptance. Standard Preview still uses Appwrite configuration; no hosted Supabase delivery claim.
- Remaining: offline cold start/token recovery, conflict review, complete mutation/order coverage, hosted security/recovery, old-Appwrite writer cutoff and reversible migration including offline deltas. Diary #1029 follows core release.
- Keep #1027/#967 open; record exact SHA/PR/CI/deployment and next executable action in #1027.
