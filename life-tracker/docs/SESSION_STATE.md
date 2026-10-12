# Session checkpoint

Updated: 2026-10-12
Current task: Issue #708, message delivery and cross-device reconciliation. No dev/main or Production promotion.

## Verified baseline
- Stable Preview `fix/chat-reliability-708-20261012@c2f7b00f2aa277057314477a4a96e990fd297215` v0.24.0; canonical Quality Gate 38245940586 SUCCESS; exact-SHA Vercel deployment `dpl_7p15qDzbzpQegqw9495rCV6KvD22` READY, 7/7 asset budgets PASS; stable alias `mosaic-life-tracker-git-fix-chat-9dae4d-carls-projects-72516fde.vercel.app`. `dev` was `b878519`.
- Initial improvements: fail-closed two-row delivery, receipt validation, transient retry, compose draft retention/double-send prevention, conservative orphan preservation by global Sync Now. Tests added and passing in stable canonical CI.
- Authorized Scratch rollout on project `6a96e82d000d1310b3be` and Function `6aa8057f002a4c306fdd`: checked old source at Git SHA `0c0a7a36`, where all helper files matched target and only `main.js` differed. Packaged 11 exact Git blobs from `c2f7b00` into a gzip tar, built **inactive** `6accd2fa220cb704e674` READY, and requested activation. A subsequent read-back confirmed it became the active Scratch deployment. Prior rollback deployment `6accb9addc5321121ebb` retained. One harmless invalid-format deliver execution returned 400. No real two-account messaging smoke or user browser/device test has been performed. No Production writes.

## Current task branch and design
- Task branch: `chatgpt/708-thread-repair-20261012` from v0.24.0 stable Preview. Candidate v0.24.1 in the three standard version files.
- Server `repair_thread` action: mutually accepted friend validation; two staged owner-scoped pages (self then peer) of <=50 rows ordered by created_at; deterministic `msg_ / rmsg_` identity and owner checks; create only missing, non-deleted/non-unsent counterpart rows with recipient-only permissions; reject conflicts/uncertain reads; handle duplicate create race safely; bounded cursors.
- Client `reconcileChat` invoked through Chat header Sync: attempt pending delivery; fail closed while local pending persists; walk at most 30 repair pages with owner-generation guard; await existing global `syncNow` freshness and reconciliation before claiming success. No always-on extra polling.
- Added handler and client-unit regressions for both-side repair, permissions, unsend/delete preservation, pagination, conflict, race, freshness, pending, account switch.
- **New v0.24.1 source has not been deployed** to either Vercel or Scratch; the current active Function is the earlier v0.24.0 code. Avoid an inconsistent new server/client rollout.

## Remaining gates
- Run focused CI (repair test failures), review code, squash into stable Preview, verify canonical CI and Vercel READY against exact version/SHA and unchanged size budgets.
- Once those pass, compare active Scratch helper SHA compatibility, package exact new Function commit, inactive READY build, carefully activate, and read back. Retain prior rollback ID. Check index schema and Scratch auth/origins. Test with disposable two-account, two-browser flows only (never production data).
- Historic partial-pair reconstruction is possible only where one safe server copy survives; no rollback/resurrection of intentionally unsent/deleted content. Still need latency baselines, mobile/browser manual acceptance, and release decision. Issue #682 stays deferred.

Next action: focused verification for v0.24.1, repair failures, then stable Preview canonical + Vercel acceptance and compatible Scratch Function activation. Do not merge to dev/main before user acceptance.
