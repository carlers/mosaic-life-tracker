# Session checkpoint

Updated: 2026-10-14 UTC
Current scope: #708 — reintegrate accepted chat reliability into current dev, prepare Preview only.

## Live baseline
- `dev@881ae72e9768b33d8134457d79f977814e72e51c` version 0.23.4 includes #592 six-member CI producer and #784 2-hard/5-advisory build policy. `main@a7d4c431eef6902f1d2d35271b6b8e41f8e9228e` Production 0.17.4 unchanged. Generic CI-first rollout OFF after verified rollback; keep OFF.
- User-accepted #708 integrated candidate `fix/chat-reliability-708-dev-integration-20261012@7aef04493a954490ae21a372868098c81929b75c` version 0.24.1, canonical #38257493293 SUCCESS, but Vercel lacked READY due to old daily 402 limit. Old PR #747 is stale/conflicting and must not merge.
- Live Scratch Function `message-action` v0.24.1 compatibility deployment `6accddcbede4ccb26900` was activated and read back ready after preserving concurrent Diary handlers. This task makes NO Scratch/Production changes.

## This task
- Reapply only the originally accepted #708 chat runtime/handler/tests exactly from 7aef0449 onto the latest dev tree, preserving every current dev workflow, size-budget, routing and config file; update 3 app/package version declarations to 0.24.1. No backend/cloud deployment in this task. Verify source files have no conflict with intervening dev-only changes.
- Quiet `chatgpt/708-reintegrate-20261014` runs focused only. After success stage a NEW dev-derived stable `fix/chat-reliability-708-integration-20261014` for full canonical + Vercel Scratch READY. Never merge stale #747 or task directly to dev.
- Before any promotion, reverify latest dev ancestry, exact stable source tree, READY Preview, Scratch Function identity, strict Appwrite account isolation, and required preflight. Separate explicit user approval is needed if scope changes. User-confirmed earlier two-user Chat Preview basic workflow; no new phone/device test claimed.

## Next action
- Review quiet CI. Then create reviewed task→stable squash PR, verify full canonical and Vercel READY without unnecessary deployment retries. Record speed/provider outcomes for #592 assessment and report remaining manual tests before any dev promotion. #708 stays OPEN; #745 long-tail performance/stress, #682 notification refinements deferred until chat acceptance.
