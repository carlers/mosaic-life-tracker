# Session checkpoint

Updated: 2026-10-11
Current task: #476 — automatic GitHub production release publishing.
Baseline: live `dev` `60fe24b7852d420ee9c0915ed597ee61bc71801b`; `main` `95c8b25edeba5e2730252f6d265d392949890caa` (v0.12.1).
Task branch: `chatgpt/production-release-automation-476`; target stable Preview: `feature/production-release-automation-476`.

## Objective and changes

- Add a GitHub Actions publisher independent of which AI agent promotes an approved versioned change to main; no new external app/service and no user-facing version change.
- Verify exact main canonical CI, version bump relative to prior main, approved merge PR + curated release notes, exact production Vercel status and public deployed build metadata before creating immutable version tags and stable GitHub Releases.
- Idempotent retry, six-hour reconciliation, bounded production-ready polling, release readback, version/tag conflict refusal, no release from dev/Preview/workflow-only same-version pushes.
- Add isolated unit tests for notes, publication guards, release eligibility and production identity; update delivery/versioning contracts.
- No Appwrite, production data, theme, layout, or application runtime changes.

## Verification

- Unit and workflow CI remain to be run for exact task/Preview commits; live release publication cannot be exercised until the publisher is explicitly promoted to main.
- The existing v0.12.1 main GitHub Release remains missing; creating it requires exact historical SHA and separately verified publication.

## Next action

Complete source/diff review; run task `[verify:focused]` CI, repair failures, squash to stable Preview, verify full canonical CI and Preview Vercel READY. Do **not** promote to dev/main or create the v0.12.1 tag without explicit user approval. Record any live-provider/permission blockers in issue #476.
