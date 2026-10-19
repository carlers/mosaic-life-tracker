# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1034 follow-up — selected-task deletion always asks for confirmation.

## Scope and source
- Based on accepted stable Preview `feature/task-delete-confirmation-1034@54e16acac148205bee9af6c634a788fc5372ae5d` (v0.30.0).
- Task branch `chatgpt/1034-select-mode-always-confirm-20261020`.
- Updated user requirement: Select mode deletion (Day View and Backlog) must **always** confirm, regardless of preference.
- `confirmTaskDelete` continues to control **single-task deletion only**. Clarified the preference label; no schema, provider, auth, data/sync, or other destructive-action changes.
- Candidate Preview version v0.30.2 (v0.30.1 already reserved for the separate category-order Preview PR #1050).

## Changes
- `src/components/home/views/DayViewSheet.tsx`: always open existing bulk ConfirmSheet instead of direct selected deletion.
- `src/pages/PreferencesPage.tsx`: rename setting to “Confirm individual task deletion.”
- DOM regression: even with the preference OFF, selection-mode delete opens confirmation; Cancel preserves selection and triggers no writes; Confirm retains partial-failure selection/feedback; Backlog also prompts.
- Version metadata updated in appVersion.ts, package.json and package-lock.json.

## Verification
- Await focused task CI and stable Preview full canonical + trusted deployment; do not infer green evidence.
- Manual device/Scratch data testing outstanding. Previous v0.30.0 Preview is unchanged until new Preview squash.
- Protected `dev` and `main` promotions not approved.

## Next action
- Push coherent task [verify:focused] checkpoint; verify CI. Squash the green task PR into the original stable Preview branch, run its full canonical CI, verify trusted Vercel READY and link; report for user acceptance without protected promotion.
