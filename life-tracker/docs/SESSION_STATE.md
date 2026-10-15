# #682 / #526 Scratch Function social push detail refinement

Current task: #682 opted-in social push content.

Updated: 2026-10-15. Current approved report: task completions show details but social notifications remain generic. Live Scratch v0.26.0 union active Function deployment 6ad0368a1abc7259e499, source SHA 36eb4ea421fcdff6f05d9c79e4b77f329bf93983.

## Root cause and scope
- The new in-app feed can project live contextual text, but OS push from emitActivity deliberately uses generic payload and the existing include_task_details consent only applies to task completions.
- Do not silently expose message text on existing devices with task-title consent. Add separate account-synced 'alertsSocialPushDetails' setting, default false, require the already explicit per-device include_task_details boolean too. Enforce both server-side before sensitive push body construction.
- Preserve generic defaults, private/unsent/revoked authorization gating, deterministic receipt/push-on-first creation, disabled push categories, current Diary/chat repair Function handlers and Scratch schema.
- No new schema columns or Function structural/event/secret changes. Exact integrated union code branch chatgpt/682-social-push-backend-20261015, version impact NONE; frontend is a separate v0.26.1 Preview.
- Never activate stale single-feature Function from frontend PR. Before Scratch rollout compare active deployment 6ad0368a1abc7259e499, verify full canonical and exact Function source, create inactive exact-SHA deployment then activate only under coordinated authorization. No Production or dev/main promotion.
- Verify two-account message/reply/react/share detail pushes only when both account and device opt-ins are true; default and other devices stay generic. Simulate revoked friendship/deleted target and ensure no disclosure, no duplicates, no messaging performance regression.

## Next action
Run focused CI on task, then canonical stable Preview CI. Do not deploy/activate Scratch changes before compatible backend verification; test two real accounts and opted-in devices. No dev/main/Production promotion.
