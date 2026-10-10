# Session checkpoint

Updated: 2026-10-10
Current task: Issue #506 — topic-based, zero-manual-handoff resume after ChatGPT conversation failures.
Baseline: live `dev` `224f8a700f35bbe3853206ee208e1dc103ece5b3`.
Task branch: `chatgpt/cross-chat-resume-506`; stable Preview: `feature/cross-chat-resume-506`.
Scope: repository workflow/documentation only, no version bump, Appwrite schema, feature implementation, or dev/main promotion. The latest historical release-history snapshot described another task; that issue's actual state must be checked independently.

## Objective and changes

- Make natural-language topic recovery deterministic through exact GitHub issue matching, issue-local checkpoints, and live PR/branch/CI/deployment verification.
- Distinguish old chat timeout from failed operations; do not replay remote mutations without checking live state.
- Keep concurrent issues separate; `SESSION_STATE.md` is not the authoritative checkpoint for every issue.
- Implement in `AGENTS.md`, `docs/ISSUE_WORKFLOW.md` and `docs/AI_WORKFLOW.md`.
- Demonstration target: shared tasks #406; its accepted Preview branch and Scratch/manual blocker must be discoverable without original conversation.

## Verification and next action

Review exact docs diff, request `[verify:focused]` on the coherent task commit, then squash via PR into the stable Preview branch, verify full canonical CI and Vercel. Docs-only scope skips Appwrite cloud readiness. An actual fresh-chat/mobile acceptance has not been performed and must be reported separately.
No `dev` or `main` promotion is authorized for #506 or #406 by this task.
