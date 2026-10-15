# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #526 + #682 — on-demand Scratch Function compatibility union, code only.

## Verified starting point
- Scratch active Function `message-action` deployment `6acd0a6643868c68508c`, built from audited #408/#708 source `chatgpt/408-708-scratch-compat-20261012@49b2a33006e8d728ba7b505526404209f9d53d36`. This preserves Diary, replies/reactions and #708 chat repair; its predecessor is retained for rollback. Do not overwrite it with the dev-based Notifications Feature Function.
- New Notifications integrated v0.26.0 stable Preview `feature/notifications-682-integrated-20261015@3388c03a93bc064c8c04d5dc52eca379fa49abe8`; focused and full canonical CI SUCCESS, Vercel READY. Frontend-based SHA lacks already-active Diary Function source and is not an activation candidate.
- #526 historical client probe source `refactor/scratch-compatibility-526@951baedd77cbb5176f462d74ff45c3e420fbbab4`, read-only proof #38666394991 SUCCESS: current dev passes, old Diary/Notifications Previews correctly block future unknown fields. Dev integration PR #872 prepared, not merged.

## Implementation under verification
- Started from exact previously activated #408/#708 union SHA `49b2a33006e8d728ba7b505526404209f9d53d36`, not the stale #682 Function.
- Backport only #682 server-owned receipt module, friendship/task-share idempotent result markers, notification projection/channels and new side-effect hooks into the verified active union. Preserve current chat idempotency, `repair_thread_all`, Diary reader/reaction handlers and exact handler authorization. Add #682 live contextual excerpts, with generic push text by default.
- No Appwrite Function/schema/config, Scratch or Production mutation. No frontend, release version or dev/main change in this backend-only task.

## Next action
- Run focused handler/unit verification on `chatgpt/526-682-scratch-function-union-20261015`, repair failures and prepare an isolated backend union Preview after green. Before any Scratch activation: confirm exact source & manifest drift against live Scratch, compare every active Preview consumer (not just schema read mapping), coordinate one writer with previous active deployment ID, obtain explicit activation approval, then test Diary/chat/notification multi-account ACL/idempotency/latency live. Keep #526 and #682 open for device acceptance and explicit promotions.
