# Tombstone retention and stale-client recovery

Mosaic uses soft-delete tombstones for synchronized records because offline clients may
otherwise miss deletions and recreate stale rows.

## Retention policy

- Remote tombstones are retained for **90 days** by default.
- The tombstone's `updated_at` is the deletion timestamp for retention purposes.
- Steady-state RxDB replication uses each pilot's server-authored `$updatedAt + $id`
  checkpoint. Mosaic also retains the compatibility bootstrap's per-collection cursor in
  `lastSyncTimePerCollection` specifically for stale-client/full-reconciliation safety.
- On each JavaScript session, before an inactive pilot hands off, the compatibility bootstrap
  checks that cursor. If it is older than 90 days, that collection performs a full pull rather
  than trusting an incremental boundary.
- Full compatibility pulls include tombstones, so a stale client can reconcile deletions that
  still fall inside the retention window before steady-state RxDB replication resumes.
- Full reconciliation does not discard newly dirty local edits. Clean local rows that are
  absent from the remote full pull are converted to local tombstones and marked as
  reconciliation-suppressed, so they disappear locally without being recreated on the
  server. A later user edit clears that effective suppression and can push the edit normally.
- Tombstones older than the retention window may be permanently removed only by the
  privileged scheduled maintenance path documented below.
- A client whose cursor is older than the retention window must not assume that a missing
  remote row still exists. Its full-pull path is the recovery boundary.

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

The existing `message-action` dynamic API key scopes are sufficient for this path:
`rows.read`, `rows.write`, and `tables.read`. Do not add a browser-user credential or
a separate long-lived server API key.

### Appwrite Console setup

Update the existing `message-action` Function; do **not** create a second
`tombstone-gc` Function.

Configure:

- the current `message-action` source/root and runtime as before
- `TOMBSTONE_RETENTION_DAYS=90`
- the existing scopes `rows.read`, `rows.write`, and `tables.read`
- a daily schedule, for example `0 0 * * *`

Appwrite scheduled executions are asynchronous, so the response body is not the operational
audit record. The function logs the retention window, cutoff, per-table scanned/purged
counts, and final totals for every scheduled run.

### Production rollout checklist

1. Deploy the updated `message-action` code with its schedule still unset/disabled.
2. Confirm `TOMBSTONE_RETENTION_DAYS=90` and the existing function scopes above.
3. Enable a daily schedule such as `0 0 * * *`.
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

The protocol does not require a device registry. Safety comes from the retention horizon:
steady-state clients receive tombstones through RxDB replication, while a new JavaScript
session still passes through the compatibility bootstrap before handoff. If that bootstrap's
cursor is outside the retention window, it switches to full reconciliation instead of
assuming that a remotely absent row is still active.

Sharing `message-action` does not make maintenance user-callable. Appwrite marks scheduled
executions with trusted trigger metadata, and the handler routes that trigger before its
normal user-authenticated action parsing.

This is deliberately a bounded guarantee. If Mosaic later needs clients to remain offline
for longer than 90 days without full reconciliation, increase the retention period or
evolve to a server-side sync-version/device-acknowledgement protocol.

## Operational rule

Do not purge tombstones using an ad-hoc client-side delete or a normal
`message-action` payload. Permanent deletion is valid only through the schedule-triggered
maintenance path described here.
