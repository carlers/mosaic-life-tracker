# Session checkpoint

Updated: 2026-10-04
Current task: Finish permanent-account-erasure hardening and final reconnect/local-cleanup verification.
Status: The main hardening batch is accepted on stable Preview `fix/new-user-onboarding-hardening` at `3c7f452`: focused CI passed on task SHA `69bb91d`, the stable full canonical gate passed, and exact-SHA Vercel Preview deployment `dpl_Erh7jfd3bWtoJ9CRkDNWK7eLqrGW` is READY. Production Appwrite runs the accepted server sources: `message-action` deployment `6ac254279d4fe18c46de` and `dr_backup` deployment `6ac25457acb18594b6c2`, both READY with their previous scopes/schedules/variables preserved. A post-rollout audit found one client-only reconnect hole: after a lost delete response, a later ordinary 401 could leave that browser's deleted-account RxDB rows locally present. Follow-up branch `chatgpt/account-erasure-reconnect-cleanup` now evicts those rows when a matching persisted deletion intent exists and adds normalized-email matching so another account's failed login cannot trigger the purge.
Next action: Complete focused verification for the reconnect follow-up, repair every failure, squash the focused-green task into stable Preview, then rerun the stable canonical gate + exact-SHA Preview. No Appwrite Function redeploy is required if the final diff remains client/tests/docs only. The remaining destructive acceptance is a real browser/device check using a purpose-built disposable Mosaic account. Promotion to `dev` remains user-controlled.
Blockers: This environment cannot drive a client-authenticated browser/device session or spoof Appwrite's reserved user identity headers, so destructive multi-device acceptance remains genuinely manual. The old accidental privacy marker for non-production Auth ID `6a96e813038ce6b66315` may remain object-locked and is unrelated to a real Mosaic user.

## Accepted hardening

- The encrypted/authenticated DR privacy-deletion marker is the irreversible privacy pivot. Deletion jobs may exist in pre-pivot `preparing` state, but destructive Appwrite cleanup does not begin until the marker is confirmed.
- Client/network ambiguity is fail-closed. The browser persists deletion intent before dispatch, suspends account work across same-browser tabs, and never restarts the old sync owner merely because the HTTP response disappeared.
- The worker is duplicate/404 safe, handles duplicate profile rows, transactionally scrubs surviving peer references, clears malformed privacy-sensitive metadata, fences trusted cross-user writes while a deletion job exists, verifies before Auth removal, then performs post-Auth reconciliation/verification before removing the job.
- Stale peer task reactions and `friend_carousel_prefs` are sanitized against the current accepted friendship graph before replication push so an offline peer cannot resurrect an erased former-friend ID.
- DR marker verification supports retained old encryption keys through optional `DR_ENCRYPTION_KEYS_JSON`; missing required old keys fail closed.
- `infrastructure/account-erasure-policy.mjs` classifies every active portable table/bucket, with tests enforcing manifest and worker coverage parity.
- Account-deletion migration checks server-only permissions, enabled/row-security state, detailed column compatibility, indexes, and unexpected required columns.
- Deleted-account local cleanup is scoped by `userId` and preserves unrelated accounts in the shared RxDB. RxDB removals may leave internal deletion tombstones until normal cleanup; Mosaic intentionally does not run collection-wide zero-age cleanup because that could discard another account's replication tombstones.
- Follow-up reconnect rule: an authoritative 401 with a matching persisted deletion intent evicts that account's local rows while retaining the intent if server acceptance is still uncertain. A failed login must match the intent's normalized email before it can trigger this cleanup.

## Verification and rollout evidence

- Focused main-hardening gate: GitHub Actions run `37204677984` on `69bb91d` — passed.
- Stable canonical gate: GitHub Actions run `37204752278` on `3c7f452` — passed across checks, build, dependency audit, both DOM shards, both browser-contract shards, and canonical acceptance.
- Exact-SHA Preview for `3c7f452`: `mosaic-life-tracker-n68xpyq4k-carls-projects-72516fde.vercel.app`, deployment `dpl_Erh7jfd3bWtoJ9CRkDNWK7eLqrGW` — READY.
- Production schema re-read: `account_deletions` remains enabled, row-security/server-only, with required columns and both indexes available; no schema mutation was needed for this hardening.
- Production `message-action`: active deployment `6ac254279d4fe18c46de` — READY; schedule `0 * * * *`, timeout 120, existing nine scopes and variables preserved.
- Production `dr_backup`: active deployment `6ac25457acb18594b6c2` — READY; schedule `0 11 * * *`, timeout 900, read-only scopes/secrets/retention variables preserved.
- Non-destructive runtime smoke: `message-action` ran the accepted deployment and returned the expected forbidden result for a non-friend request; `dr_backup` ran the accepted deployment and rejected untrusted manual execution as expected.
- `account_deletions` was empty after rollout/smoke checks.

## Remaining acceptance

1. Focused CI for `chatgpt/account-erasure-reconnect-cleanup`.
2. Squash the focused-green follow-up into `fix/new-user-onboarding-hardening`, then require the stable full canonical gate and exact-SHA Preview.
3. On a deliberately disposable Mosaic account, manually verify typed confirmation, immediate initiating-device sign-out/local eviction, connected second-device invalidation/cleanup, owned and cross-user rows/files absent, peer structured references scrubbed, Auth user absent, deletion job absent, and retry-safe DR marker behavior.
4. Keep the platform limit explicit: a physically disconnected third-party device cannot be remotely wiped while disconnected. Server erasure does not imply immediate byte-level removal from another person's offline device or from RxDB's internal local tombstone storage.
5. Do not promote to `dev` or `main` without the user's explicit instruction.
