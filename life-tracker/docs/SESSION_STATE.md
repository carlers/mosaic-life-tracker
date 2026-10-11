# Session checkpoint

Updated: 2026-10-11
Current task: Mosaic #592 — isolated C0 PR-time promotion preflight candidate.

## Verified baseline
- User manually accepted Batch A. Batch B/C accepted stable `feature/workflow-bc-592` at `0ee0d8110eb59eecdc167d07e4af7c87233523da`, exact canonical run 38129571397 SUCCESS, Vercel `dpl_4y2MD1Dmug6UZ12ymDFSywzZGdj7` READY with Scratch/GIPHY and seven budgets PASS.
- `dev=f65d348c2f537b4d8c1063096e6856a9ee3d629f`, `main=614cd1dccbd01bf70493874496559720b320151a`. Do not promote without a separate instruction.
- B0 fresh-chat ambiguous/no-GitHub cases remain unproven; `SESSION_STATE.md` edit rule stays. C1 remains owned by #526/#557 with no backend write. GitHub dev/main branch-protection reads return 403; both branches report unprotected.

## Current change
- Task `chatgpt/workflow-pr-premerge-592` starts from accepted B/C Preview. Adds a cheap, read-only GitHub PR-time candidate check with trusted base code, fail-closed SHA/tree/canonical/version regression evidence and unit scenarios, plus delivery guidance. Does not add required status checks or change dev/main, Production, Vercel or Appwrite. App version NONE.

## Next action
- Verify focused task CI for exact SHA, resolve any failures; squash task to `feature/workflow-bc-592`, then verify fresh exact-Preview canonical + Vercel READY. Keep C0 required-rule rollout blocked until real target PR checks and admin approval; B0 independent new-chat testing still required. Do not promote to dev/main.
