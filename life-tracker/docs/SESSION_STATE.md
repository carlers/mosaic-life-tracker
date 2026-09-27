# Session checkpoint

Updated: 2026-09-27

Current task: harden the accepted Backup & Restore feature after manual Preview acceptance, add explicit confirmation before Replace Personal Data, and audit/fix restore edge cases before promotion.

Status: active on `chatgpt/backup-restore-hardening`, based on accepted stable Preview `feature/backup-restore` commit `e1df461fa0fb2172491000c66d8af74454f69efc`.

## Working set
- `src/lib/restoreData.ts`, `src/lib/storage.ts`, `src/lib/sdk.ts`
- `src/components/modals/ExportDataSheet.tsx`
- backup/restore and storage regression coverage
- `docs/BACKUP_RESTORE.md`

## Completed substeps
- User manually verified the first Backup & Restore Preview works.
- Audited the destructive/UI flow and restore ordering.
- Identified a replace-safety defect: current-only rows are tombstoned before backup rows finish applying, so a write failure can leave deletions with an incomplete restore.
- Identified image/idempotence waste: image blobs are restored before Merge decides which rows are actually eligible, causing unused uploads for newer/equal current rows and repeated imports.
- Identified validation gaps: v2 format identity is not checked, duplicate task/category source IDs can collapse silently, and file preview validates only the container shape rather than normalized record constraints.
- Identified a safe-default UI edge: choosing a new backup retains a previously selected Replace mode instead of resetting to Merge.

## Remaining substeps
- Add explicit nested destructive confirmation for Replace Personal Data and lock the parent restore surface appropriately.
- Add semantic preflight planning/validation before writes; apply backup rows before destructive replace tombstones.
- Make bundled-image recovery idempotent and limit it to rows the restore plans to apply.
- Add regression coverage for the confirmation flow, failure ordering, skipped-image uploads, malformed backups, and image reuse.
- Run focused checks, exact-SHA canonical acceptance, squash-deliver back to `feature/backup-restore`, and verify its Preview.

## Constraints
- Preserve v1 Mosaic export compatibility and v2 backup compatibility.
- Preserve offline/local-first restore semantics and normal tombstone-based sync.
- Replace never mutates friendships, messages, login/account state, or reciprocal social data.
- Do not promote `feature/backup-restore` to `dev` without explicit user instruction.

## Verification
- Stable baseline: `feature/backup-restore` commit `e1df461fa0fb2172491000c66d8af74454f69efc`; Quality Gate run 908 canonical acceptance passed and Vercel Preview was READY/200.
- Manual baseline: user reports Backup & Restore works on Preview.
- Hardening verification: pending.

Next action: implement regression tests for the audited failure modes, then fix runtime behavior to green.

Blockers: none.
