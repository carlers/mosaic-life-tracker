# Session checkpoint

Updated: 2026-09-27

Current task: implement user-controlled Backup & Restore from the current Export Data foundation, including safe merge and replace-personal-data restore modes.

Status: active on `chatgpt/backup-restore`, targeting stable Preview `feature/backup-restore`, both based from `dev` commit `d1535b76092b8a9878f5cc52cd5f61c521376d63`.

## Working set
- `src/lib/exportData.ts`, new restore logic, Settings backup/restore UI
- backup/restore unit and DOM regression coverage
- `docs/BACKUP_RESTORE.md`, `docs/README.md`

## Completed substeps
- Created `feature/backup-restore` from the exact current `dev` tip and `chatgpt/backup-restore` as the working branch.
- Audited the current exporter: it already snapshots active tasks, categories, diary, settings, friendship reference data, and optional images.
- Defined personal-restore boundaries: tasks/categories/diary/settings are restorable; friendships/messages/account state are not.
- Defined merge, replace, cross-account ID remapping, idempotence, image recovery, and pre-replace safety-backup contracts.

## Remaining substeps
- Add regression tests for validation, merge, deterministic cross-account restore, replace tombstoning, and social-data exclusion.
- Implement backup format v2 while accepting existing v1 exports.
- Implement restore parsing/validation/application and best-effort image recovery.
- Replace the Settings Export Data surface with Backup & Restore and add restore preview/mode selection.
- Run focused checks, then exact-SHA canonical acceptance; repair failures until green.
- Squash-deliver to `feature/backup-restore` and verify stable Preview deployment.

## Constraints
- Preserve local-first sync semantics, account isolation, tombstones, and existing Appwrite row-ID rules.
- Replace never mutates friendships, messages, login/account state, or reciprocal social data.
- Existing v1 Mosaic exports must remain importable.
- Do not promote the stable feature branch to `dev` without explicit user instruction.

## Verification
- Baseline: `dev` commit `d1535b76092b8a9878f5cc52cd5f61c521376d63`, Quality Gate 894 green per prior handoff.
- New feature verification: pending.

Next action: land the spec-first restore regression tests, then implement to green.

Blockers: none.
