# Session checkpoint

Updated: 2026-10-04
Current task: Fix the false post-TodoMate fresh-sync timeout seen on a newly created account and make TodoMate import/sync progress more informative.
Status: The timeout/progress implementation is on stable Preview `fix/new-user-onboarding-hardening`. Its first canonical run caught one mechanical TypeScript error: a photo-progress completion callback was accidentally inserted into `validateNormalizedBackup()` as well as the actual restore-images loop. `chatgpt/todomate-sync-progress-build-fix` removes only that stray call.
Next action: Run focused verification for the compile repair, squash it into stable Preview, then rerun the canonical full gate and confirm the exact-SHA Vercel Preview. Promotion to `dev` remains user-controlled.
Blockers: None known.

## Results

- Fresh sync now launches all six collection freshness proofs together against the same bounded deadline, so an earlier slow collection cannot starve diary or another later collection and create a false collection-specific timeout.
- Post-restore/import convergence now has an adaptive 90–300 second budget based on the amount of personal data applied instead of the previous fixed 30 seconds; steady-state replication behavior and push concurrency are otherwise unchanged.
- A freshness timeout still rejects safety-sensitive callers, but Sync Status records it as **Sync still finishing** rather than a sticky red collection error because live RxDB replication continues in the background.
- Sync Status exposes coarse collection-level progress and percentage during a freshness pass; Home's sync control exposes the same percentage/pending state.
- TodoMate preview exposes phase + percentage for connection, login, history, photo preparation, and backup preparation.
- TodoMate import exposes phase + percentage for validation, preflight, image copy, exact local-row application, and cloud freshness verification. Percentages describe workflow/row/collection progress, not byte throughput.
- Existing account isolation, fail-closed restore semantics, deterministic reruns, and the rule that only proven full convergence may say **import complete** are preserved.
- Regression coverage now protects concurrent pilot freshness, timeout-as-pending status, sync percentage UI, large-import adaptive timeout, structured restore progress, TodoMate progress UI, and Home sync percentage.

## Verification

- Previous onboarding/import hardening stable Preview `f7ccfe8`: full canonical acceptance passed and exact-SHA Vercel Preview was READY.
- Timeout/progress implementation focused gate: passed and was squash-delivered to stable Preview.
- First stable canonical run: dependency audit passed; build failed at TypeScript compilation because of the stray `onImageProgress/ids` validator call. The intended callback inside `restoreImages()` remains intact.
- First compile-repair focused gate: passed. Review of the failed canonical shards also found one exact-shape sync-status test that needed to include the new account-scoped `notice`/`progress` reset fields.
- Final compile/test repair focused gate: requested by this commit.
- Stable Preview canonical gate and exact-SHA Vercel Preview: pending repair delivery.
- Live TodoMate re-import with the user's account: manual hosted-Preview acceptance still required.
- Same-account phone + desktop convergence after import: manual hosted-Preview acceptance still required.
