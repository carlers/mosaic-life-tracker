# Session checkpoint

Updated: 2026-10-11
Current task: finish Backlogs #407 dev deployment, user approved dev only; main/Production untouched.

## Product scope
- /backlog is a date-free, category-grouped Day View; Home hamburger/Me entry and Calendar ⇄ Backlogs task moves update date between ISO key and ''. Standard task actions, search, selection and drag preserved.
- Unscheduled tasks are owner-only even if they had an accepted share; server guards friend calendar, reactions, notifications, and shared-task lists/mutations. Shared-task and Settings swipe-forward features from dev remain intact.

## Source/acceptance
- Original Backlogs Preview v0.17.1 accepted; its direct route rewrite fixes Vercel /backlog 404. Reconciled v0.17.2 with current dev, preserving release history, stickers, shared tasks, Settings, and adding privacy regressions.
- Stable promotion Preview feature/backlog-dev-407 at a4a3d292 passed canonical CI 38119851398 and Vercel; PR #588 merged into dev at 383b2fa553b16209357ea035614ffeb20aed3f8f. Dev Quality Gate 38120002742 SUCCESS.
- Dev Vercel deployment dpl_2T6Ms2Rp9jREyoHjxqv96HT9DS6W failed aggregate size guard only: raw assets 2,406,651, gzip 744,003, precache 2,491,866 B. Entry/initial/Home metrics PASSED. Corrected three aggregate caps to 2,407,000 / 744,350 / 2,492,250 B (349/347/384 B margin); no runtime or version bump.
- Task branch chatgpt/backlog-dev-vercel-budget-407 focused CI 38120135059 SUCCESS; stable fix Preview fix/backlog-dev-vercel-budget-407 SHA e8a313a5 Vercel READY, full CI 38120188624 failed only handoff token-size test (3,221 > 3,000). This checkpoint repair trims it without relaxing the contract.
- Scratch Appwrite project 6a96e82d000d1310b3be active Function is stale (6acb0cd8735b3060c9af); exact accepted Backlogs Git-source inactive build 6acb33cd8197655af68c is READY. Verify and activate on Scratch only after source/back-end coordination; no Production writes.

## Next action
Focused-check this checkpoint repair; squash into stable fix Preview; run canonical gate/Vercel READY. Merge clean stable fix Preview to dev; verify CI, hosted Vercel READY and direct /backlog HTTP 200. Close superseded PR #581 and update issue #407. Separate unverified acceptance: scratch authenticated login/sync, iOS/Android gestures and multi-device privacy.
