# Backup and restore

This document is the authoritative contract for Mosaic user-controlled backups and personal-data restore.

## Scope

A user backup is a portable snapshot of the signed-in user's personal Mosaic data:

- tasks (scheduled and explicitly undated Backlog tasks)
- categories
- diary entries
- owner-only Bucket List aspirations (including current achievement timestamps)
- synced settings/preferences
- optional referenced task/profile images

Friendships may remain present in exported files for portability/reference, but personal restore never creates, deletes, or rewrites friendships. Messages, login/account state, and reciprocal social/profile state are outside personal restore. On cross-account restore, friendship-bound preferences such as friend-carousel ordering/hidden IDs are also preserved from the destination account rather than imported or replaced. Whole-system disaster recovery is a separate backend concern.

Shared-task invitations and memberships (`task_shares`) are server-owned social grants. Recipient personal exports must not include another owner's task or copy/restore shared grants. Creator personal restore may restore the creator's task content but must **not** recreate invitations or grant epochs. Whole-system DR snapshots may contain `task_shares` via the portable manifest; privacy-deletion markers must filter memberships involving the deleted owner or invitee before recovery.

## Format

- New exports use backup format version 5: six-domain logical tombstones, original IDs, category retirement, local drafts and available referenced photos are included. The manifest labels the scope `current-local-owner-snapshot`; it is not certified complete cloud history or ownership evidence.
- Versions 1–4 remain accepted with their original active-row behavior. Version 5 requires explicit source ownership, deletion flags and valid history timestamps; unresolved task/category or Bucket/task references fail before writes. Same-owner history preserves valid original IDs, including Diary/preferences/links. Unsupported historical IDs require verified migration; retain the archive.
- Export cancels if the account changes, including a switch away and back. Portable Settings override old device values and tombstones suppress fallback.
- Version 1 and 2 JSON/ZIP exports produced before Bucket List remain accepted for restore; they contain no aspirations.
- Backups include app/version metadata, export time, source-user metadata, record counts, the restorable data snapshot, friendship reference data, and image inventory.
- For tasks, `date: ''` is the explicit unscheduled Backlog placement. Restore preserves this value and validates nonempty calendar dates; a missing `date` field is invalid. Diary dates remain required. Existing v1/v2 backup formats remain accepted.
- JSON backups omit image blobs. ZIP backups may contain image blobs under `images/`.
- Restore must validate the file before changing local data. Unsupported/corrupt files fail without partial application.

## Identity and portability

Restore always writes data as the currently authenticated user. Source `userId` values are never trusted.

Settings and diary IDs are regenerated from the current user plus their logical key/date. Task/category IDs are preserved only when they are valid Mosaic/Appwrite row IDs and the backup belongs to the same account; otherwise deterministic current-account IDs are generated. Category references are rewritten with the same mapping. Re-importing the same backup therefore does not create duplicates, including when restoring into a different Mosaic account.

## Restore modes

### Merge — default

- Adds missing backup records.
- For the same logical record, the backup replaces current data only when the backup snapshot is newer.
- A newer current tombstone wins over an older active backup record, so merge does not resurrect a later deletion. The personal Supabase path repeats this comparison inside the atomic local write so a concurrent edit also wins.
- Records that exist only in current Mosaic data remain untouched.

### Replace personal data

Supabase does not offer Replace. Its personal profile permits only signed, online Merge of the six supported private domains; profile/social settings remain in the archive.

- The selected backup becomes authoritative for tasks, categories, diary, settings, and Bucket List aspirations.
- Matching backup records are restored even when the snapshot is older.
- Current active personal records absent from the backup are tombstoned with the restore time so sync propagates the deletion safely.
- Friendships, messages, login/account state, and reciprocal profile/social state are never part of this replacement.
- Before applying Replace, Mosaic shows a destructive confirmation that explains the scope, then automatically downloads a safety backup of the current personal snapshot. Existing remote image files are not deleted by Replace.
- Replace preflights the backup first, applies all backup rows successfully, and only then tombstones current-only personal rows. A failed backup-row write must not begin destructive tombstoning.

## Images

When a ZIP contains image blobs, restore ensures the needed images exist for the current account and rewrites restored references when cross-account portability requires it. Image recovery is idempotent: repeated restores reuse the same destination file where possible, and Merge does not upload images for rows it will skip as newer/equal current data. On Appwrite, missing or failed image recovery is reported and does not block data recovery. Supabase refuses a failed bundled-photo upload before applying rows, preserving the original archive for retry. If a backup belongs to another account and does not contain a referenced image blob, that inaccessible source-account image reference is cleared.

## Sync and failure behavior

Restore applies through Mosaic's local-first database and then proves replication convergence with a second bounded freshness barrier. Both restore modes require an online, successful refresh before writes begin. This is deliberate: without a fresh pull, Merge cannot know about a newer edit on another device and Replace cannot know about remote-only rows that need tombstones. Normal offline task editing remains supported; backup restore is a safety-sensitive exception.

The restore preflight uses `refreshSync()`, not the ordinary non-blocking background trigger. It first lets any compatibility bootstrap finish, then requests and awaits all six RxDB pilots through the leader-owned freshness barrier. If another tab owns replication leadership or the barrier cannot settle within 90 seconds, restore fails visibly rather than proceeding on stale state. Restore writes then flow through the same domain-specific paths as ordinary local changes: owner-write collections replicate through RxDB, friendship/message server-owned mutations keep their Function/outbox ownership, and image work keeps its existing best-effort rules. The six pilot freshness proofs run concurrently under one bounded request budget rather than spending that budget sequentially. Post-apply convergence uses an adaptive 90–300 second budget based on the amount of personal data applied; a timeout preserves local writes and means live replication is still finishing, not that the named collection is permanently broken.

Validation and restore planning complete before writes begin. v2 files must carry the Mosaic backup format marker, duplicate logical IDs are rejected, and normalized records must satisfy the local schema constraints before application. Restore progress can report coarse phase/percentage plus exact local row and image counts; the percentage is workflow progress, not byte throughput. During application Mosaic re-checks the authenticated account-work generation around every potentially long row/image operation and stops before continuing under a different account. Categories are applied before tasks so restored task references do not intentionally lead their category rows.

Data application is idempotent by logical/deterministic IDs. Image upload is best-effort and may be partial; data restore still completes and reports missing images. Replace uses tombstones rather than permanent row deletion. After local application Mosaic calls the real `refreshSync()` barrier again, bounded to 30 seconds. A successful barrier is reported as **Restore complete**. If that final barrier times out or loses connectivity, the already-written local RxDB data is retained and the UI reports **Restore saved locally · Sync pending** instead of falsely claiming remote completion; normal durable replication may continue on reconnect.


## External migrations

External-service migrations are not backup Replace operations. The TodoMate importer creates an in-memory Mosaic v2 payload and uses Merge by default.
A separately confirmed `todomate-replace` option treats only tasks and categories as
authoritative and tombstones current-only records in those domains **after** applying
new rows and downloading a safety backup. Diary still uses Merge; settings, Bucket List,
friendships, messages and accounts remain untouched. This is intentionally **not**
the broad personal-backup Replace mode and may not be requested by an uploaded ZIP. Its provider-specific network,
credential, mapping, and limitation contract lives in [TodoMate import](TODOMATE_IMPORT.md).

## Activity timestamps

Settings shows the most recent completed manual backup and successful restore for the current account. These timestamps are small per-account local operational metadata: they are not synced, exported, or restored, so importing an older backup cannot roll the displayed activity history backward. The automatic safety snapshot created before Replace Personal Data does not count as a manual backup.

## Friendship delivery compatibility

Friendships are server-controlled cached reference data. Export may include confirmed
relationships; pending delivery intents in `mosaic_friendship_commands_v1` are not backup
records. Neither Merge nor Replace imports, clears, or replays those intents. Existing
pending, accepted, blocked, and deleted relationships remain unchanged on same-account
and cross-account restore, including TodoMate imports. Backup versions remain unchanged.
See [friendship recovery](FRIENDSHIP_RECOVERY.md) for administrative legacy-data repair.

## Emergency personal import on the isolated Supabase core candidate (#1250)

The legacy ZIP/JSON parser and owner-remapped Merge restore are shared with the
experimental Supabase core provider. In Supabase mode, importing never calls
Appwrite account, Storage or replication APIs: before any write it requires
the browser's **active server-verified Supabase Auth owner** and a completed
signed RxDB pull/push freshness barrier, and checks that same owner during and
after applying data. A mere requested resync is not a freshness proof.

The core-only provider imports **tasks and categories**; the core-diary provider
can additionally import **private Diary**. Settings, Bucket List/links and
unsupported personal domains are **not uploaded or marked synced**. Original ZIP
must be retained intact for later recovery. There is no approved Supabase
image-storage upload yet: original image references stay on records, but photos
are not copied to cloud or certified available on other devices. The preview
must disclose this; never clear the old PWA cache or delete the original ZIP.
General Replace Personal Data is deliberately unavailable in Supabase core mode.
The separately confirmed TodoMate task/category Replace does not touch
unsupported domains. Interrupted local import work remains in RxDB with an
explicit sync-pending result rather than a false cloud-success claim.

This enables **isolated Preview testing**, NOT Appwrite historical completeness,
proof of trusted legacy identity mapping, or permission for real-user Production
cutover. Old Appwrite PWAs and final source deltas remain independent gates.
