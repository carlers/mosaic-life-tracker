# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 Calendar cold-start and task-update structural performance; #858 OPEN.

## State and approval
- Owner explicitly authorized v0.29.11 stable Preview→dev, completed via [PR #960](https://github.com/carlers/mosaic-life-tracker/pull/960): `dev@6ad5d271a4717e10ddd8be9ff74b846236407425`, version 0.29.11. Exact accepted tree, [dev promotion CI #39124311386](https://github.com/carlers/mosaic-life-tracker/actions/runs/39124311386) SUCCESS, Vercel dev READY. #957 user-accepted Todo/Diary month-grid bug closed. Main/Production and 1.0 unchanged. No authorization for another dev/main promotion. New product Preview requires independent CI and user acceptance.

## Evidence
- Nondeploying `chatgpt/858-calendar-reconcile-layout-lab-20261018@352e804372e3afa568ae322f53c967a97e356f36`: [focused #39125774450](https://github.com/carlers/mosaic-life-tracker/actions/runs/39125774450) SUCCESS; [lab #39125774481](https://github.com/carlers/mosaic-life-tracker/actions/runs/39125774481) SUCCESS. Four interleaved variants × five distributions × n=3 synthetic one-task edits. For 1000 tasks distributed across October, normal fresh grouping/react reconciliation vs reused unchanged-day arrays: React render p50 **377.8→50.0ms**, DOM first commit **422.1→67.9ms**. Same-day 1000 tasks **340.3→333.7ms** (little benefit); snapshot recreating every task object loses benefit (**382.9ms**). For task edits, React work dominant; forced layout read proxy just ~1–2ms (not full Chrome style/layout trace). startTransition scheduling alone was slower for total completion in synthetic dense cases. Initial mount still separate.
- Real local Dexie RxDB `patch()` probe: changed task returns a new RxDocument reference; old returned doc remains old title; emitted query sees patched title. Need further unchanged-task identity probe before any product optimization.

## Follow-on diagnostic (no deploy)
- Isolated branch `chatgpt/858-calendar-daycell-memo-lab-20261018` forks preceding nondeploying lab. Diagnostic URL-gated DayCell React.memo custom comparator skips unchanged per-day task sequences, comparing all other props conservatively; contrasts against default React.memo with exact same full task regroup. Test 25/250/1000 dense, 1000/month, 1000/years; unchanged-document vs deliberately recreated task snapshots; 4 same-runner paired repeats × 2 methods × 2 snapshot strategies = 80. Counts, edited title, layout and React/DOM/paint proxies asserted. Further real RxDB probe adds a second unmodified task and asserts it preserves reference across patch of the first task. All fixtures local-only and non-shipping; comparator URL experiment must NEVER enter product.
- Do not change auth, query/schema, network/sync, Calendar appearance/layout, or existing Preview. Not yet proved safe for every mutation/visibility situation or useful for initial startup.

## Next action
- Commit lab fixture, browser test, lab workflow and checkpoint, run exact-head focused and no-deploy Playwright CI; investigate/retest all failures. If positive, create a new CLEAN task branch from `dev` with only a conservative DayCell comparator, regression tests (edit, move, delete, color, shared, holidays, new account), version 0.29.12, and canonical Scratch Preview after focused green. Do not merge to dev until owner accepts and approves.
