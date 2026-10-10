# Session checkpoint

Updated: 2026-10-10
Task: issue #406 shared tasks — owner completion pending/race hardening on top of accepted Preview candidate.
Source dev: `224f8a700f35bbe3853206ee208e1dc103ece5b3` (v0.12.1); stable Preview: `feature/shared-tasks`, v0.14.0 at `33a003f40be66ba38e93faf6f07c12f9d2ff24fd`.
Working task: `chatgpt/shared-tasks-owner-receipts` branched from the stable Preview; original implementation branch `chatgpt/shared-tasks-contract` diverged after squash. Keep accepted Preview fixes: do not merge the old branch wholesale.

## Verified implementation
- Canonical Preview 38027441167 passed full build/size/PWA, unit/handler/DOM/browser/static gates at 33a003; Vercel READY. Appwrite Scratch acceptance remains blocked, not a user-testable shared task Preview yet.
- Creator tasks use durable RxDB replication and conditional server owner CAS. This batch adds account-scoped presentation-only pending receipts for known shared owner tasks, clears on successful replication, rejects on remote completion/title conflicts, and surfaces Day View pending sync. Central `useTasks.updateTask` covers ordinary and bulk completion. Preserves the current lazy Auth cleanup to protect tight Vercel size budgets.
- Added receipt and owner-title-vs-offline-completion regressions. Branch-focused CI and Preview canonical gate need rerunning for this delta.

## Blocking live backend
Read-only Scratch check: `life_tracker.task_shares` missing; `friendships` grants `create("users")` contrary to Git-owned server-only contract. Migration 008 is explicit-only permission tightening, excluded from normal `--apply`; 007 creates private membership schema. The exact repository CLI with a scoped Scratch API key and explicit project+confirm are required to apply 008 then 007. Connected Console calls may read only; never bypass migration workflow. Next package/deploy reviewed Function inactive and activate after schema readiness, then three-account/old-client/DR/browser and mobile checks. Production untouched.

## Delivery next
Pass focused checks on this task branch. Squash only this delta into `feature/shared-tasks` via PR, recheck full canonical and Vercel byte budget/READY. Do not promote `dev`/`main` or claim functional acceptance until Scratch provider and manual/device gates pass and the user separately approves promotion. Issue #406 remains open.
