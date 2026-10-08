# Session checkpoint

Updated: 2026-10-08
Current task: Mobile friend-completion notification content, tap-to-task routing, and Alerts bottom-sheet dismissal.
Task branch: `chatgpt/notifications-mobile-deeplink` from current `feature/notifications-alerts` (20b8cc2). Never promote to dev/main without user instruction.

## Implemented for verification

- Web Push notification clicks open generic Alerts when the SW account marker is absent/mismatched, safely navigate or open/focus the installed app, and carry an account-bound exact receipt ID only when safe. Notification tags are per-receipt rather than per-friend.
- `get_notification` returns only one live-authorized receipt, independent of feed pagination. Alerts handles the query, opens Friend Day View directly and removes the one-time query on success. AuthPage preserves only a validated Alerts deep link across sign-in.
- Device-local `include_task_details` opt-in stored on the server subscription; generic by default. The delivery handler fetches current task visibility/completion and uses recipient-facing friend metadata. Subscription registration preserves preference and removes former-account endpoint ownership.
- Alerts retains the Friend Day sheet while `isOpen=false` animates; BottomSheet owns a reusable `onExitComplete` contract.
- Added regression coverage for notification lookup, detail preference, click navigation, sign-in handoff, sheet lifecycle, and schema migration. New ordered migration `006-push-details`.

## Verification and remaining steps

1. Run focused verification and repair any failures. Squash task work to the existing stable `feature/notifications-alerts` Preview only after focused green; await canonical acceptance and Vercel READY.
2. Run schema migration 006 and deploy/activate the matching `message-action` Function **only on the explicitly confirmed scratch Appwrite project**, then test with disposable accounts. Production Function and schema changes require separate user approval.
3. Manual Samsung installed-PWA cold/background/foreground tap, task focus, lock-screen opt-in/off, and actual drag-down exit acceptance remain required. No manual device validation has been claimed.

Prior branch `chatgpt/alerts-live-sheet-mobile-push` has diverged from stable Preview; do not merge its history blindly. Its implementation already entered feature Preview separately.
