# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 hosted Supabase core verification, based on accepted v0.32.0.

## Accepted source and boundary
- Baseline: `refactor/1027-supabase-core-app-20261020@052a4658b55e25bc5b34a416c923fe604f0a3339`, PR #1079. Canonical #39412036803, local real-stack lab #39412036661 and trusted frontend Preview #39412277835 succeeded. Full evidence: #1027 comment 6289391812.
- Task: `codex/1027-supabase-hosted-20261020`; intended stable branch `refactor/1027-supabase-hosted-20261020`. Version impact NONE: verification/tooling only, still 0.32.0.
- No Production, real-user migration, dev/main promotion or 1.0. Ordinary Preview still selects Appwrite; this task does not silently retarget it.

## Hosted state
- Environment token now reaches healthy isolated `mosaic-dev` (`hcxtiifzxoaflhjgoglb`). Database queries, project keys and security advisors work. Auth configuration readback returns 403 (`auth_config_read`); public settings show email confirmation enabled.
- Read back the seven earlier migrations and confirmed zero Auth users/tasks/categories before rollout. Installed the accepted protected-fields and fresh-authority SQL transactionally as `20261020130000` / `20261020130001`; exact stored statements matched source. No existing account was enrolled.
- New `supabase-poc/hosted-core.mjs` defaults to read-only inspection. Explicit empty-project rollout locks/checks the baseline in its transaction. Signed security tests create only run-marked disposable users, verify owner/RLS/CAS/lease boundaries, then tombstone rows, freeze authority and ban accounts.
- `hosted-core-ui.mjs` builds the actual app with only the development publishable key and runs the existing UI contract. Browser coverage now also exercises category rename/reorder/offline deletion and Calendar → Day View editing.
- Runbook: `supabase-poc/HOSTED_CORE.md`. Credentials stay in memory, out of source/output/build inputs.

## Verification and blockers
- Four harness safety tests and ten existing CAS transport tests passed; contracts/discovery/diff checks passed. Explicit core production build passed during the hosted attempt.
- Standalone hosted probe `b9c6a3cb63c7bb2f4d73574b` PASSED on task `656f1b38`, including retirement readback: two verified users, four rows, four foreign reads, 25 denials, two CAS winners/two conflicts, five guard cases, four tombstones and two retired accounts. Focused #39429247886 passed; lab #39429248010 exposed missing Home navigation from Backlogs before reopening Categories. The test now performs that real user action. PR #1096 remains unmerged pending repaired lab/stable acceptance.
- Harness repairs: request usable modern secret keys explicitly; recognize typed SQL-null conflicts; remove a dynamic-import cycle; keep HTTP deadlines referenced. Interrupted run `349667cbf61e299a8c8d4040` was recovered with scoped disposable password grants: four rows tombstoned and four accounts frozen/banned.
- Playwright 1.58 forced loopback through the proxy; its supported loopback setting fixes this and local routing passes. The user explicitly approved the environment proxy CA import after automatic review rejected it. Import executed; the provided CA already matches an existing NSS entry, but Chromium still rejects the hosted certificate. Diagnose the browser trust-store location/access; preserve TLS verification. Independent local-stack CI remains available.

## Next action
- Finish hosted signed probe/readback and expanded browser verification, then focused task CI + local real-stack lab; squash into the named stable Preview only after green, followed by canonical/trusted delivery. Record exact SHAs/PR/runs in #1027, without a status-only post-green commit.
- Resolve Auth policy readback and hosted Preview build-input parity. Complete offline cold-start/expired-token/cross-tab recovery, conflict UI, existing-user Appwrite writer cutoff, forward/reverse migration with pending edits/tombstones and encrypted DR.
- Mandatory migration/device/hosted Preview acceptance remains separate. Keep #1027/#967 open; Diary #1029 follows the working core release.
