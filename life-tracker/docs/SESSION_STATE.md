# Session checkpoint

Updated: 2026-10-11 12:34 UTC
Current task: #592 same-version release CI recovery after v0.17.4 main promotion.

## Live verified state
- User approved production Appwrite Function rollout and main release. `dev=7ee614610e39f6d580a399562038bac2b87b0ada` (v0.17.4), `main=e60f6138982efadce07e217c8addb027feed959d` (v0.17.4) as of this checkpoint.
- Original main production promotion PR #608 merged, source tree identical to accepted stable Preview/approved dev tree `dd555bcc67701d6bcdb7fac6b569eee18fe143a9`.
- Production Appwrite `message-action` new inactive build from dev exact SHA `6acb8162dc02a1deaa23` READY, explicitly activated with production authorization and verified live; previous rollback ID `6acafcff6aef69e8292a`. No schema migrations or user-data modifications.
- Vercel Production `dpl_481A6Qvd7Md22AiMKpMyoDb8Hsbb` READY exact main SHA.
- Main Quality Gate run #38139683649 **FAILED**: build job's new size-budget-review guard compares v0.17.4 to old v0.16.6 first parent and incorrectly classifies *already accepted dev* caps as unreviewed increases. Vercel built product correctly, but **GitHub Release v0.17.4 not published** because canonical gate was red.
- Existing main PR preflight bootstrap failed only because old main had no trusted checker; future PR to newly updated main must succeed before making this a required check.

## This task and intended safe repair
- Branch `chatgpt/workflow-budget-release-recovery-592-20261011` from dev, stable Preview `fix/workflow-budget-release-recovery-592`, **version unchanged** per internal-workflow version rule.
- Build review first enforces normal previous-first-parent budget metadata rules. Only after that fails on a main exact-tree merge, a verified canonical-successful second-parent source may supply inherited budgets; no limits are raised or disabled. Scoped read-only GitHub token in CI build job.
- Trusted publisher supports one-step recoverable missed release when the immediately prior main merge was a proven versioned production PR with matching source tree, the corrective merge is same version, exact source tree and maintenance-only path allowlist, and the v0.17.4 tag is absent. Full new main canonical CI and live Vercel Production verification still required. Tag attaches to verified corrective current main SHA; original #608 supplies release notes.
- Pure unit regressions pin fail-closed behavior. Focused task CI → stable Preview full CI/Vercel → accepted dev → approved main. No production Appwrite changes in the repair.

## Next action
- Verify task focused, squash to stable Preview, full canonical plus Vercel READY, promote to dev with real preflight and exact-tree evidence, then to main with authorized production rollout workflow. Verify main canonical gate, trusted release publisher v0.17.4 URL/readback. Only mark #592 closed once genuine fresh-chat/offline, admin GitHub rulesets and five-promotion pilot are fulfilled or separately scoped with explicit approval.
