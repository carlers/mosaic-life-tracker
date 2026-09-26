# Backup and restore

This document is the authoritative contract for Mosaic user-controlled backups and personal-data restore.

## Scope

A user backup is a portable snapshot of the signed-in user's personal Mosaic data:

- tasks
- categories
- diary entries
- synced settings/preferences
- optional referenced task/profile images

Friendships may remain present in exported files for portability/reference, but personal restore never creates, deletes, or rewrites friendships. Messages, login/account state, and reciprocal social/profile state are outside personal restore. Whole-system disaster recovery is a separate backend concern.

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
- Before applying Replace, Mosaic automatically downloads a safety backup of the current personal snapshot. Existing remote image files are not deleted by Replace.

## Images

When a ZIP contains image blobs, restore uploads them for the current account and rewrites restored references to the new file IDs. Missing or failed image recovery never blocks task/category/diary/settings recovery. If a backup belongs to another account and does not contain a referenced image blob, that inaccessible source-account image reference is cleared.

## Sync and failure behavior

Restore applies through Mosaic's local-first database and then requests the normal sync engine. Offline restore is allowed; normal sync sends the changes when connectivity returns.

Validation completes before writes begin. Data application is idempotent by logical/deterministic IDs. Image upload is best-effort and may be partial; data restore still completes and reports missing images. Replace uses tombstones rather than permanent row deletion.
