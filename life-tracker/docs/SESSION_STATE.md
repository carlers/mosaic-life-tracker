# Session checkpoint

Updated: 2026-10-09
Current task: #417 Settings icon, wording and grouping consistency.
Baseline: `dev` `15c7df12ac43e941b38018bee86efdc06097b567`, v0.7.1.
Task branch: `chatgpt/settings-clarity`.
Stable Preview target: `feature/settings-clarity`.
Candidate version: `0.10.0`. Separate #410/#416 v0.8.0 and #402 v0.9.0 remain independent; promote lower numbered features before this one to preserve monotonic versioning.

## Scope and contracts

- Preserve functional Profile, Account, Preferences, Notifications, Sync Status, Backup & Restore, TodoMate Import, update checking/installation, Delete Account, Clear Local Data, and Sign Out.
- Organize functional account/app controls, explicitly upcoming destinations, data/sync controls, Version/update, and data deletion into labeled accessible sections.
- Add honest "Coming soon" trailing labels while retaining the prior in-app feedback; replace misleading Announcements "N" decoration and distinguish permissions, stickers, sync iconography.
- Display last backup/restore activity immediately below Backup & Restore, not below unrelated import.
- Keep native Version disclosure initially collapsed; preserve nested commit-message disclosure, destructive confirmation flow, and existing Dark/Black/Light semantic text styling.
- No new Settings framework, backend/schema/permissions change, or #404 large-screen redesign.

## Verification

- Update DOM regression for accessible regions, availability and upcoming states; preserve existing version, updates, backup and account-deletion regression tests.
- Task focused CI then squash to stable Preview; require canonical CI and exact-SHA Vercel READY. Manual phone/tablet and themed visual acceptance separately.
- No dev/main promotion without explicit approval.

## Next action

Commit the scoped settings source/tests/docs/version tree, run focused CI and repair failures; then verify the stable Preview.
