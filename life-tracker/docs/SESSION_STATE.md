# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #526 — lightweight shared Scratch old-client compatibility preflight (tooling only).

## Verified baseline
- Current dev source dc24b1db7c7f10eb50922a8b263a9217a5c6aa7a already contains user-accepted v0.24.4 #861 Sync Now progress refinement plus the #708 v0.24.3 strict mapper fix for additional Diary/messages columns.
- #526 remains open. Legacy #557 manual writer PR is open and not mergeable as-is; do not promote it wholesale. The simplified design retains one coordinated shared-Scratch write window, avoids permanent per-branch Appwrite instances and preserves parallel frontend work. Live Scratch state was not changed or revalidated in this task.

## Scope
- Add read-only appwrite:preview:compat against immutable active consumer commit SHAs and candidate Git-owned table shapes. Run historical mappers/strict RxDB schemas for eight synced collections including a hypothetical future field. Reject missing historical source, unknown columns reaching RxDB and invalid documents.
- Add unit regressions and a lightweight active-consumer/rollout checkpoint procedure. Keep backend writes explicitly approved and coordinated; preflight supplements Function/privacy and live multi-account checks.
- No app version change; no Appwrite schema, Function, dev, main or Production writes.

## Next action
- Run focused checks on chatgpt/526-scratch-compatibility-20261015; then squash verified work into a dedicated stable refactor Preview and confirm canonical CI/Vercel if available. Keep #526 open for live integration/readiness and safe activation workflow completion.
