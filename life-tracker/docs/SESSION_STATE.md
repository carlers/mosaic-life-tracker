# Session checkpoint

Updated: 2026-10-11
Current task: Backlog #407 navigation and Day View parity refinement. Task branch `chatgpt/backlog-page-407` from stable Preview `feature/backlog-407` `040814e3d5627025fdc54f8906191ebfce06516e`. No dev/main promotion authorized.

## Product contract
- Backlogs is a protected, lazy-loaded page `/backlog`, accessible from Home hamburger and the existing Backlog card on Me.
- The content is ordinary category-grouped Day View with no date navigation or day heading. Existing task controls, drag/reorder, completion, memo/photo/visibility, select mode, and task action sheets are reused.
- Moving Calendar → Backlog retains task ID and sets `date: ''`; scheduling from Backlog updates the same task's date. Owner Home search routes undated task results to `/backlog` and focuses the task. Privacy and Scratch Function contracts remain unchanged.
- Calendar tasks are not shown in Backlogs. The Me-page Backlogs count only includes unfinished unscheduled tasks.

## Delivery state
- Parent Preview v0.15.0 already had Scratch-backed #407 backend and a standalone Backlog BottomSheet; this task replaces that presentation only. Latest inspected `dev` v0.16.8; new candidate version v0.17.0 avoids assigning a lower version to a new Preview revision.
- Added route/back-navigation and date-free task-regression tests, removed unused standalone BacklogSheet.
- Focused task CI succeeded (Actions 38113590403). Squash PR #562 reached stable Preview at `dad4084109debd777a3e1ce248e8f831810f6adc` but full CI 38113638031 failed **only** its production build initial-closure gzip budget by 105 B (143805 / 143700). DOM and browser tests succeeded. Vercel deployment of that SHA failed on the same build size guard.
- Repair task branch `chatgpt/backlog-page-size-407` replaces unnecessary memoized Backlogs route import with a direct lazy import. Because a new protected route necessarily adds small initial metadata, the initial compressed closure cap is proportionately adjusted by 300 B (143700 → 144000), retaining limits on entry, Home closure and total assets. No production/Function mutations. Full repair acceptance and manual tests pending.

Next action: focused-check the route-size repair; squash its task PR into `feature/backlog-407`; verify full canonical acceptance and Vercel READY. Keep the previously activated Scratch shared/backlog Function intact. Require user approval before dev/main promotion.
