# Session checkpoint

Updated: 2026-10-11
Current task: #592 — dev-based B/C integrated Preview candidate, no promotion approval.

## Baseline
- Existing accepted, untouched workflow Preview `feature/workflow-bc-592@10e9bf6e5b91a5d2fd6a17344b7f60fee35e6608` passed canonical CI 38133484783 and Vercel READY `dpl_3oYGq3eiR6mG8dfdNvRCoREfPZcq`. Batch A was manually accepted.
- `dev@7898573e3eb5fba1c090cc1a35df0b543e671e46` independently shipped TaskBlock hard clip at app v0.17.3. `main@614cd1dccbd01bf70493874496559720b320151a`. This task leaves both unchanged.
- #406 shared tasks is already closed and shipped to main; topic-only B0 lookup should recover that *latest* state, not its historical feature-Preview steps. True independent new-chat and unavailable-connector behavior still need separate acceptance; existing global checkpoint policy remains.
- C0 live target-PR/premerge and GitHub admin permissions not yet verified; C1 Scratch lane owned by #526/#557 with no Appwrite mutation.

## Current change
- Branch `chatgpt/workflow-dev-integration-592` from current `dev`: copy exact B/C workflow/source/test/build/docs changes from accepted Preview onto `dev`, retaining dev's TaskBlock, lockfile and app version 0.17.3. Combine package.json solely by carrying B/C preflight script with v0.17.3. App version impact NONE, no backend activation.
- Merge via squash to separate stable `feature/workflow-bc-dev-integration-592`, which starts at the exact dev SHA. This preserves the original stable Preview and yields an integration tree eligible for future dev preflight if unchanged.

## Next action
- Focused task CI, squash integration PR to new stable Preview, canonical full CI and Vercel READY. Inspect exact size and build-feature scopes. Do not merge to dev/main or change provider/admin settings without explicit authorization.
