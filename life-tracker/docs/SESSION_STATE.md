# Session checkpoint

Updated: 2026-10-18 UTC
Current task: Speed up connected-agent execution through focused documentation routing and CI-first evidence guidance.

## Source and scope

- Base `dev@6ad5d271a4717e10ddd8be9ff74b846236407425`, product v0.29.11. Previous #858 performance checkpoint was superseded on dev by its accepted v0.29.11 promotion; #858 remains a separate open investigation, with no new product changes from this task.
- Workflow-only changes; product version impact **NONE**. Do not promote this Preview to dev/main without explicit owner approval.
- The owner approved the October 18 read-only agent-latency audit's documentation plan. ChatGPT Project custom instructions remain outside the repository and require user-side editing; this source change does not claim to have modified them.

## Work

- `docs/AI_WORKFLOW.md`: add a short task fast-path from exact-ref source discovery through minimal file scope, correct editing surface, a single focused→canonical delivery loop and verified handoff. Reuse existing safety/call-budget rules.
- `docs/README.md` and `docs/REPO_MAP.md`: add immediate Chat visual-change source routing.
- `docs/DELIVERY.md`: clarify exact-SHA CI-first trusted prebuilt provenance, missing Git metadata in Vercel CLI deployments and required stable Scratch-registered aliases for authenticated Preview.
- `AGENTS.md`: link to the fast-path. No runtime, backend, appearance, test framework or branch-protection edits. No version bump.

## Verification and handoff

- Run coherent `[verify:focused]` task CI; after green, squash to a new stable documentation Preview and verify exact-source canonical CI and trusted delivery. Documentation contracts and diff review are required. No new browser/device manual pass is represented by this docs-only task.
- Do not move accepted light-mode Chat Preview #961 or make unaccepted Chat visuals part of dev.

## Next action

- Inspect the committed diff and focused checks; if green, deliver stable Preview with canonical CI and trusted delivery. Share suggested concise ChatGPT Project instructions for the owner to replace manually, and await the upcoming small-UI-task comparison.
