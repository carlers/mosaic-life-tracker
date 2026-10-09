# Session checkpoint

Updated: 2026-10-09
Current task: #417 Settings icon, wording and grouping consistency.
Baseline: `dev` `15c7df12ac43e941b38018bee86efdc06097b567`, v0.7.1.
Task branch: `chatgpt/settings-clarity-size-repair` (repairing Preview `5734eacd`).
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

Repair the two measured aggregate build-size ceilings on the task branch, re-run focused CI, squash to the stable Preview and require canonical CI plus exact-SHA Vercel READY. Keep dev/main unchanged.

## First Preview diagnostic

- Task focused run `37957271986` passed; stable Preview `5734eacd` full CI `37957607672` passed checks, DOM and browser contracts but build failed on two aggregate limits. The measured v0.10.0 artifacts total 2,297,893 raw bytes (1,293 over the prior 2,296,600 limit) and 2,380,328 unique precache bytes (1,228 over the prior 2,379,100 limit); aggregate gzip and entry/startup/Home budgets all passed.
- Review a narrow +2,000-byte allowance to only raw app assets and PWA precache, with corresponding limit tests. Preserve gzip and startup/Home budgets; retain the existing size enforcement.
