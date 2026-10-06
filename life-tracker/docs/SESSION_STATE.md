# Session checkpoint

Updated: 2026-10-06
Current task: Connected-chat workflow latency audit on `chatgpt/workflow-timeout-guardrails`, targeting stable Preview `refactor/agent-workflow-efficiency`.
Status: Investigation of the TodoMate performance chat found that wall time was inflated mainly by workflow execution rather than inherently difficult code: repeated reads of the same files, tight serial CI/Vercel polling, multiple one-purpose repair/headroom branches and full stable acceptance cycles, late discovery of a nearly exhausted bundle-size ceiling, speculative dependency/API reasoning before checking the installed contract, and one unsafe JavaScript `String.replace` replacement that corrupted Markdown because literal `$\`` was interpreted as replacement syntax. The existing workflow already requires batching, focused task verification, one routine stable full gate, and no post-green status commit, but it did not make these latency failure modes explicit. This task adds connected-chat latency discipline to `AI_WORKFLOW.md` and a short discoverability pointer in `AGENTS.md`: read each file once per SHA, verify dependency contracts first, batch known repairs, preflight sub-1-KiB build headroom, avoid immediate identical status polls, target one stable acceptance cycle, handle missing CI triggers without polling, verify programmatic transforms, re-diagnose after two failed cycles, and keep progress narration sparse.
Next action: Commit the docs-only workflow update with focused verification, fix any documentation/contracts failures, squash-merge into `refactor/agent-workflow-efficiency`, and require the stable Preview canonical gate. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Why the prior chat was slow

- Re-reading the same source files and symbols across many connector calls added avoidable latency and tokens.
- CI/Vercel were polled repeatedly while state had not meaningfully changed instead of batching status checks around independent work.
- Known follow-ups were split into several micro-branches/merges, causing repeated full stable-Preview acceptance cycles.
- Production bundle headroom was only confronted after stable merges, leading to several byte-level repair cycles; tight budgets should be preflighted before the first stable acceptance.
- The RxDB `findByIds` failure escaped because the mock contract differed from the installed library; dependency/type shape should have been verified before patching.
- A JavaScript replacement string containing the dollar-backtick token corrupted the sync matrix; transformed output should have been re-read before commit.
- Too many low-value progress messages/status checks made long tool turns more likely to hit conversation/tool timeouts.

## Working files

- `AGENTS.md`
- `docs/AI_WORKFLOW.md`
- `docs/SESSION_STATE.md`
