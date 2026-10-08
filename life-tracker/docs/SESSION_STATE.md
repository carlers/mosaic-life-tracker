# Session checkpoint

Updated: 2026-10-09
Current task: #414 — reorganize and clean up repository documentation
Status: scoped cleanup prepared on `chatgpt/docs-authority-cleanup`; focused CI pending
Next action: verify the task branch, then squash into `refactor/docs-authority-cleanup` for canonical CI/Vercel Preview. Request separate user approval before promotion to `dev`.
Blockers: none identified.

## Intent and scope

- Make documentation ownership and navigation explicit without moving stable reference anchors.
- Correct the confirmed stale Alerts claim in the app README and outdated active-workstream guidance in the roadmap.
- Preserve unique backend, privacy, disaster-recovery, versioning, testing, and manual-acceptance contracts.
- Add regression coverage that keeps all maintained docs reachable from the index.

## Working set

- `README.md`
- `docs/README.md`
- `docs/PLAN.md`
- `docs/SESSION_STATE.md`
- `tests/unit/documentationContracts.test.ts`

## Completed substeps

- Reviewed all 29 tracked Markdown paths and their ownership; 25 reside in `docs/`.
- Confirmed the existing index already links every other maintained `docs/*.md`.
- Verified the `/notifications` page exists and the dedicated Diary view remains a planned item.
- Retained historical audit/rollout evidence instead of silently deleting or reclassifying contracts.
- Scoped the change to documentation and a documentation-index test; version impact NONE.

## Remaining substeps

- Run focused regression/contract tests and inspect the Markdown diff.
- Complete stable Preview canonical CI and Vercel READY verification.
- Record measured inventory and acceptance on issue #414; await `dev` promotion approval.

## Constraints

- No application runtime, design, Appwrite, configuration, CI gate, or version changes.
- Existing project-reference section numbers and runbook paths must remain stable.

## Verification

- Repository source/route audit completed; newly edited tree awaits CI.
- Physical-device/manual testing is not applicable to this documentation-only task.
