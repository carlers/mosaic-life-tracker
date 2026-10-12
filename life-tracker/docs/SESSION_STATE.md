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
- Review task source and add/adjust tests for geometry and focus/history; run focused verification (task commit [verify:focused]).
- After focused green: squash task into stable feature/split-day-panel-404-20261012, run exact-SHA canonical acceptance and Scratch Vercel READY, validate modal/panel transitions on real desktop/tablet and physical Android/iOS.
- Home search-focused Day View remains modal pending explicit panel integration validation; no backend/Appwrite changes planned.
- Never merge to dev or main without the user's separate approval.
- Previous #656 sheet-optimization details remain on its own issue/PR checkpoints; preserve those fixes and startup-size budgets.
