# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #708 manual Chat Sync and global Diary Sync failure on user-accepted v0.24.2 Preview; v0.24.3 isolated follow-up.

## Evidence / boundaries
- User confirmed two-account v0.24.2 chat histories/new sending work on Scratch Preview `fix/chat-reliability-708-integration-20261014@291fab379cba067af27c11628c7e8516d324f748`, but both chat Sync attempts failed after ~20s and global Sync Now said `Reconciliation failed: diary`.
- Shared Scratch `life_tracker.diary` exposes additive `emoji` and `photos` fields; v0.24.2 local strict `diarySchema` lacks both and importer spreads them into local documents. Full `syncNow` calls `reconcileLocalReplica` for all eight collections and rejects on Diary. Chat `reconcileChat` awaits `syncNow` after server repair, so its generic failure can be unrelated to messages.
- Shared Scratch active `message-action` remains `6acd0a6643868c68508c`, read-only inspected. No Scratch schema, Function, row, Production, `dev` or `main` changes authorized by this repair. PR #848 must remain unmerged pending new user reacceptance.

## Scope
- Server→local importer allowlists known fields for each collection, preserving existing drift warnings and server-only values. New regression tests cover real Diary columns and a future unknown field; all normal schema properties remain intact.
- Chat Sync changes only its final local freshness gate to awaited message-pilot catch-up, independent of unrelated Diary errors; server-authorized bounded `repair_thread_all` and pending outgoing checks unchanged. Add progress callbacks and a small shared BottomSheet opened from Chat Sync (also during an ongoing sync) with real phases/errors, never a fabricated percentage.
- Patch app/package/lock version 0.24.3. Quiet task `chatgpt/708-sync-diary-20261015` branches from accepted stable Preview SHA. No unrelated UI changes or backend modification.

## Next action
- Require focused CI success on final task commit; squash task into existing stable Preview, require exact stable full canonical CI and Vercel READY; re-test global Sync, Chat Sync and two-account message/Diary continuity. Only then consider updated PR #848 merge into `dev` with new approval/accepted Preview. #526 owns broader single-writer shared-Scratch compatibility safeguards.
