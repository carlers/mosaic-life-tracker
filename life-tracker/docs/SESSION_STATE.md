# Session checkpoint

Updated: 2026-10-09. Current work: integrate the ChatGPT-first GitHub Issues
intake/plan/handoff workflow (#395) with current `dev` v0.5.3.

## Intent and scope

- Record short Mosaic development ideas as GitHub issues without automatically
  starting implementation; retrieve and expand them on explicit planning requests.
- Preserve public-repo privacy limits, duplicate checks, planned acceptance, and
  task/PR/Preview/dev/main linkage in `docs/ISSUE_WORKFLOW.md`.
- Keep GitHub Projects optional. Existing Git/Appwrite/CI/Preview/release rules
  stay in force; no runtime, backend, theme, or semantic-version change.
- Authorized separately in chat: capture the 16 approved backlog items (issues
  #402–#417), and promote this workflow guidance to `dev` after acceptance.
  Do not promote `main` without a new instruction.

## Working references

- Earlier implementation PR #397 delivered issue guidance on
  `feature/github-issues-workflow` at `9d75f12f` (full CI passed), but that
  Preview diverged from newer `dev` and cannot be safely promoted as-is.
- Current `dev` base `7dc3a891` already carries the accepted v0.5.3 light
  theme and env-inlining fix. The workflow documentation is reconciled on
  `chatgpt/github-issues-dev-ready` for stable Preview
  `feature/github-issues-workflow-dev-ready`.
- Changes are confined to `AGENTS.md` and `docs/{AI_WORKFLOW,DELIVERY,
  ISSUE_WORKFLOW,PLAN,README,SESSION_STATE}.md`. Theme guidance and the
  newer dev source are preserved. No production Appwrite modification.
- Issue #395 and the associated PR/Actions/Vercel records are authoritative
  for live verification and promotion state; do not claim manual or CI success
  without those records.

## Next action and remaining checks

Complete focused CI, reconcile/accept the stable Preview, verify canonical CI
and Vercel READY, then merge its unchanged accepted source tree to `dev` per
explicit user approval. Confirm the `dev` deployment. New-chat issue-handoff
acceptance requires a separate actual conversation; it is not assumed.

Previous outstanding production migration `006-push-details` and physical-device
theme/Alerts checks remain out of scope.
