# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1186 category deletion must preserve tasks in Calendar, Day View and Todo; related #1027 Supabase beta and #1187 fast sync.

## Baseline and safety
- Task branch `chatgpt/1186-category-delete-preserve-tasks` starts from isolated `feature/1027-supabase-recovery-20261020@958f14981c52d7d5396b18ada0f3f2f97ad0e054`. Source v0.32.4, proposed next beta PATCH v0.32.5. Dev is already on a distinct v0.39.0 release line: do not merge this old beta tree directly into dev/main.
- Prior Quality Gate #39580972604 and signed local Supabase Core App Lab #39580972588 succeeded on the base commit; task-specific changes remain unverified until focused and stable canonical CI.
- Owner confirmed real invited Gmail signup/confirmation/sign-in, uninvited 403, two-device core CRUD/reorder/completion and offline/reconnect scenarios, Android PWA; one task was intentionally checked then unchecked. iPhone Safari, app-update refresh and independent DR/restore still pending.
- `mosaic-dev` isolated Supabase Free invite hook active; 2 private invitations recorded, no public alias. Protected immutable v0.32.4 Preview `dpl_8wEHnC6mxEnie9wrrg9TWkHDjSvg` READY; not this task branch. Do not expose bearer share links in GitHub.
- Production/Appwrite, dev/main and existing users remain untouched; no direct provider cutover or release authorization. Do not incur paid costs.

## Current implementation scope
- #1186 reproduces in both Appwrite and Supabase: category tombstoned while live tasks retain its ID, Day View hides them and Calendar still draws TaskBlocks. Category Manager incorrectly promises to move tasks.
- Implement transfer to first remaining owner category before tombstoning, with owner checks, checked partial failure/retry and refusal when it would strand last-category tasks. Update confirmation to name actual destination; behavior-first DOM hook regressions. Preserve prior orphaned task records for a future explicit recovery path; do not silently purge user content.
- #1187 investigates scoped Supabase Realtime wake-only resync. Existing candidate RxDB pilot intentionally has no realtime event subscription; never add unbounded polling or a client-authorized payload channel as an expedient fix.

## Next action
- Focused verify category mutation/UI tests, lint/build/version contracts and repair failures.
- Squash accepted #1186 task PR into isolated stable #1027 Preview only; require same-SHA canonical Quality Gate + Supabase lab and exact artifact deployment acceptance before owner tests. Preserve shared production path for later deliberate forward-port from current dev baseline, with its distinct version line.
- Run direct deployed Preview/browser verification, security/invite revocation and restore drills; establish safe stable tester URL and Free quotas before limited beta invitation. Keep #1027, #1186, #1187 open until independently accepted; Diary #1029 immediately after core beta.
