# Tombstone retention and stale-client recovery

Mosaic uses soft-delete tombstones for synchronized records because offline clients may otherwise miss deletions and recreate stale rows.

## Retention policy

- Remote tombstones are retained for **90 days** by default.
- The tombstone's `updated_at` is the deletion timestamp for retention purposes.
- A client keeps its existing per-collection sync cursor in `lastSyncTimePerCollection`.
- If a collection's pull cursor is older than 90 days, that collection performs a full pull instead of an incremental `$updatedAt` pull.
- Full pulls include tombstones, so a stale client can reconcile deletions that still fall inside the retention window.
- Full reconciliation does not discard newly dirty local edits. Clean local rows that are absent from the remote full pull are converted to local tombstones and marked as reconciliation-suppressed, so they disappear locally without being recreated on the server. A later user edit clears that effective suppression and can push the edit normally.
- Tombstones older than the retention window may be permanently removed by the `tombstone-gc` Appwrite Function.
- A client whose cursor is older than the retention window must not assume that a missing remote row still exists. Its full-pull path is the recovery boundary.

## Garbage collection

`appwrite-functions/tombstone-gc/main.js` is a privileged Appwrite Function intended to run on a schedule. It scans all six synchronized tables for rows where:

- `deleted = true`
- `updated_at` is older than the retention cutoff

It then permanently deletes those rows.

The function defaults to 90 days and accepts `TOMBSTONE_RETENTION_DAYS` for controlled deployment configuration. Keep the function's configured retention period equal to or longer than the client constant in `src/db/sync.ts`.

### Appwrite Console setup

The function is intentionally not invoked by the browser. Deploy `appwrite-functions/tombstone-gc` as a separate Appwrite Function with the same project endpoint/project identity pattern used by `message-action`.

Configure:

- Runtime compatible with the existing Node.js Appwrite Functions setup
- `TOMBSTONE_RETENTION_DAYS=90`
- A scheduled trigger appropriate for periodic maintenance (daily is sufficient)
- The function API key/service credential required by the existing `node-appwrite` initialization

Before enabling the schedule in production, run the function once manually and inspect its reported `cutoff`, per-table counts, and total purged rows.

## Why this is safe

The protocol does not require a device registry. Safety comes from the retention horizon: clients that remain within the incremental window can receive tombstones normally; clients that fall outside the window switch to full reconciliation.

This is deliberately a bounded guarantee. If Mosaic later needs clients to remain offline for longer than 90 days without full reconciliation, the retention period can be increased, or the project can evolve to a server-side sync-version/device-acknowledgement protocol.

## Operational rule

Do not purge tombstones using an ad-hoc client-side delete. Permanent deletion is only valid through the synchronization-safe garbage-collection mechanism described here.
