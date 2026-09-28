# Friendship rollout and recovery

Friendship row IDs and fields remain unchanged. RxDB and personal backup formats require
no schema migration. The upgrade changes authority: only `message-action` may write
friendship rows; browsers can read only their own copy. The backend manifest creates this
permission model for new installations. Existing installations require the repair below.

## Command contract

`action: friendship` takes `ownerId`, `friendUserId`, `operation` (send, accept, decline,
cancel, remove, block), and `expectedVersion` (the caller row's `updated_at`, or null for
an absent row). The authenticated header determines the caller; mismatched owner IDs fail.
Successful replies contain `ok: true` and the caller's canonical `row`. Stale transitions
return 409 and that same caller-only row. No client-supplied profile fields or permissions
are trusted. Both writes use one transaction; conflicts retry at most three times.

Send creates pending_outgoing/pending_incoming; accept requires an incoming request.
Decline/cancel/remove tombstone both rows. Block preserves bilateral blocked status.
Idempotent retries return current state without writing. A crossed send requires explicit
acceptance. Blocked relationships cannot be reopened through send or remove.

The persistent client queue is account-scoped and uses Web Locks across tabs where available.
A pending command is UI state, not a confirmed friendship row. Dependent actions acquire the
predecessor's returned version only after success. Permanent failure or five failed attempts
removes the pair's queued intents and reports failure; seven-day-old intents expire.
Legacy sends with verifiable identities migrate with an absent-row baseline; ambiguous old
updates require a fresh user retry. Normal sync never pushes friendship snapshots.

## Repair workflow

1. Rehearse in an explicitly designated isolated project. Use two test accounts and a third
   unrelated account; verify incoming visibility, no unrelated access, every transition,
   offline/reload retry, stale commands, and accepted-friend messaging/calendar reads.
2. Complete exact-SHA canonical acceptance. Deploy the new Function before the frontend.
   Use its checked-in dependency/configuration files; rows.read/rows.write are required.
3. Obtain a fresh completed, verified DR snapshot covering the current accounts and rows.
   Keep the snapshot ID and recovery credentials in the existing recovery process.
4. During the coordinated client/permission cutover, run the dry run from `life-tracker/`:

   ```sh
   npm run friendships:repair -- --target-project PROJECT_ID
   ```

   Set `APPWRITE_TARGET_ENDPOINT` and `APPWRITE_TARGET_API_KEY` through the operator's
   environment. The short-lived key needs rows.read/write and tables.read/write. Optional
   `APPWRITE_DATABASE_ID`, `APPWRITE_TABLE_FRIENDSHIPS`, and `APPWRITE_TABLE_PROFILES`
   support custom installations. No administrator key belongs in VITE variables.
5. Review the reported counts and ambiguous row IDs. Resolve ambiguity before cutover.
   Apply with a new private output path and the verified recovery snapshot ID:

   ```sh
   npm run friendships:repair -- --target-project PROJECT_ID --apply \
     --before-file /secure/path/friendships-before.json --recovery-snapshot SNAPSHOT_ID
   ```

   The file is created exclusively with mode 0600 and contains sensitive before-state.
   It must not be committed. Application rechecks row versions/permissions, stages writes
   in a transaction, sets owner-read-only permissions, reconstructs only unambiguous
   pending pairs, and disables browser table creation. The tool refuses ambiguous plans
   and batches larger than 90 changes. It verifies the result; rerunning is safe.
6. Release the compatible client to the intended Preview. Old clients must refresh before
   changing relationships. On upgrade, the first complete friendship pull replaces legacy
   dirty rows and tombstones missing cache entries; later pulls also reconcile GC removals.
7. Verify the previously invisible requests are visible, both rows have correct ownership,
   existing accepted relationships still work, and no raw friendship writes leave browsers.

A failed repair stops cutover; inspect the audit and repeat after resolving concurrent
changes. Do not restore old browser-write permissions as an application rollback. Preserve
corrected data and roll forward with a compatible client/Function. For full disaster
recovery, restore the original snapshot into an empty isolated project, verify it, then run
this migration before reopening access. Personal restore never repairs social state.

## Acceptance evidence

Handler tests cover permissions, authorization, transitions, atomic staging/rollback,
conflict retries, and account cleanup. Client tests cover queued results, permanent errors,
ordering, stale dependencies, account switches, expiry/migration boundaries, and pull-only
reconciliation. Backup/restore tests preserve all relationship states and DR row permissions.
Hosted two-account checks remain separate from mocks and must be recorded at rollout.
