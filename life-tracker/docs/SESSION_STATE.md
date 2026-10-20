# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 hosted Supabase core verification, based on accepted v0.32.0.

## Accepted source and boundary
- Baseline: `refactor/1027-supabase-core-app-20261020@052a4658b55e25bc5b34a416c923fe604f0a3339`, PR #1079. Canonical #39412036803, local real-stack lab #39412036661 and trusted frontend Preview #39412277835 succeeded. Full evidence: #1027 comment 6289391812.
- Task: `codex/1027-supabase-hosted-20261020`; intended stable branch `refactor/1027-supabase-hosted-20261020`. Version impact NONE: verification/tooling only, still 0.32.0.
- No Production, real-user migration, dev/main promotion or 1.0. Ordinary Preview still selects Appwrite; this task does not silently retarget it.

## Hosted state
- Environment token now reaches healthy isolated `mosaic-dev` (`hcxtiifzxoaflhjgoglb`). Database queries, project keys, security advisors and Auth configuration readback work. After the user updated token permissions, Auth readback returned 200: email confirmation required, refresh-token rotation enabled, reuse interval 10 seconds, JWT expiry 3600 seconds. Leaked-password protection remains disabled; no Auth policy was changed.
- Read back the seven earlier migrations and confirmed zero Auth users/tasks/categories before rollout. Installed the accepted protected-fields and fresh-authority SQL transactionally as `20261020130000` / `20261020130001`; exact stored statements matched source. No existing account was enrolled.
- New `supabase-poc/hosted-core.mjs` defaults to read-only inspection. Explicit empty-project rollout locks/checks the baseline in its transaction. Signed security tests create only run-marked disposable users, verify owner/RLS/CAS/lease boundaries, then tombstone rows, freeze authority and ban accounts.
- `hosted-core-ui.mjs` builds the actual app with only the development publishable key and runs the existing UI contract. Browser coverage now also exercises category rename/reorder/offline deletion and Calendar → Day View editing.
- Runbook: `supabase-poc/HOSTED_CORE.md`. Credentials stay in memory, out of source/output/build inputs.

## Verification and blockers
- Four harness safety tests and ten existing CAS transport tests passed; contracts/discovery/diff checks passed. Explicit core production build passed during the hosted attempt.
- Standalone hosted probe `b9c6a3cb63c7bb2f4d73574b` PASSED on task `656f1b38`, including retirement readback: two verified users, four rows, four foreign reads, 25 denials, two CAS winners/two conflicts, five guard cases, four tombstones and two retired accounts. The test now returns Home from Backlogs before reopening Categories; repaired head `3c3f9b8e` passed focused #39430295855 and real local-stack lab #39430296005. PR #1096 remains unmerged pending final diagnostics/stable acceptance.
- Harness repairs: request usable modern secret keys explicitly; recognize typed SQL-null conflicts; remove a dynamic-import cycle; keep HTTP deadlines referenced. Interrupted run `349667cbf61e299a8c8d4040` was recovered with scoped disposable password grants: four rows tombstoned and four accounts frozen/banned.
- Playwright 1.58 forced loopback through the proxy; its supported loopback setting fixes this. The user explicitly approved the environment proxy CA import after automatic review rejected it. The provided CA matches an existing NSS entry. Chromium additionally needs writable access to initialize its NSS database; the same HTTPS diagnostic passes with that access and certificate verification enabled.
- Hosted browser run `defe11f80a976cb7fa409fb5` PASSED (2.2 minutes): actual signed UI, task/category CRUD, Calendar/Day View, Backlogs, offline completion/deletion replay, category reorder, second-device convergence and owner isolation. A prior attempt failed the 15-second category assertion; this run uses a bounded 45-second hosted default with every assertion preserved. Failure diagnostics now record bounded method/path/status counts without headers or credentials and redact disposable secrets.
- After the environment restart, exact disposable cohort `ec9374be46eb9a23b5749ae4` was recovered and aggregate readback confirmed all 22 fixture users frozen/banned with zero live task/category rows. Auth/update checkpoint: #1027 comment 6292342917.
- Full hosted `--ui` command completed successfully, including the signed security probe and retirement readback: four verified users, four security fixture rows, 25 denied writes, two CAS winners/two conflicts, five guard cases, five additional cleanup tombstones and all four accounts retired. UI-created tombstones are checked separately in the browser contract; cleanup confirmed no live rows for this run.

## Next action
- Run final focused task CI + local real-stack lab; squash into the named stable Preview only after green, followed by canonical/trusted delivery. Record exact SHAs/PR/runs in #1027, without a status-only post-green commit.
- Resolve hosted Preview build-input parity and the leaked-password protection finding. Complete offline cold-start/expired-token/cross-tab recovery, conflict UI, existing-user Appwrite writer cutoff, forward/reverse migration with pending edits/tombstones and encrypted DR.
- Mandatory migration/device/hosted Preview acceptance remains separate. Keep #1027/#967 open; Diary #1029 follows the working core release.
