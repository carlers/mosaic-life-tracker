# Session checkpoint

Updated: 2026-10-20 UTC
Current task: Promote owner-accepted optional task-delete confirmation (#1034) onto current dev.

## Boundary
- User approval: owner tested v0.30.2 and explicitly requested merge to `dev` on 2026-10-20.
- Original accepted stable Preview: `feature/task-delete-confirmation-1034@bfaeb39347ff686f381374b846356b61cb8da85d` (v0.30.2); canonical CI [39297778715] SUCCESS and trusted prebuilt Preview [39298099497] READY.
- New protected dev baseline: `9cc215d1621ee75b0585ee0a457916e1797f3435` (v0.31.3). It includes category inline editing/reversal, sticky Calendar weekday headers, and Select-mode checkbox suppression. Never overwrite these accepted changes.
- Task: `chatgpt/1034-delete-confirm-current-dev-20261020`; expected integrated stable Preview `feature/1034-delete-confirm-current-dev-20261020`; next available version v0.31.4 (must avoid version regression/collision).
- Scope: Individual delete confirmation toggle defaults on, can be disabled per signed-in user. Select-mode bulk deletion **always** asks for confirmation, regardless of toggle. Applies to Day View and Backlog. No backend, schema, account, photo, provider or Production changes.

## Integration changes
- Apply previously accepted v0.30.2 behavior and component DOM regressions onto latest dev, preserving unrelated current dev files and user-facing settings.
- `src/lib/preferences.ts`: `confirmTaskDelete` setting; only exact false opts out.
- `src/pages/PreferencesPage.tsx`: `Confirm individual task deletion` Tasks switch.
- `src/components/home/views/DayViewSheet.tsx`: optional single-task confirmation, mandatory bulk confirmation, delete error/partial failure feedback, in-flight guards.
- `tests/components/PreferencesPage.test.tsx` and `DayViewSheetRegression.test.tsx`: accepted behavior tests.
- Set version across package.json/package-lock.json/src/lib/appVersion.ts to 0.31.4.

## Verification and delivery
- No focused CI, integrated canonical CI, or integrated Vercel deployment asserted yet.
- Existing previous Preview evidence is not evidence for this new integrated tree.
- Next: one coherent task `[verify:focused]` commit; after passing, squash into new stable Preview, verify full canonical acceptance and trusted Preview READY, then conduct exact-tree protected merge PR into current `dev` under explicit owner approval.
- Do not modify `main` or publish to Production.
