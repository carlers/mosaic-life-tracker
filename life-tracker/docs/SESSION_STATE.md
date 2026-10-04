# Session checkpoint

Updated: 2026-10-04
Current task: Harden permanent account erasure against ambiguous client responses, multi-device races, stale peer resurrection, worker overlap, malformed legacy data, and DR key rotation.
Status: Implementation and regression coverage are on task branch `chatgpt/account-erasure-hardening-v2`, based from stable Preview `fix/new-user-onboarding-hardening` at `4f4b0f1`. Focused verification is requested on the current checkpoint; production Appwrite/Functions have not been changed by this hardening pass.
Next action: Run the focused task gate, investigate/fix every failure, then squash the verified task into stable Preview. Run the stable branch canonical gate + exact-SHA Vercel Preview. Only after those are green, redeploy the changed `message-action` and `dr-backup` Functions, re-read live configuration, and perform destructive acceptance only with a purpose-built disposable account. Promotion to `dev` remains user-controlled.
Blockers: None known before focused CI. The old accidental non-production privacy marker for Auth ID `6a96e813038ce6b66315` may remain object-locked; it is unrelated to a real Mosaic user.

## Hardening implemented on the task branch

- The durable deletion job is now a pre-pivot intent/write fence. New jobs begin `preparing`; destructive Appwrite work starts only after the deterministic encrypted DR privacy marker is successfully persisted/authenticated.
- Browser deletion intent is persisted before dispatch. Timeout/network/5xx ambiguity never restores the old account work scope or sync owner. A matching intent blocks cached-account hydration and retries deletion before normal login/sync can resume.
- Same-browser tabs receive `deletion_pending` immediately and suspend the deleting account. `deletion_accepted` triggers account-scoped local cleanup.
- Deleted-account local cleanup no longer removes the shared RxDB. It physically removes only rows whose `userId` matches the erased account across tasks/categories/diary/settings/friendships/messages/syncMeta.
- Worker deletes are duplicate-safe for already-missing rows/files/users; duplicate profile rows no longer permanently trap deletion.
- Surviving peer task-reaction and friend-carousel scrubs use Appwrite transactions with bounded conflict retry. Malformed structured metadata containing the erased ID is cleared privacy-first.
- Trusted `message-action` writes involving any user with a deletion job reject while erasure is in progress.
- Stale peer `friend_carousel_prefs` and task reactions are sanitized against the current accepted friendship graph before replication push, preventing an offline peer from reintroducing an erased former-friend ID.
- The worker verifies before Auth removal, removes Auth, then performs a post-Auth cleanup/verification while the durable job still fences trusted writes. This catches late direct writes/uploads that were already in flight at the freeze boundary.
- DR privacy-marker retries can authenticate old key versions through `DR_ENCRYPTION_KEYS_JSON`; missing escrowed old keys fail closed.
- Account-deletion schema migration validation now checks server-only permissions, enabled/row-security state, detailed column compatibility, and unexpected required columns.
- `infrastructure/account-erasure-policy.mjs` classifies every active portable table/bucket; tests enforce both manifest coverage and parity with the worker's owned/cross-reference lists.
- Authoritative architecture/runbook docs are now `PROJECT_REFERENCE.md §23.8` and `ACCOUNT_ERASURE.md`.

## Verification added/updated

- Provider regressions: accepted deletion, ambiguous timeout, pre-pivot pending marker, persisted-intent reload retry, sibling-tab freeze.
- Local-data regression: deleting account A preserves account B across all shared RxDB collections.
- Handler regressions: pre-pivot marker failure performs no destructive work, trusted-write fence, concurrent-row disappearance, malformed structured references, late Storage file after Auth deletion.
- DR regressions: immutable marker reuse across key rotation and fail-closed behavior when the old key is absent.
- Migration regressions: table permissions, column size, and unexpected required-column drift.
- Replication regressions: stale deleted-friend IDs are stripped from carousel preferences and task reactions before push.
- Backend manifest regressions: every portable resource has an erasure classification and worker coverage stays aligned.

## Remaining acceptance sequence

1. Focused task-branch CI.
2. Squash into `fix/new-user-onboarding-hardening`.
3. Stable full canonical gate and exact-SHA Vercel Preview.
4. Redeploy only changed backend Functions/config after green repository acceptance; schema shape itself is unchanged.
5. Disposable-account E2E: immediate local sign-out, connected second-device/session invalidation, owned/cross-user rows/files absent, peer structured refs scrubbed, Auth user absent, deletion job absent after completion, privacy marker still authenticates on retry.
6. Keep the documented limitation explicit: a physically disconnected third-party device cannot be remotely wiped; a later generic session 401 alone is not proof of deletion.

## Production state before this hardening rollout

- Existing production `account_deletions` schema/indexes are live and server-only.
- Existing production `message-action` and `dr-backup` deployments implement the earlier erasure protocol and DR marker route.
- Existing marker idempotency/object-lock repair at stable `4f4b0f1` is the last fully accepted tree.
- This hardening task has intentionally made no production backend mutation yet.
