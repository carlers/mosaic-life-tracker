# Session checkpoint

Updated: 2026-10-04
Current task: Fix the false post-TodoMate fresh-sync timeout seen on a newly created account and make TodoMate import/sync progress more informative.
Status: Implementation and regression coverage are complete on `chatgpt/todomate-sync-progress`. The screenshot timeout was traced to six independent RxDB freshness proofs being awaited sequentially under one shared deadline, combined with a fixed 30-second post-import proof budget. The task is ready for focused verification before squash delivery to stable Preview `fix/new-user-onboarding-hardening`.
Next action: Run focused verification. Repair any failure, then squash-merge into the stable Preview branch for the canonical full gate and exact-SHA Vercel Preview. Promotion to `dev` remains user-controlled.
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
- This timeout/progress repair: focused verification requested by the final task commit.
- Stable Preview canonical gate and exact-SHA Vercel Preview: pending focused green + squash delivery.
- Live TodoMate re-import with the user's account: manual hosted-Preview acceptance still required.
- Same-account phone + desktop convergence after import: manual hosted-Preview acceptance still required.
