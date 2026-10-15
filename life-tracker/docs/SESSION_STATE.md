# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #889 repair isolated disaster-recovery restore fidelity; Production/main/dev unchanged.

## Verified state
- Protected dev at `9c3152cdc6f92950cb0b54677b68b86c022508a3`, v0.29.1. Owner-approved PR #906 merged current protected main ancestry into dev without source-tree differences; main is dev's ancestor. Stable source `2820f7f8f5f2e73250fa929376ba3b55b505ad62` full canonical #38758786372 SUCCESS (first attempt), protected trusted Preview #38759081119 SUCCESS, CLI Vercel `dpl_G9THiGgHRsDYc8ktjs4oz5Xj3VQm` READY.
- Protected main `bb58300052dc4c85974d97779e2b257ec4f28c7d` Production v0.17.4 unchanged. No Production backend schema/Function, R2, main product/version/tag write from #889.
- The no-file-change PR #906 did not trigger dev path-filtered postmerge Quality Gate. This documentation task records enforceable release-readiness evidence and will be promoted through exact stable Preview so dev receives a new checked, attributable push.
- Immutable v0.17.4 six-collection synthetic row/write checker BLOCKS Diary/message extra fields; isolated unshipped v0.17.5 bridge PASS, [#38756019542](https://github.com/carlers/mosaic-life-tracker/actions/runs/38756019542). Old installed PWA update/offline retirement remains unverified.
- Production dr-backup scheduled execution 2026-10-15 11:01 UTC HTTP 200 reports a completed backup, NOT independently authenticated R2 marker/key/isolated restore.
- Mixed-attempt artifacts after partial failed-jobs CI rerun are rejected by trusted main receiver; #592 checkpoint contains root cause. Fresh first-attempt canonical and PREBUILT passed for accepted reconciliation.

## Scope and boundaries
- This task changes only Production release-readiness/runbook and session checkpoint, not runtime code, version, Appwrite, CI, provider settings, Production data or release tags. Version impact NONE (remains v0.29.1).
- Production 010–015, Function activation and main cutover still need explicit verified old-client, independently restorable DR, backend target and human signed-in/mobile/offline acceptance. Do not downgrade dev, silently reuse old Production browser origins, or restore real Production accounts to shared Scratch.

## #889 isolated DR verification incident
- Owner authenticated the committed 2026-10-15 backup: 31 encrypted objects, 1 Storage bucket and 10 privacy-deletion markers PASS. Fresh isolated Appwrite SGP DR project `6ad1074900371036eea5` restored 6 users and database/Storage; strict verification failed on a historical `tasks.order` value that was `null` in the source but coerced to column default `0` on import.
- Live scratch-free probe in the **isolated DR project** showed removing an optional integer default, writing original null, then restoring the default preserves null. Temporary probe table was deleted. The exact offending DR row was repaired with its schema default reinstalled; no Production, shared Scratch or protected-branch mutation.
- Task `chatgpt/889-dr-null-default-fidelity-20261015` fixes the source restore pipeline for nullable integer defaults, keeps strict equality, and includes regression tests. No manual claim of a complete drill: all remaining row and file verification plus Function recovery and application acceptance are pending.

## Next action
- Complete focused task CI for the exact fix, then verify the **existing** isolated DR project using the owner's encrypted keyring with `npm run dr:restore -- --snapshot 20261015T110126518Z --target-project 6ad1074900371036eea5 --endpoint https://sgp.cloud.appwrite.io/v1 --verify-only`. Do NOT rerun initial restore on a nonempty target; diagnose any further mismatches.
- After integrity verification, deploy inactive recovery Functions, test restored application/account flows, and keep all Production gates from #889 and `PRODUCTION_RELEASE_READINESS.md` in force.
- Task [verify:focused] on exact commit with this checkpoint; source-first stable refactor Preview full canonical and protected PREBUILT READY; separately preflight then user-authorized merge to dev; prove postmerge Quality Gate/READY.
- Prepare the protected dev-to-main release PR with aggregate user-facing release notes only after refreshed dev proof. Keep it unmerged until all Production gates in `PRODUCTION_RELEASE_READINESS.md` and #889 are independently verified; 1.0.0 requires distinct milestone approval.
