# Session checkpoint

Updated: 2026-10-04
Current task: Harden the normal new-user path from account creation through username/profile setup, TodoMate import, sync convergence, and multi-device continuation.
Status: Stable Preview `fix/new-user-onboarding-hardening` contains the completed onboarding/import hardening, but its latest canonical run exposed one active-session account-switch race in the auth regression suite. `chatgpt/new-user-onboarding-canonical-fix` repairs that race by retrying a proven mismatched session switch and failing closed if the stale session cannot be cleared.
Next action: Run focused verification for the canonical auth repair, squash it into `fix/new-user-onboarding-hardening`, then rerun canonical acceptance and confirm the exact-SHA Vercel Preview. Promotion to `dev` remains user-controlled.
Blockers: None known.

## Results

- Signup collects a normalized username before entering the app and keeps partial account/profile setup resumable.
- New signup still requires username/profile completion before first entry, while ordinary login remains backward-compatible for legacy accounts without a profile; existing social surfaces continue to prompt when profile setup is actually needed.
- Login/signup safely handle Appwrite's already-active-session condition by reusing it only when `account.get()` proves the submitted email owns that session. A different active account triggers one proven retry of the session switch; failure to clear it stays signed out and never re-adopts the wrong account.
- TodoMate Preview cancels stale work and ignores stale results across close/reopen races.
- Interrupted TodoMate imports retain account-scoped recovery metadata and remain safe to rerun because Merge uses deterministic IDs.
- Restore applies categories before tasks, guards account ownership throughout long operations, and uses a bounded post-apply freshness barrier.
- A final sync failure retains local data and reports sync pending instead of falsely claiming remote completion; an account switch during that wait remains a hard ownership failure.
- Large import and interruption/idempotency regressions cover 1,000- and 5,000-task fixtures.
- This repair changes only the React state-reset mechanism required by lint; no product behavior is intentionally changed.

## Verification

- Main implementation focused gate: passed.
- First stable Preview canonical attempt: build, dependency audit, and both DOM shards passed; general checks failed on two `react-hooks/set-state-in-effect` errors.
- Main implementation focused gate: passed; lint repair focused gate: passed and was delivered to stable Preview.
- Final compatibility/correctness tree is limited to auth recovery/legacy compatibility, final-sync ownership fail-closed behavior, their regression tests, and matching docs.
- Final compatibility/correctness focused gate: passed before stable delivery.
- Stable canonical rerun after that delivery: build, checks, dependency audit, browser contracts, and DOM shard 2 passed; DOM shard 1 exposed the mismatched-active-session re-adoption race now fixed on this repair branch.
- Canonical auth repair focused gate: requested by this commit.
- Stable Preview canonical gate and Vercel Preview: pending repair delivery.
- Live TodoMate credential acceptance: manual only with the user's account.
- Manual same-account phone + desktop acceptance: pending hosted Preview.
