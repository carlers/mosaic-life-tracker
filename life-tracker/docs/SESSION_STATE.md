# Session checkpoint

Updated: 2026-10-11
Current task: Backlogs bulk selection + consistent full-page swipe back (issue #407).

## Verified starting point
- Source `dev@2b609a2c032401b9253cd2b67b51fb44a45ababc`, version 0.17.3; main stays at 0.16.6. Workflow #592 is already merged to dev, canonical acceptance and Vercel READY.
- Backlogs owns unscheduled tasks through existing `date: ''`; moving an existing selected task must update the same task identity, preserving all other fields and keeping failed IDs selected.
- Protected detail-page swipe used `edge-back` by default even though Settings already uses `full`. Chat/friend-calendar gesture owners must retain edge-only activation.

## Change / delivery
- Preview version 0.17.4: add `Move to Backlog` to the shared multi-task action sheet only for dated tasks. Reuse existing `runBulkUpdate({ date: '' })` and all-settled failure handling; no schema/Function changes.
- Make the protected detail-route swipe default `full`, with explicit `edge-back` exceptions for chat and friend calendar. Backlogs retains its existing Home/Me parent-route resolution, animation, and preview.
- Regression coverage: multi-task selected updates, partial failure retry/retention, action hidden on Backlogs, route defaults and nested-gesture exceptions.
- Branch `chatgpt/backlog-bulk-swipe-407-20261011`, target stable Preview `feature/backlog-bulk-swipe-407`. No dev/main promotion approved.

## Next action
- Run focused task CI, repair failures, squash into stable Preview. Require exact-SHA canonical CI and Vercel READY before user acceptance. Explicit device/trackpad gestures and authenticated Scratch Backlogs behavior remain manual checks. No Appwrite or Production writes.
