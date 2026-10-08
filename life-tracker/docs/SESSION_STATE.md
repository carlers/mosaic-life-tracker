# Session checkpoint

Updated: 2026-10-09. Current work: implement the approved GitHub Issues intake
and handoff workflow, tracked by issue #395, on `chatgpt/github-issues-workflow`
for delivery to stable Preview `feature/github-issues-workflow`.

## Objective and boundaries

- Preserve ChatGPT as the primary developer interface: minimal public issue
  capture, duplicate checks, issue-first planning and critique, issue/PR linkage,
  cross-chat retrieval, and explicit release-state closure.
- Changes limited to repo guidance and documentation; no app UI/runtime changes,
  GitHub Projects requirement, automatic coding, production release, or version
  bump. Follow the existing focused task -> stable Preview canonical gate.

## Work and verification

- Issue #395 created as an actual connector write; verify read and non-destructive
  update separately. New `docs/ISSUE_WORKFLOW.md` explains capture through
  release lifecycle and public-data constraints.
- Working files: `AGENTS.md`, `docs/AI_WORKFLOW.md`,
  `docs/DELIVERY.md`, `docs/README.md`, `docs/PLAN.md`,
  `docs/ISSUE_WORKFLOW.md`, `docs/SESSION_STATE.md`.
- CI and Preview verification belong to the pushed coherent task commit;
  do not record unobserved checks as passed. GitHub-connected execution may
  lack local npm runtime access; use focused CI and stable Preview checks.
- Next action: review exact document diff and complete issue read/update,
  focused validation, squash into stable Preview, and canonical deployment checks.
  Leave `dev` and `main` untouched without explicit promotion approval.

## Existing release caveats

- Previous dev 0.5.1 precache metadata normalization reached `dev` at
  `0fe98f7b`; this workflow change does not alter that product version.
- Main production Appwrite `006-push-details` migration and manual device
  acceptance of account-synced Alerts retention remain separate outstanding
  work; this task does not authorize those changes.
