# Session checkpoint

Updated: 2026-10-04
Current task: Finish destructive acceptance for permanent account erasure after the disposable `test@test.com` run exposed a Function-timeout bottleneck.
Status: Stable Preview `fix/new-user-onboarding-hardening` is accepted at `c93a118`; its full canonical gate `37206688081` passed and exact-SHA Vercel Preview `dpl_EWk6kgMRXKAmspUK2Hw2KTzYPQkZ` is READY. Production `message-action` deployment `6ac254279d4fe18c46de` and `dr_backup` deployment `6ac25457acb18594b6c2` are READY. The user then performed the real disposable deletion for `test@test.com` (Auth ID `6ab9ec2a329e7cb1f34c`). The request crossed the privacy pivot and returned 202, disabled Auth, revoked every session, removed all owned/cross-user DB rows and profile, and left the durable deletion job intact. The immediate async worker then timed out at 120 seconds in `running/cleanup` before Storage cleanup/final Auth removal; 37 account-owned image files remained. Root cause: `scrubCrossUserReferences()` opened a transaction for every surviving task/settings row even when the scanned row could not contain the erased ID. Production currently has hundreds of peer task rows, so those sequential transaction round-trips consumed the Function budget.
Next action: Focused-verify `chatgpt/account-erasure-timeout-fix`, which prefilters scan snapshots and opens transactions only for actual scrub candidates. If green, squash into stable Preview, run the stable full canonical gate + exact-SHA Preview, redeploy only `message-action`, invoke the existing durable deletion job `del_b16bbd4612279b54179e378521ad22e1`, and verify Auth user/job/37 files are all gone plus no row/reference residue. Promotion to `dev` remains user-controlled.
Blockers: None known. Do not manually delete the remaining disposable-account files/user/job; the acceptance goal is to prove the retryable worker completes them itself after the fix.

## Live disposable-account evidence

- `test@test.com` maps to Auth ID `6ab9ec2a329e7cb1f34c`.
- Delete request execution `6ac25fa5da54383e8a3d` ran production deployment `6ac254279d4fe18c46de`, returned HTTP 202, and crossed the marker-backed privacy pivot.
- Auth is disabled and has zero sessions.
- Owned tasks, categories, diary, settings, profiles: zero rows.
- Friendships matching either `user_id` or `friend_id`: zero rows.
- Messages matching `user_id`, `sender_id`, or `recipient_id`: zero rows.
- Surviving scanned task reactions and `friend_carousel_prefs`: no deleted-user reference observed.
- Storage bucket currently has 134 files total; 37 are still owned by the deleted disposable account.
- Durable job `del_b16bbd4612279b54179e378521ad22e1` remains `running / cleanup`, attempts=1, which is the correct fail-safe state.
- Async resume execution `6ac25fac826f50c79d64` hit the 120-second timeout. It did not delete Auth or remove the job, so completion was not falsely reported.

## Fix under focused verification

- Pre-scan task reactions with `stripUserFromReactions()`; skip the Appwrite transaction when the snapshot cannot contain the deleted ID.
- Pre-scan `friend_carousel_prefs` with `stripFriendCarouselValue()`; likewise skip unrelated settings rows.
- Actual candidates still use the existing transactional re-read/retry so concurrent peer edits remain protected.
- Final verification remains authoritative and catches a reference introduced after the prefilter snapshot.
- Handler regression simulates 100 unrelated peer tasks plus 100 unrelated peer settings; account deletion must complete with zero `createTransaction` calls for those rows.

## Remaining acceptance

1. Focused CI on this task branch.
2. Squash into `fix/new-user-onboarding-hardening`, full canonical gate, exact-SHA Preview.
3. Redeploy only `message-action` from the accepted stable SHA; re-read active deployment/config.
4. Resume the existing durable deletion job through the internal server-only path.
5. Verify: Auth user absent, zero sessions/user lookup, deletion job absent, all 37 owned files absent, all owned/cross-user rows absent, no embedded peer references, and retry execution completes below timeout.
6. Update this checkpoint/PLAN with final evidence. Do not promote to `dev` or `main` without explicit user instruction.
