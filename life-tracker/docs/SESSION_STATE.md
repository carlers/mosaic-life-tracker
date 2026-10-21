# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #955 — Integrate Uncompleted Tasks v0.37.1 Preview into updated dev.

## State and authorization
- User approved promotion of accepted borderless Uncompleted Tasks to `dev`; **not** main or Production.
- Accepted original Preview `feature/uncompleted-tasks-955@29845b726351e7d1b8e2d7c9d1418a472c5dba96`, v0.37.1, canonical Quality Gate #39532689733 SUCCESS and trusted Preview Delivery #39532969290 SUCCESS; exact Vercel deployment `dpl_DA6Cme6TG3pKQjAy8GWyqXFfjQmj` READY.
- `dev@7b7c3a2f6944e5a855a81a9c81f14382a064307c` has since integrated independent #1126 MosaicSelect v0.37.0; old Preview and dev diverged. Direct promotion fails the same-tree provenance gate.
- Task branch `chatgpt/955-dev-integration-20261021` and integrated Preview branch `feature/uncompleted-tasks-955-dev-integrated-20261021` both start from that dev SHA.

## Integration
- Preserve every code/test/theming file from the current dev dropdown workstream.
- Apply only #955 owner-only uncompleted task list, protected Backlogs query-mode route, hamburger and Me entry points, focused unit/DOM tests and project reference from accepted Preview.
- Merge generated component index (preserve MosaicSelect and add UncompletedTasksPage), replace the task checkpoint with this integrated handoff.
- Reconcile version to **v0.38.0** (new MINOR line for the feature in updated dev; don't reuse the independent v0.37.0 dropdown release or alter a previously accepted Preview artifact).
- Backend, schema, routing allowlist, and security configs unchanged; received shared tasks remain excluded.

## Gates / handoff
- Task integration requires exact-SHA focused CI and squash to integrated stable Preview, then fresh full canonical acceptance and Vercel READY before authorized dev PR.
- For promotion, verify newest dev and integrated Preview SHAs, exact same merge tree and provenance; use a descriptive merge commit. Canonical dev status/Preview deployment must be verified separately.
- No physical-device Light/Dark/Black/manual Scratch login acceptance performed; do not claim otherwise.
