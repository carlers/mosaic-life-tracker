# Permanent account erasure

This runbook defines Mosaic's privacy-sensitive **Delete Account** protocol. Read it with
`PROJECT_REFERENCE.md §23.8`. The code and infrastructure manifest remain authoritative
when progress/checkpoint prose is stale.

## Core invariants

1. The browser never hard-deletes synchronized server rows itself.
2. The user must type the exact string `DELETE`; the Function derives the target only from
   Appwrite's trusted authenticated user header.
3. A server deletion job may exist before erasure becomes irreversible. **No destructive
   Appwrite cleanup may run until the encrypted DR privacy-deletion marker has been
   persisted and authenticated.**
4. The successfully authenticated DR marker is the privacy pivot. Before that pivot the
   job is `preparing`; after it, deletion must only move forward and retry until complete.
5. Client/network uncertainty is never interpreted as "deletion definitely failed." Once
   the browser dispatches the request it persists a local deletion intent, suspends that
   account's work, and must not restart its old sync owner merely because an HTTP response
   was lost or timed out.
6. Retry and duplicate execution must be idempotent. Missing rows/files/users during cleanup
   are success-equivalent when another worker may already have removed them.
7. Auth/session removal happens only after the normal cleanup and verification pass. The
   durable job remains as a trusted-write fence through a post-Auth reconciliation and
   verification pass; the job is removed only after that final pass is clean.
8. Deleting account A must not destroy authoritative local rows belonging to account B.
   The shared RxDB is purged by `userId`; whole-database destruction is reserved for the
   explicit **Clear Local Data** action.
9. Every current portable backend table and Storage bucket must have an explicit erasure
   classification in `infrastructure/account-erasure-policy.mjs`, and automated tests
   must keep the worker's owned/cross-reference coverage aligned with that policy.
10. Malformed legacy structured metadata fails privacy-first: if an erased ID may be inside
    malformed reaction/carousel data, Mosaic clears that disposable metadata instead of
    declaring verification clean.

## State machine

```text
browser: typed DELETE
  -> persist local deletion intent
  -> suspend account work + broadcast deletion_pending
  -> delete_account Function

server job: preparing / dr_marker
  -> write + authenticate deterministic immutable DR marker
     failure: remain preparing; no destructive cleanup; retry
  -> privacy pivot
  -> pending / marker_ready
  -> hide profile + disable Auth + revoke sessions
  -> running / cleanup
  -> reconcile
  -> verify
  -> delete Auth principal
  -> post_auth_reconcile
  -> post_auth_verify
  -> remove deletion job
  -> complete
```

The job ID and privacy-marker object key are deterministic, so retries after a lost response
converge on the same logical operation.

## Client behavior

`AuthProvider` persists `mosaic_account_deletion_intent_v1` before dispatching the
request, including the deleting user ID and normalized account email for safe later-login
matching. A matching cached account is not hydrated while that intent exists. Same-browser
tabs receive `deletion_pending` immediately and suspend the same sync owner.

Server responses have two valid retained states:

- `accepted: true, deletionPending: true`: the privacy pivot is confirmed. The browser
  signs out and performs account-scoped local erasure.
- `accepted: false, deletionPending: true`: the server retained a pre-pivot job but the DR
  marker is not confirmed yet. The browser stays signed out/frozen and keeps the deletion
  intent; server maintenance and a later authenticated retry can finish it.

A timeout, network error, or 5xx after dispatch is ambiguous. The browser keeps the intent
and remains frozen. Signing in to the same account later retries the idempotent operation
before normal account sync can start.

A confirmed Appwrite `user_blocked` response triggers deleted-account cleanup. An ordinary
invalid-session 401 is **not** treated as proof that server deletion completed. However, when
this browser already has a matching persisted deletion intent, that 401 is enough to evict
the intended account's local rows while retaining the intent for a future authenticated
retry if the server never crossed the privacy pivot. A failed login only performs this
pending-deletion cleanup when its normalized email matches the persisted intent; a different
account's failed login must never purge the pending account.

Account-scoped RxDB eviction deliberately does not destroy the shared physical database.
RxDB document removal can retain internal deletion tombstones until normal RxDB cleanup;
Mosaic does not force a collection-wide `cleanup(0)` because doing so could purge another
account's replication tombstones. The server-side Appwrite erasure guarantee is independent
of that local storage implementation detail.

## Server write fencing and reconciliation

While an `account_deletions` job exists, trusted `message-action` operations involving
that user reject with 409. This covers the caller and the relevant peer/owner IDs for
friendship, messaging, task reaction, read/unsend, and friend-calendar actions.

Direct owner replication still uses Appwrite row permissions. Once the privacy pivot is
confirmed the Auth user is disabled and sessions are revoked. The worker then performs
normal cleanup/verification, deletes the Auth principal, and runs a final reconciliation
while the deletion job still fences trusted Function writes. This final pass catches an
upload or direct write that was already authorized/in flight at the freeze boundary.

Peer-owned structured state has an additional anti-resurrection boundary:
`friend_carousel_prefs` and task reactions are sanitized against the owner's current
accepted friendship graph before replication push. A stale offline peer therefore cannot
reintroduce an erased former friend ID after the worker scrubbed it.

## Erasure coverage

Current portable backend policy:

| Resource | Erasure rule |
|---|---|
| tasks | delete rows owned by `user_id`; scrub deleted IDs from surviving reactions |
| categories | delete rows owned by `user_id` |
| diary | delete rows owned by `user_id` |
| settings | delete rows owned by `user_id`; scrub surviving `friend_carousel_prefs` |
| friendships | delete rows matching `user_id` or `friend_id` |
| profiles | hide, then hard-delete every row matching `user_id` |
| messages | delete rows matching `user_id`, `sender_id`, or `recipient_id` |
| account_deletions | server-only control job, deleted after final verification |
| task_images | delete files whose owner update/delete permissions belong to the user |

If a new portable table or bucket is added, CI must fail until its erasure semantics are
classified. Production-only legacy placeholder tables that are not part of the active
portable manifest must remain non-user-bearing or be reintroduced to the manifest and
classified before use.

## DR non-resurrection

Privacy markers live outside snapshot generations at
`<DR_PREFIX>/privacy-deletions/<sha256(userId)>.json.enc`. Restore authenticates them
before creating target resources and filters marked users, owned/cross-user rows/files, and
supported embedded references.

Markers are deterministic and may be protected by R2 object lock. Retry therefore HEADs and
authenticates an existing marker rather than overwriting it. Marker verification reads the
key version from the encrypted envelope and may use `DR_ENCRYPTION_KEYS_JSON` to retain
older decryption keys after rotation. The current `DR_ENCRYPTION_KEY_B64`/`DR_KEY_VERSION`
remain the only key/version used for new writes.

Never rotate away an old DR key until every retained snapshot, blob, and privacy marker
using that version is no longer required. Losing an old key makes its immutable marker
unverifiable and deletion must fail closed.

## Failure matrix

The automated suite should cover these distinct transitions rather than enumerating every
device Cartesian product:

| Scenario | Required result |
|---|---|
| wrong confirmation | no job, marker, freeze, or deletion |
| marker unavailable | retained `preparing` job; no destructive server work |
| response lost/times out | browser remains frozen; deletion intent persists; no sync restart |
| two DELETE requests / two workers | converge; 404-on-delete is harmless |
| scheduled worker overlaps immediate worker | converge on the same deterministic job |
| peer edits structured state during scrub | transaction conflict/retry preserves unrelated edit |
| malformed structured data contains erased ID | privacy-first clear; verification cannot pass it silently |
| account A and B share local RxDB | erase A only; preserve B |
| stale peer comes online after erasure | social IDs sanitized before push |
| file lands after Auth deletion | post-Auth reconciliation removes it |
| DR key rotates | old marker authenticates through keyring; missing old key fails closed |
| schema/manifest drifts | migration or policy tests fail |
| worker is interrupted | durable job remains retryable |

## Device and retention limitations

A server cannot physically wipe a phone/laptop that is disconnected and outside its control.
Connected same-browser tabs are frozen immediately; other signed-in devices lose server
access after Auth/session revocation and reconcile when they contact Appwrite. If a device
misses the blocked-user stage and later sees only a generic expired/missing-session 401,
Mosaic cannot distinguish permanent deletion from ordinary session expiry without keeping a
permanent deletion registry or deleting local offline data on every session expiry. Mosaic
does neither. Therefore server erasure does not claim remote physical deletion of arbitrary
offline device caches.

Likewise, immutable encrypted historical DR ciphertext can remain until retention/object-lock
permits removal, and provider operational execution/audit logs may follow provider retention.
The product guarantee is erasure of live/restorable Mosaic account data and prevention of DR
resurrection, not immediate physical destruction of every provider log or locked ciphertext.

## Verification and rollout

For implementation work:

1. add/update handler, unit, and provider regressions for the affected invariant;
2. run focused verification on the task branch;
3. squash into the stable `fix/*` Preview branch only after focused green;
4. run the stable branch's full canonical gate and confirm exact-SHA Vercel Preview;
5. only then apply any Appwrite migration/config change and deploy changed Functions;
6. re-read live Function/table configuration after rollout.

Destructive manual acceptance must use a deliberately disposable Mosaic account, never a
personal/friend account. Verify immediate local sign-out, another connected session losing
access, owned/cross-user rows and files gone, peer structured references scrubbed, Auth user
gone, the deletion-job table empty after completion, and the privacy marker remaining
retry-authenticatable. Distinguish automated verification, hosted/browser verification, and
manual destructive acceptance in the handoff.
