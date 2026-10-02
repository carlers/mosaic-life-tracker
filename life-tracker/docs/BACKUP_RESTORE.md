# Backup and restore

This document is the authoritative contract for Mosaic user-controlled backups and personal-data restore.

## Scope

A user backup is a portable snapshot of the signed-in user's personal Mosaic data:

- tasks
- categories
- diary entries
- synced settings/preferences
- optional referenced task/profile images

Friendships may remain present in exported files for portability/reference, but personal restore never creates, deletes, or rewrites friendships. Messages, login/account state, and reciprocal social/profile state are outside personal restore. On cross-account restore, friendship-bound preferences such as friend-carousel ordering/hidden IDs are also preserved from the destination account rather than imported or replaced. Whole-system disaster recovery is a separate backend concern.

## Format

- New exports use backup format version 2.
- Version 1 JSON/ZIP exports produced by Mosaic before this feature remain accepted for restore.
- Backups include app/version metadata, export time, source-user metadata, record counts, the restorable data snapshot, friendship reference data, and image inventory.
- JSON backups omit image blobs. ZIP backups may contain image blobs under `images/`.
- Restore must validate the file before changing local data. Unsupported/corrupt files fail without partial application.

## Identity and portability

Restore always writes data as the currently authenticated user. Source `userId` values are never trusted.

Settings and diary IDs are regenerated from the current user plus their logical key/date. Task/category IDs are preserved only when they are valid Mosaic/Appwrite row IDs and the backup belongs to the same account; otherwise deterministic current-account IDs are generated. Category references are rewritten with the same mapping. Re-importing the same backup therefore does not create duplicates, including when restoring into a different Mosaic account.

## Restore modes

### Merge — default

- Adds missing backup records.
- For the same logical record, the backup replaces current data only when the backup snapshot is newer.
- A newer current tombstone wins over an older active backup record, so merge does not resurrect a later deletion.
- Records that exist only in current Mosaic data remain untouched.

### Replace personal data

- The selected backup becomes authoritative for tasks, categories, diary, and settings.
- Matching backup records are restored even when the snapshot is older.
- Current active personal records absent from the backup are tombstoned with the restore time so sync propagates the deletion safely.
- Friendships, messages, login/account state, and reciprocal profile/social state are never part of this replacement.
- Before applying Replace, Mosaic shows a destructive confirmation that explains the scope, then automatically downloads a safety backup of the current personal snapshot. Existing remote image files are not deleted by Replace.
- Replace preflights the backup first, applies all backup rows successfully, and only then tombstones current-only personal rows. A failed backup-row write must not begin destructive tombstoning.

## Images

When a ZIP contains image blobs, restore ensures the needed images exist for the current account and rewrites restored references when cross-account portability requires it. Image recovery is idempotent: repeated restores reuse the same destination file where possible, and Merge does not upload images for rows it will skip as newer/equal current data. Missing or failed image recovery never blocks task/category/diary/settings recovery. If a backup belongs to another account and does not contain a referenced image blob, that inaccessible source-account image reference is cleared.

## Sync and failure behavior

Restore applies through Mosaic's local-first database and then requests the normal replication layer. Both restore modes require an online, successful refresh before writes begin. This is deliberate: without a fresh pull, Merge cannot know about a newer edit on another device and Replace cannot know about remote-only rows that need tombstones. Normal offline task editing remains supported; backup restore is a safety-sensitive exception.

The restore preflight uses `refreshSync()`, not the ordinary non-blocking background trigger. It first lets any compatibility bootstrap finish, then requests and awaits all six RxDB pilots through the leader-owned freshness barrier. If another tab owns replication leadership or the barrier cannot settle within 90 seconds, restore fails visibly rather than proceeding on stale state. Restore writes then flow through the same domain-specific paths as ordinary local changes: owner-write collections replicate through RxDB, friendship/message server-owned mutations keep their Function/outbox ownership, and image work keeps its existing best-effort rules.

Validation and restore planning complete before writes begin. v2 files must carry the Mosaic backup format marker, duplicate logical IDs are rejected, and normalized records must satisfy the local schema constraints before application. Data application is idempotent by logical/deterministic IDs. Image upload is best-effort and may be partial; data restore still completes and reports missing images. Replace uses tombstones rather than permanent row deletion.


## External migrations

External-service migrations are not backup Replace operations. The TodoMate importer creates
an in-memory Mosaic v2 payload and enters this restore engine only through Merge mode, so an
external migration cannot delete current-only Mosaic data. Its provider-specific network,
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
