# Session checkpoint
Updated: 2026-10-12
Current task: #408 — Diary View Preview stabilization (v0.22.0).

- Source baseline: `dev@dbde9515`; stable Preview: `feature/diary-408`, now `7a637293`, deployment Vercel `dpl_HP7wSy9kX5m6GVHLfGQGQtsaYYHX` READY. Stable branch alias: `mosaic-life-tracker-git-feature-788f0b-carls-projects-72516fde.vercel.app`.
- Implemented: shared compact month + inline Day View, emoji marker and owner editor/visibility, opt-in Calendar Day View diary and Today shortcut; optional RxDB v1 emoji migration / schema mappings / backup import, read-only authorized friend-month handler. No dev/main merges.
- Focused CI for task `4dd73293` green. Stable Preview canonical `38235171614` found a handler-test harness mismatch: MockQuery lacked `greaterThanEqual`; production uses Appwrite Query date range.
- Current repair branch `chatgpt/408-diary-access-guard-repair-20261012` adds missing mock query method, and guards/remounts Diary editor/reader on person, account and view transitions. Requires focused green then squash-merge to Preview and canonical CI/Vercel READY at the exact new SHA.
- Scratch Appwrite project `6a96e82d000d1310b3be` is shared; read-only inspection confirmed Diary `emoji` column absent and active `message-action` deployment predates this feature. Migration 012 and Function exact-SHA activation remain unapproved/not performed. Production/Appwrite must not be modified without separately reviewed authorization and exclusive Scratch coordination.
- Remaining delivery: canonical CI, exact Vercel READY, verified stable alias's Scratch origin registration, approved Scratch migration and Function deployment, disposable account sync and privacy tests, Android/iOS/desktop manual acceptance. Issue #408 stays open. Do not promote dev/main.
Next action: Verify focused repair, squash to stable Preview, check canonical + Vercel. Only then coordinate Scratch backend changes.
