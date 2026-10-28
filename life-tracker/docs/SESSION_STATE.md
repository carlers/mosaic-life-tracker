# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 source-only protected fourteen-table AFTER-registry encrypted backup and independent R2 watcher staging, in a PR targeting `main`. No deployment or main promotion authorized.

## Current verified boundaries
- Branch `chatgpt/1027-fourteen-table-offsite-staging-20261028` begins at protected `main@eae6eb99626433d93890ca2284745e0851d6db3b`; reviewed immutable recovery implementation `feature/1027-supabase-recovery-20261020@2128be03404181bdabd43e3792fc56a8a3b515be`, accepted canonical #40643925995, real GoTrue and ten/fourteen-schema synthetic restore. The new workflows are **not executable on main** before an explicit reviewed merge.
- Owner signed actual fresh BEFORE-state ten-table+whole private-media recovery point `20261028T053525682Z`: encrypted R2 readback, both age authentications, exact PG17 row parity, original-password sign-in, cross-owner denial, full media/synthetic photo byte restore and cleanup PASS. No new backup needed until 14-table registry is installed.
- Read-only `mosaic-dev` `hcxtiifzxoaflhjgoglb` ACTIVE_HEALTHY, 16 migrations ending `20261026133344`, 87 Auth identities/authorities (3 active, 84 frozen), one live authority lease, zero invalid/duplicate canonical IDs; current 6 personal RLS guards enforce owner SELECT, no direct authenticated UPDATE/DELETE. Four private identity tables + two readiness RPCs UNINSTALLED.
- New fourteen-table workflow copies the proven one-off 10-table protected pattern, requires `main` + typed confirmation + `mosaic-supabase-dr` reviewer + exact-SHA source + `fourteen-personal-identity` TOC + paired whole DB/media ciphertext verification. Second workflow accepts only R2 read-only credentials and independently verifies latest completed 14-profile bytes. No schedules, pruning, DDL, Auth, Storage or Production mutation at PR creation.
- Do not merge this PR to `main`, apply hosted additive schema, set the server release marker, enable writer fence, approve protected Preview, promote dev/main application or cut over Production without exact separate approval and existing-user impact acknowledgement. Current Core App lab signed job & artifact passed; its Preview deployment remained reviewer-waiting at last check. Version impact NONE (backend operator-only workflows).

## Next action
- Finish focused verification of these source-only workflows and their security tests, review PR diff and open a non-auto-merge PR to `main`. Record [the staged fourteen-table AFTER-state process](SUPABASE_FOURTEEN_OFFSITE_GATE.md) in #1027.
- Once the owner explicitly approves the *exact* main-only protected workflow PR and controlled additive `mosaic-dev` category/registry/readiness schema stage with one active writer lease acknowledged, reconcile live preflight; perform DDL only under reviewed target-specific approval, then dispatch protected 14-table backup and read-only watcher. Independent 14-table Fedora restore, hosted signed security checks and manual signup/reset/device acceptance are next distinct gates. Old writer cutoff remains excluded.

## Previous checkpoint (2026-10-23; historical, not current task)
Updated: 2026-10-23 Asia/Manila
Current task: #1276 UI release candidate from dev to main; reconcile main-only CI trust history first.

## Release preparation (2026-10-23)
- Owner explicitly requested dev→main user-visible UI rollout now while Supabase remains isolated and Appwrite is reportedly unavailable. This is approval to prepare the protected promotion, **not evidence of healthy backend sync, passing gates, or data safety**.
- Protected source refs at review: dev `ebc8614f379dcd7934316cd5c299d40ceae75e16` (0.43.8) and main `c938c825370f8270b46f19119b06a1f74d35842b` (0.29.1); branches diverge. Main has four unique trusted PREBUILT script/test edits and this checkpoint, so PR #1276 is initially unmergeable.
- Isolated two-parent ancestry reconciliation candidate must take dev as first parent, main as second, retain dev application source and 0.43.8, take all four main-only trusted writer/contract/test blobs verbatim, and resolve this checkpoint deliberately. No Appwrite/Supabase schema, Function, credentials, user data, Production deployment or protected ref change is part of this candidate.
- Verify exact candidate source diff, run full stable Preview canonical and trusted Preview deployment; only then promote via protected PR to dev with policy checks. Recheck dev→main PR #1276 after integration; release may proceed only if the normal CI, backend/data-compatibility, Production acceptance and publishing gates are actually met. Do not bypass gates because Appwrite is unavailable, substitute Supabase or tag 1.0.0.
- Existing #1245 drag optimization work and manual device acceptance remain independently tracked below.

## Previous task checkpoint — #1245

Updated: 2026-10-23 Asia/Manila
Current task: #1245 follow-up: stabilize task drag sensor configuration through nested bottom-sheet renders (v0.43.8 candidate).

## Verified baseline and authorization
- Stable `perf/1245-day-slide-prop-stability-v0437-20261022@6d14c5b1d50b0aff41a5a8b734a424849034de1d` (v0.43.7) passed exact-SHA canonical Quality Gate #39883528760 (attempt 3) and trusted Preview Delivery #39884574463. Vercel deployment `dpl_Bsbx9aLPKtpw2s6B2MF9HJzxb9vX` is READY; authenticated Scratch user/device testing has not been performed.
- The diagnostic-only profiling fixes (React commit window, LoAF separation, Task Actions close/reopen) were merged with PR #1265. No quantitative responsiveness gain has been measured.
- `dev@fcfd860c3bc4d975ab62ac5b6523ad3b206c03f6` remains v0.43.6, and `main@c938c825370f8270b46f19119b06a1f74d35842b` is unchanged. No protected promotion is authorized.

## Scoped v0.43.8 refinement
- Task branch `chatgpt/1245-stable-reorder-sensors-v0438-20261023` starts from stable `6d14c5b`. In `TaskReorderRuntime.tsx`, hoist the pure `DragDropProvider.sensors` factory so nested overlay rerenders no longer allocate a distinct factory reference; retain identical pointer delay/tolerance, filtering of built-in sensors, keyboard sensor, and drag lifecycle.
- Bump the Preview candidate version to 0.43.8 in the three canonical source files; no schema, network, sync, focus, sheet geometry, or animation settings changes.
- This is a code-identity optimization hypothesis, **not** a proven latency improvement. Avoid broad memoization of DaySlide/Diary (previous v0.43.7 unsafe memo broke held cross-day drag). Issue #1245 stays OPEN.

## Verification and next step
- Review exact diff; run focused source/build checks on a committed `[verify:focused]` task checkpoint, then squash to stable Preview only if green. Complete new full canonical gate and trusted Vercel exact-SHA READY. Explicitly inspect existing held native-touch/mouse cross-day drag, category reorder and nested sheet browser contracts. Keep the accepted old v0.43.7 Preview as fallback.
- Require physical-device comparison before claiming subjective smoothness. The unrelated intermittent left split-panel month alignment failure in previous canonical attempt 1 is tracked on #404; a retry passed.
- Do not merge to `dev`/`main`, modify Production, or relax tests/security gates without explicit approval.

## 2026-10-25 isolated Supabase R2 one-off pilot (#1027)
- User approved only a narrow main-side DR workflow bootstrap plus controlled Scratch-only offsite verification, with no Supabase application/provider cutover and no Production data writes.
- Add two GitHub Actions workflows on main, source-pinned to the CI-accepted isolated recovery commit `18e7f2c28e833dd9bc6f8b66174d37dbd3c908e8`. They run only on main. Scheduled runs remain gated by the repository variable `SUPABASE_DR_ENABLED=true` (leave **false**); manual dispatch requires the exact confirm phrase in the workflow input.
- The backup hard-disables retention pruning and asserts bucket `mosaic-supabase-backups`, Scratch source project and exact pinned source SHA. It requires protected environment `mosaic-supabase-dr`. The read-only watcher uses separate reader credentials. No secret is introduced into Git, no backend/cloud source data is modified by these workflows.
- Operator reported protected GitHub/R2 setup; environment/lock/tokens remain independently unverified because connected GitHub access cannot read those settings. A real encrypted offsite upload/read-back/restore and delivered alert remain necessary. `dev`/`main` CI and production rebuild must be verified after promotion; do not release a new app version or enable daily scheduling.

## 2026-10-25 separately approved failure-email-only main rollout (#1027)
- Owner approved narrow dormant Scratch DR Brevo alert workflow promotion through protected main; NOT migration, Prod backend/data changes, automatic alerts, pruning, daily schedules or copying other Supabase recovery branch code. Dev and main started with identical source tree `3d3fecef80b266795451b02950db431446522a04`.
- Carry only `.github/workflows/supabase-full-offsite-alert.yml` from accepted isolated recovery source, one main-scoped workflow regression and this checkpoint. Pin checkout to accepted reviewed `1b84c2b66bf0d90170a7b1bafed21dcdd1fd4199`; protected environment, read-only permissions, manual typed test and automatic workflow_run gate `SUPABASE_DR_ALERT_ENABLED=false` until verified inbox delivery.
- Separate owner-held Brevo API key, verified sender and receiving address configuration still required; do not send or claim delivery without protected setup. R2 encrypted snapshot `20261025T031343499Z` successfully uploaded, independently watched and local Fedora restored; native >=30d lock GET readback PASSED, destructive deletion not tested. No repeat needed.
- Next: focused task→new stable canonical→protected dev→protected main exact-tree CI and Vercel READY; after rollout configure protected alert keys/variables and one synthetic email test. Keep #1027 OPEN.
