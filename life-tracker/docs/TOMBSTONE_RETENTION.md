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

### Production rollout checklist

Use this checklist for the Console-only deployment step. It deliberately separates the
one-time execution from recurring deletion so an operator can stop before any scheduled
purge is enabled.

1. Create or update a `tombstone-gc` Function from
   `appwrite-functions/tombstone-gc`. Use the same trusted execution credential and
   Appwrite endpoint/project configuration pattern as `message-action`; do not put a
   browser-user credential in the function configuration.
2. Set `TOMBSTONE_RETENTION_DAYS=90`. The value must be equal to or greater than the
   client retention constant in `src/db/sync.ts`; lowering it can make an offline client
   miss a deletion before its stale-cursor full-pull recovery begins.
3. Deploy the function with no schedule enabled, then run one manual execution. Confirm
   the JSON response has `ok: true`, `retentionDays: 90`, an ISO `cutoff`, and `results`
   entries for `tasks`, `categories`, `diary`, `settings`, `friendships`, and `messages`.
   Confirm the execution log ends with `tombstone-gc: complete` and that no function error
   was reported. `purged: 0` is a valid first-run result.
4. Inspect the reported totals before proceeding. Rows can only be purged when both
   `deleted = true` and `updated_at` precedes the reported cutoff; non-deleted rows and
   tombstones inside the 90-day window must not be counted as purged.
5. After the manual execution is accepted, configure a daily scheduled trigger. Keep the
   schedule disabled if the manual response or logs are incomplete, then resolve the
   deployment/configuration issue before retrying.

To halt future cleanup, disable the scheduled trigger first. Already purged tombstones
cannot be restored by the function, so investigate from backups or audit records rather
than attempting a browser-side recreation.

## Why this is safe

The protocol does not require a device registry. Safety comes from the retention horizon: clients that remain within the incremental window can receive tombstones normally; clients that fall outside the window switch to full reconciliation.

This is deliberately a bounded guarantee. If Mosaic later needs clients to remain offline for longer than 90 days without full reconciliation, the retention period can be increased, or the project can evolve to a server-side sync-version/device-acknowledgement protocol.

## Operational rule

Do not purge tombstones using an ad-hoc client-side delete. Permanent deletion is only valid through the synchronization-safe garbage-collection mechanism described here.
