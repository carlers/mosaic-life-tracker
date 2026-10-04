# Session checkpoint

Updated: 2026-10-04
Current task: Harden the normal new-user path from account creation through username/profile setup, TodoMate import, sync convergence, and multi-device continuation.
Status: Implementation and regression coverage are complete on `chatgpt/new-user-onboarding-hardening`. The task is ready for focused verification before squash delivery to stable Preview `fix/new-user-onboarding-hardening`.
Next action: Run the focused task gate. Repair any failure, then squash-merge the focused-green task PR into `fix/new-user-onboarding-hardening` for the canonical full gate and Vercel Preview. Promotion to `dev` remains user-controlled.
Blockers: None known.

## Results

- Signup now collects a normalized username and does not publish/cache the authenticated app user until the account has a profile. Appwrite's unique username constraint remains authoritative.
- Partial/ambiguous signup is resumable: a small local pending-onboarding record survives reload, account-create 409 is followed by password/session proof rather than assumed success, and profile/setup failure keeps the user out of Home until retry completes.
- New signup still requires the username/profile step before first entry, while ordinary login remains backward-compatible for legacy accounts without a profile; their existing social surfaces continue to prompt for setup when needed.
- TodoMate Preview owns an AbortController + operation generation, so closing/reopening cancels old reads and stale progress/results cannot overwrite a newer attempt.
- TodoMate import stores only account-scoped recovery metadata (expected counts + applying/applied phase). Interrupted local application is surfaced on reopen and reruns remain deterministic/idempotent.
- Restore applies categories before tasks and checks the authenticated account-work generation throughout planning, image work, row application, and tombstoning.
- Restore now performs a real bounded post-apply `refreshSync()` convergence barrier instead of treating `initializeSync()` as completion. A timeout/connectivity failure retains the durable local rows and reports sync pending rather than falsely claiming remote completion; an account switch during that wait still fails closed.
- Normal backup restore uses the same truthful synced-vs-pending result contract.
- Automated coverage includes username onboarding/recovery, stale preview cancellation, interrupted/pending import markers, mid-apply account changes, category-before-task order, 1,000- and 5,000-task application, and 1,000-task idempotent rerun.

## Verification

- Focused GitHub verification: requested by the final task commit.
- Stable Preview canonical gate and Vercel Preview: pending focused green + squash delivery.
- Live TodoMate credential acceptance: not performed by AI; requires the user's own TodoMate account on hosted Preview.
- Manual multi-device acceptance: pending hosted Preview with the same Mosaic account on phone + desktop.
