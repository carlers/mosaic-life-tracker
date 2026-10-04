# Tombstone retention and stale-client recovery

Mosaic uses soft-delete tombstones for synchronized records because offline clients may
otherwise miss deletions and recreate stale rows.

## Retention policy

- Remote tombstones are retained for **90 days** by default.
- The tombstone's `updated_at` is the deletion timestamp for retention purposes.
- Normal startup does **not** run the old compatibility pull/push bootstrap. Each of the six
  collections starts the same versioned RxDB `replicationIdentifier`; RxDB resumes its
  persisted upstream/downstream checkpoints and pending local writes automatically.
- `syncMeta` is a local-only RxDB collection. It stores, per account and synced collection,
  the current replication identifier and the last time that replication reached a settled
  in-sync state. The marker lives inside the same local database, so clearing/replacing the
  database also clears the proof. It is never mapped to Appwrite.
- Freshness is recorded only after RxDB's initial replication has completed, and again after
  later active→idle replication cycles. Pull-handler return is deliberately insufficient
  because returned rows/checkpoints may not yet be persisted.
- During migration, the account-scoped legacy `lastSyncTimePerCollection` pull cursor is a
  fallback only when no current `syncMeta` freshness marker exists. It is not a normal
  replication checkpoint and it no longer authorizes browser writes.
- If the local freshness proof for a collection is older than 90 days, startup performs a
  **read-only full remote recovery before starting that collection's pilot**. The recovery
  applies remote rows and reconciles clean local rows that are now absent remotely; it never
  calls Appwrite `updateRow`/`createRow`.
- Full stale recovery preserves local rows whose application `updatedAt` is newer than the
  last trusted freshness boundary. Invalid/unknown local timestamps are preserved
  conservatively rather than deleted. Pending outgoing messages missing remotely are also
  preserved.
- After stale recovery succeeds, the normal RxDB pilot starts. Any legitimate pending local
  write is then handled by RxDB's persisted upstream protocol and the collection-specific
  conflict rules.
- Tombstones older than the retention window may be permanently removed only by the
  privileged scheduled maintenance path documented below. Explicit user-confirmed
  **account erasure** is a separate privacy operation: its durable server worker hard-deletes
  that account's live records immediately rather than waiting 90 days. See
  [Project Reference §23.8](PROJECT_REFERENCE.md#238-permanent-account-erasure).

## First sync and lost replication metadata

When RxDB has no assumed master state for an owner-write row, Mosaic treats that as a
first-sync/metadata-recovery condition rather than proof that the local row is new.

For tasks, categories, diary, and settings:

- a local row semantically equal to the current Appwrite row is acknowledged with **no
  remote write**;
- a newer Appwrite/application state wins as a conflict;
- only a genuinely newer local application `updatedAt` may update the existing remote row;
- a row that truly does not exist remotely may be created;
- task bootstrap writes preserve the current server-owned reaction state.

This prevents a remote row that was merely written into local RxDB from being mistaken for a
new local edit because its RxDB `_meta.lwt` is recent.

Friendship and message upstream remain validation-only/server-owned as documented in
`PROJECT_REFERENCE.md`.

## Garbage collection

Tombstone cleanup shares the existing `message-action` Appwrite Function so the project
does not consume a second Function slot solely for maintenance.

`appwrite-functions/message-action/tombstone-gc.js` scans all six synchronized tables for
rows where:

- `deleted = true`
- `updated_at` is older than the retention cutoff

It then permanently deletes those rows. The module defaults to 90 days and accepts
`TOMBSTONE_RETENTION_DAYS` for controlled deployment configuration. Keep that value equal
to or greater than the client constant in `src/db/sync.ts`.

The `message-action` entrypoint checks Appwrite's trusted
`x-appwrite-trigger` metadata before user authentication. Only
`x-appwrite-trigger: schedule` enters the GC path. Normal HTTP/user executions continue
through the existing authenticated action router, so there is no browser-callable
`tombstone_gc` action.

Tombstone GC itself still needs only `rows.read`, `rows.write`, and `tables.read`.
The shared `message-action` Function now carries additional server-only scopes for the
account-erasure worker (`users.write`, Storage file read/write, and Function execution).
Those scopes must never be exposed through a browser credential or a separate long-lived
server key.

### Appwrite Console setup

Update the existing `message-action` Function; do **not** create a second
`tombstone-gc` Function.

Configure:

- the current `message-action` source/root and runtime as before
- `TOMBSTONE_RETENTION_DAYS=90`
- the complete checked-in Function scope set from
  `appwrite-functions/message-action/function.config.json`
- the hourly maintenance schedule `0 * * * *`, which retries accepted account-erasure
  jobs and then runs the idempotent tombstone GC

Appwrite scheduled executions are asynchronous, so the response body is not the operational
audit record. The function logs the retention window, cutoff, per-table scanned/purged
counts, and final totals for every scheduled run.

### Production rollout checklist

1. Deploy the updated `message-action` code with its schedule still unset/disabled.
2. Confirm `TOMBSTONE_RETENTION_DAYS=90` and the complete checked-in Function scopes.
3. Enable the hourly maintenance schedule `0 * * * *`.
4. Inspect the first scheduled execution. It must start with a log containing
   `retentionDays=90` and an ISO `cutoff`, then emit one result line for each of
   `tasks`, `categories`, `diary`, `settings`, `friendships`, and `messages`,
   and finish with `tombstone-gc: complete`.
5. `purged=0` is a valid result. If the execution errors or the expected table logs are
   incomplete, disable the schedule before troubleshooting.
6. Keep the schedule enabled only after that first execution is accepted.

To halt future cleanup, disable the schedule first. Already purged tombstones cannot be
restored by the function, so investigate from backups or audit records rather than
attempting a browser-side recreation.

## Why this is safe

The protocol does not require a device registry or a cross-device mutex. Each device owns
its own durable RxDB replication metadata. Normal reloads resume those checkpoints, so phone
and desktop can replicate the same account independently without replaying local cache rows
through a second writer.

The 90-day safety boundary is separate from ordinary restart behavior. A local database
whose proven replication freshness is older than the retention horizon first performs a
read-only full reconciliation; only after that succeeds does normal RxDB replication resume.
That prevents a remotely garbage-collected tombstone from being recreated just because an
old device still has the pre-delete row.

Sharing `message-action` does not make maintenance user-callable. Appwrite marks scheduled
executions with trusted trigger metadata, and the handler routes that trigger before its
normal user-authenticated action parsing.

This is deliberately a bounded guarantee. If Mosaic later needs clients to remain offline
for longer than 90 days without full reconciliation, increase the retention period or
evolve to a server-side sync-version/device-acknowledgement protocol.

## Operational rule

Do not purge ordinary tombstones using an ad-hoc client-side delete or a normal
`message-action` payload. Permanent deletion of ordinary synchronized records is valid
only through the schedule-triggered retention path described here. Explicit whole-account
erasure is the documented exception and must go through the server-owned account-deletion
job, never through a client-side row loop.
