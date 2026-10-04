# Session checkpoint

Updated: 2026-10-04
Current task: Fix the post-TodoMate sync status that stayed at 5/6 (83%) for more than 20 minutes on the recreated `test@test.com` account, and make sync progress identify the pending data group.
Status: Investigation proved the cloud import itself completed: recreated Auth ID `6ac273888ee3b2e94dfd` has 505 tasks, 13 categories, 37 owned task images, and the final task row reached Appwrite around 16 minutes before the reported stuck screenshot. The remaining 83% state is therefore client replication/freshness state, not ongoing TodoMate upload. Root cause found in the RxDB-first restart design: Mosaic intentionally preserves multiple owners in one physical local RxDB, but all six upstream handlers treated a foreign-account local row as a fatal owner mismatch. A new per-user replication identifier starts without an upstream checkpoint so it can preserve genuine unsynced current-user rows; that same first scan can legitimately encounter another account's cached rows. A foreign row—especially a message on an otherwise empty Messages group—can therefore poison the pilot retry queue and prevent `awaitInSync()` from settling.
Next action: Run focused verification for `chatgpt/sync-stall-diagnostics`. If green, squash into stable Preview `fix/sync-stall-diagnostics`, run its full canonical gate + exact-SHA Vercel Preview, then re-accept on the recreated `test@test.com` device by updating/reloading the Preview and confirming the status settles (or explicitly names the still-pending group) instead of remaining indefinitely at a generic 5/6. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: The browser's local RxDB is device-local and cannot be inspected from Appwrite, so the exact foreign row that triggered the user's current 5/6 state cannot be named retrospectively. The code path is deterministic and now has regression coverage across all six replication domains.

## Findings

- Live Appwrite data for the recreated account: 505 tasks, 13 categories, 0 diary rows, 0 settings rows, 0 friendships, 0 messages, 1 profile, 37 owned files.
- Task creation ran from roughly 15:42:52Z through 15:46:32Z; the screenshot/report arrived at 16:03:11Z. Server upload was already complete.
- A 505-task push took about 220 seconds in live acceptance. The old restore convergence budget was ~190 seconds for this row count, so healthy large imports could enter the pending-background state too early.
- The newer RxDB-first coordinator intentionally removed the old pre-bootstrap push checkpoint. Restoring that checkpoint would be unsafe because it could skip genuine first-use/offline current-user rows. The correct boundary is inside each pilot: ignore local rows whose `userId` is not the active replication owner, while retaining fail-closed remote/master owner checks.
- Progress previously exposed only a count. It now tracks human-readable pending groups: Categories, Diary, Preferences, Friends, Tasks, Messages.

## Changes under verification

- Task/category/diary/settings pilots: foreign-owner local rows are acknowledged as out-of-scope before any Appwrite read/write or image side effect.
- Friendship/message validation-only upstreams: foreign-owner local rows are likewise ignored; active-owner physical deletion rules and remote/master owner collision checks remain unchanged.
- `refreshSync()` now reports labels such as `Waiting for Messages · 5 of 6 synced`, stores the pending group names in `SyncProgress`, and carries those names into the bounded background-sync timeout notice.
- Large restore/import convergence budget is now 500ms per restored row with the existing 90s minimum and 5-minute maximum. A 500+ row stress fixture must receive the full 300s cap.
- Pilot regressions cover foreign cached rows across all six domains. Sync tests cover a deliberately slow group and a named timeout; Sync Status UI coverage matches the reported 83%/Messages shape.

## Acceptance path

1. Focused Quality Gate on the final task checkpoint.
2. Squash focused-green task into `fix/sync-stall-diagnostics`.
3. Full stable-Preview canonical Quality Gate and exact-SHA Vercel Preview.
4. On the recreated `test@test.com` device, update/reload the Preview/PWA and confirm the six-group freshness pass reaches Up to date. If one group legitimately remains, the sheet must name it and exit the active spinner at the bounded timeout rather than displaying an indefinite generic 5/6.
5. No backend Function/schema rollout is expected; this task is browser sync/UI only.
