# Session checkpoint

Updated: 2026-10-12
Current task: #404 — optional large-screen Home Calendar Day View panel.
Source baseline: dev@dbde9515ecb611082f191d39e5ef71cfcecde3bc (v0.20.5).
Task branch: chatgpt/404-split-day-panel-20261012.
Provisional Preview version: v0.21.0 (new user-visible feature; verify against other live Preview branches before publication).

## Scope
- Preserve current bottom sheets by default. Preferences adds account-synced optional side-panel mode for sufficiently wide Home frames.
- Owner/friend Home Calendar Day View uses a non-modal right-side panel reusing the existing Day View renderer. Nested modal task/reaction/photo sheets remain shared BottomSheets.
- Panel should not mount when closed, and selection of another day keeps the same inspector.
- Browser Back closes nested modal first, then panel. Narrow view uses existing bottom sheet on new open. Resizing an *already-open* panel keeps that instance over the calendar to avoid discarding edits.

## Implementation checklist / handoff
Next action: run focused checks for the opt-in panel lazy-shell/budget repair, then squash into stable Preview and verify canonical CI + exact Scratch/GIPHY Vercel READY. Do not merge dev/main.
- Add/adjust geometry and focus/history browser coverage before release.
- After focused green: squash task into stable feature/split-day-panel-404-20261012, run exact-SHA canonical acceptance and Scratch Vercel READY, validate modal/panel transitions on real desktop/tablet and physical Android/iOS.
- Home search-focused Day View remains modal pending explicit panel integration validation; no backend/Appwrite changes planned.
- Never merge to dev or main without the user's separate approval.
- Previous #656 sheet-optimization details remain on its own issue/PR checkpoints; preserve those fixes and startup-size budgets.

## Stable Preview repair evidence
- #404 task focused: 2b0f76d (green); Preview PR #693 squash: 108eb548 (full CI + hosted GIPHY Vercel failed).
- CI lint issue: synchronous inactive-pane state update inside an effect; repair uses scheduled lifecycle cleanup.
- Hosted Preview size excess: initial/entry caps pass; Home closure +744B, aggregate raw +4230B, gzip +1022B, precache +4037B. Defer optional panel module from Home closure and review three aggregate asset ceilings only, with metric-specific evidence in config. No weakening of startup or Home ceilings.

## 2026-10-12 stable Preview follow-up
- Stable source Preview SHA 26f60104: all checks/DOM/browser passed, but canonical build/Vercel failed by 10B initial closure and 256B Home closure; aggregate revised asset limits passed.
- New repair task chatgpt/404-panel-closure-repair-20261012: move the modal/owner/friend panel detail JSX into the already lazy DayDetailPanel chunk, reducing Home static closure. Keep existing Home/initial/startup ceilings unchanged. Revalidate size and functional behavior before accepting Preview.
- Do not merge to dev/main or start #692 before Preview acceptance; preserve focused verification and version v0.21.0.
