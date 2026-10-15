# #682 notifications detailed push follow-up

Current task: #682 opted-in social push content.

Updated 2026-10-15. Current Notifications Preview v0.26.0 stable feature/notifications-682-integrated-20261015@3388c03a93bc064c8c04d5dc52eca379fa49abe8, canonical green and Vercel READY.

## User report / correction
Task completions can show optional detailed OS push, while messages, replies, reactions and shares remain generic. This is because emitActivity has no matching opt-in detail payload; in-app Alert feed details are separately fetched only online, and transient swipe Previews intentionally render redacted cache data.

## Approved implementation scope
- New synced account-level explicit setting alertsSocialPushDetails, default false, available in Settings > Notifications. To expose private social text in OS push, the account-level opt-in and the **existing per-device** include_task_details opt-in must both be enabled.
- Keep generic social push otherwise and no surprise disclosure for users who already opted into task titles. Social content is still authorized by the live Function, bounded and never persisted in push receipts/cache.
- New PATCH version 0.26.1 on task chatgpt/682-social-push-frontend-20261015. Backend implementation on chatgpt/682-social-push-backend-20261015 based on active Diary+Chat+Notifications union; do not overwrite active Scratch with stale frontend Function.
- No schema changes, Production access, dev/main changes; source changes need focused/full CI, stable Preview READY, explicit coordinated Scratch Function activation, two-account/device acceptance with notification permission enabled and latencies, and user approval for dev later. Keep #682 open.

## Next action
Run focused CI on task, then canonical stable Preview CI. Do not deploy/activate Scratch changes before compatible backend verification; test two real accounts and opted-in devices. No dev/main/Production promotion.
