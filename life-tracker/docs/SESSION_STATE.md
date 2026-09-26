# Session checkpoint

Updated: 2026-09-27

Current task: implement user-controlled Backup & Restore from the current Export Data foundation, including safe merge and replace-personal-data restore modes.

Status: implementation is complete on `chatgpt/backup-restore`, targeting stable Preview `feature/backup-restore`, both based from `dev` commit `d1535b76092b8a9878f5cc52cd5f61c521376d63`.

## Working set
- `src/lib/exportData.ts`, `src/lib/restoreData.ts`
- `src/components/modals/ExportDataSheet.tsx`, `src/pages/SettingsPage.tsx`
- backup/restore unit and Settings DOM regression coverage
- `docs/BACKUP_RESTORE.md`, `docs/README.md`

## Completed substeps
- Created `feature/backup-restore` from the exact current `dev` tip and `chatgpt/backup-restore` as the working branch.
- Audited and evolved the existing exporter into format v2 while retaining v1 JSON/ZIP restore compatibility.
- Added validation/preview before restore writes.
- Added default Merge semantics that keep current-only rows and preserve newer current versions/tombstones.
- Added Replace Personal Data semantics for tasks/categories/diary/settings only, with a pre-restore safety download and tombstones for current personal rows absent from the backup.
- Explicitly excluded friendships, messages, login/account state, and reciprocal social data from personal restore.
- Added deterministic cross-account task/category ID remapping; diary/settings IDs are regenerated for the current account. Re-importing a backup does not create duplicate logical rows.
- Added best-effort bundled-image upload/remapping; missing image recovery does not block personal data restore.
- Replaced Settings → Export Data with the Backup & Restore sheet, including backup creation, file preview, mode selection, warnings, and progress feedback.
- Focused Quality Gate run 903 passed on the complete feature/UI state before the final source-account ID-scope correction.

## Remaining substeps
- Complete exact-SHA full canonical acceptance on this final checkpoint and repair any failure until green.
- Squash-deliver the accepted task PR into `feature/backup-restore`.
- Verify the stable Preview branch Quality Gate and Vercel deployment.
- Record any remaining manual/browser acceptance separately.

## Constraints
- Preserve local-first sync semantics, account isolation, tombstones, and existing Appwrite row-ID rules.
- Replace never mutates friendships, messages, login/account state, or reciprocal social data.
- Existing v1 Mosaic exports remain importable.
- Do not promote the stable feature branch to `dev` without explicit user instruction.

## Verification
- Baseline: `dev` commit `d1535b76092b8a9878f5cc52cd5f61c521376d63`, Quality Gate 894 green per prior handoff.
- Focused feature verification: Quality Gate run 903 passed.
- Full canonical acceptance run 905 reached green checks/DOM/dependency gates but failed production build on a TypeScript BlobPart mismatch in restored image bytes; the image path now materializes an ArrayBuffer before constructing File.
- New full canonical acceptance: requested by this checkpoint commit.
- Manual/device acceptance: not yet performed.

Next action: complete the repaired full canonical acceptance, repair any remaining failure, then squash-deliver to the stable feature branch and verify Preview.

Blockers: none.
