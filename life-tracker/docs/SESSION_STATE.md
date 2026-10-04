# Session checkpoint

Updated: 2026-10-04
Current task: Harden the normal new-user path from account creation through username/profile setup, TodoMate import, sync convergence, and multi-device continuation.
Status: The main hardening implementation is already on stable Preview `fix/new-user-onboarding-hardening`. Its first canonical run passed build, dependency audit, and both DOM shards but the general checks job found two React lint violations: AuthPage and TodoMateImportSheet were setting state synchronously inside effects. This repair branch replaces those resets with Mosaic's existing `usePropSync` render-adjustment pattern while preserving the same behavior.
Next action: Run focused verification for this repair, squash it into `fix/new-user-onboarding-hardening`, then rerun canonical acceptance and confirm the exact-SHA Vercel Preview. Promotion to `dev` remains user-controlled.
Blockers: None known.

## Results

- Signup collects a normalized username before entering the app and keeps partial account/profile setup resumable.
- Login to an account without a profile returns to username setup instead of entering Home with a missing social identity.
- TodoMate Preview cancels stale work and ignores stale results across close/reopen races.
- Interrupted TodoMate imports retain account-scoped recovery metadata and remain safe to rerun because Merge uses deterministic IDs.
- Restore applies categories before tasks, guards account ownership throughout long operations, and uses a bounded post-apply freshness barrier.
- A final sync failure retains local data and reports sync pending instead of falsely claiming remote completion.
- Large import and interruption/idempotency regressions cover 1,000- and 5,000-task fixtures.
- This repair changes only the React state-reset mechanism required by lint; no product behavior is intentionally changed.

## Verification

- Main implementation focused gate: passed.
- First stable Preview canonical attempt: build, dependency audit, and both DOM shards passed; general checks failed on two `react-hooks/set-state-in-effect` errors.
- CI repair focused gate: requested by the final repair commit.
- Stable Preview canonical gate and Vercel Preview: pending repair delivery.
- Live TodoMate credential acceptance: manual only with the user's account.
- Manual same-account phone + desktop acceptance: pending hosted Preview.
