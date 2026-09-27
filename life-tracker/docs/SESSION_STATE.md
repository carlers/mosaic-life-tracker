# Session checkpoint

Updated: 2026-09-27

Current task: harden Backup & Restore after the user manually accepted the first Preview; add explicit confirmation before Replace Personal Data and close restore/data-safety edge cases before promotion.

Status: implementation/audit complete on `chatgpt/backup-restore-hardening`, based on stable Preview `feature/backup-restore` commit `e1df461fa0fb2172491000c66d8af74454f69efc`. Focused CI is green; full canonical acceptance is next.

## Working set
- `src/lib/restoreData.ts`, `src/lib/storage.ts`, `src/lib/sdk.ts`
- `src/components/modals/ExportDataSheet.tsx`, `src/components/ui/ConfirmSheet.tsx`, `src/components/ui/BottomSheet.tsx`
- backup/restore, storage, BottomSheet DOM, and browser-history regression coverage
- `docs/BACKUP_RESTORE.md`, `docs/PROJECT_REFERENCE.md`

## Completed substeps
- Added an explicit destructive confirmation before Replace Personal Data; selecting a different backup resets mode to Merge.
- Replace now validates/plans first, applies all backup rows before current-only tombstones, and does not begin destructive deletion when a backup-row write fails.
- Both Merge and Replace require a successful fresh sync from the active restore attempt before writes, so newer remote edits/remote-only rows cannot be missed.
- Restore re-verifies the authenticated account before writes and destructive tombstones; restored images also reject account changes.
- Added v2 format identity, duplicate-ID, schema-length, valid date/file-ID, and unsafe-setting-key validation during preview/preflight.
- Bundled images are planned only for rows that will apply, use deterministic/reusable file IDs, avoid repeated Storage leaks, and can retry a previously failed portable-image recovery without overwriting newer edits or resurrecting tombstones.
- Cross-account restore preserves destination friendship-bound preferences (`friend_carousel_prefs`) and continues to exclude friendships/messages/account state from personal restore.
- Added synchronous restore invocation locking to prevent rapid double-confirm races.
- Added a separate `BottomSheet.preventDismiss` contract for in-flight operations; it blocks backdrop, Escape, and browser/Android Back without changing existing `isLocked` drag-only semantics or hiding the active dialog from accessibility.
- Updated authoritative backup/restore and BottomSheet contracts plus regression coverage for the audited failure modes.

## Constraints
- Preserve v1 Mosaic export compatibility and v2 backup compatibility.
- Normal Mosaic editing remains local-first/offline, but backup restore intentionally requires online fresh-sync reconciliation before writes for cross-device data safety.
- Replace never mutates friendships, messages, login/account state, or reciprocal social data.
- Do not promote `feature/backup-restore` to `dev` without explicit user instruction.

## Verification
- Baseline: `feature/backup-restore` commit `e1df461fa0fb2172491000c66d8af74454f69efc`; Quality Gate run 908 canonical acceptance passed; user manually verified that Preview.
- Hardening focused checks: latest focused Quality Gate through run 955 green.
- New coverage includes Replace confirmation, safe failure ordering, fresh-sync gating, malformed backup rejection, image idempotence/retry, account switching, tombstone safety, cross-account social preference isolation, and non-dismissible browser-history behavior.
- Full exact-SHA canonical acceptance: pending.
- Stable Preview deployment after squash delivery: pending.
- Manual re-check of the new confirmation/Back behavior on hosted Preview: pending.

Next action: create the final `[verify:full]` checkpoint commit, wait for exact-SHA canonical acceptance, squash-deliver to `feature/backup-restore`, verify Vercel READY/200, then hand off the Preview for the remaining manual check.

Blockers: none.
