# Session checkpoint

Updated: 2026-10-08
Current task: Alerts retention, truthful grouping, friend task navigation, and Notifications settings.
Branch: `chatgpt/alerts-retention-final` based on `feature/notifications-alerts`. Do not promote to dev without explicit user instruction.
Status: Implementation checkpoint for focused verification; stable Preview and backend rollout must follow repo workflow. Production Alerts Function remains the earlier accepted version until this feature passes CI.

## Implemented intent

- Read alerts hide 24h after first server-owned read, unread ones 7 days after server arrival. Hidden read receipts persist until seven-day GC to prevent event replays; completions >7 days old do not create new alerts.
- Account-local offline cache applies the same expiry predicate. Appwrite feed scans bounded pagination windows across expired or privacy-filtered rows.
- Hourly bounded maintenance removes seven-day-old receipts with the new created_at index from additive migration 005. Preserve tombstone GC and account-erasure maintenance.
- Live Alerts reads individual tasks after 1.5 seconds at 60% foreground visibility, or via explicit "Mark loaded read"; swipe previews and background/offscreen tasks never mark read.
- Activity groups are fixed local 30-minute completion-time windows with exact per-task clock times.
- Tapping a task loads the friend calendar and opens FriendDayViewSheet on its current scheduled date, highlighting it.
- Push controls move from Preferences to Settings → Notifications. Alerts header links there. Web Push remains disabled pending separate security/device acceptance.

## Required next steps

1. Focused tests, repair and diff review.
2. Squash into `feature/notifications-alerts`; full canonical gate and Vercel Preview.
3. Validate migration 005 on scratch, then production with explicit target; deploy and activate exact accepted Function SHA and verify scheduled cleanup.
4. Manual browser acceptance of scroll visibility, sheet/Back stack, day swipes, offline behavior, light/wide modes. Android/iOS device push remains pending VAPID security review.
