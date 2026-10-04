# Session checkpoint

Updated: 2026-10-04
Current task: Finish the post-TodoMate 5/6 sync-stall investigation after the new pending-group diagnostics isolated the remaining stall to Diary.
Status: The shared-RxDB isolation/UI hardening is accepted on stable Preview `fix/sync-stall-diagnostics` at `b09a83b`. Focused run `37216642188` passed; the first stable full run `37216714956` found one stale unit-label assertion only; focused repair run `37216851563` passed; final stable canonical run `37217097075` passed checks/build/dependency audit/both DOM shards/both browser-contract shards/canonical acceptance; exact-SHA Vercel deployment `dpl_HEG4GeYNQPgmkpBnW8TX21QBTAyY` is READY and served HTTP 200. Re-testing the recreated `test@test.com` account then showed `Waiting for Diary · 5 of 6 synced`.
Next action: Focused-verify `chatgpt/diary-created-at-schema-fix`. If green, squash it into `fix/sync-stall-diagnostics`, rerun the full canonical gate + exact-SHA Preview, then apply the idempotent `diary.created_at` production migration. After the live column is available, trigger/retry sync on the same device and verify the account's one imported diary row appears in Appwrite and Sync Status reaches Up to date. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None known. The live schema mismatch has been directly confirmed through Appwrite.

## Confirmed root cause

- TodoMate live preview/accepted mapping contains 505 tasks, 13 categories, and 1 diary entry.
- Recreated Mosaic account Auth ID `6ac273888ee3b2e94dfd` has 505 tasks and 13 categories remotely but still has 0 diary rows.
- The Diary replication payload in `syncMapping.ts` sends `created_at` and `updated_at`.
- Production Appwrite table `life_tracker/diary` currently has exactly six columns: `date`, `content`, `visibility`, `user_id`, `updated_at`, `deleted`. `created_at` is absent.
- The checked-in backend manifest had the same omission, proving this is repository schema drift rather than a console-only accident.
- Therefore the imported Diary row is durable locally but every remote create/update carrying `created_at` is rejected; RxDB keeps the Diary pilot dirty while the other five groups settle. The new named-group UI exposed the fault correctly.

## Changes under focused verification

- Portable backend manifest adds optional/default-empty `diary.created_at` as varchar(50). It is optional only for safe migration of existing deployments; new client writes continue to send the real created timestamp.
- New `npm run mosaic:migrate-diary-created-at` migration creates the missing column idempotently, waits for availability, and fails closed if an existing column has an incompatible type/size/required/default state.
- Legacy Diary pulls without `created_at` map local `createdAt` from stable Appwrite `$createdAt` metadata (then stable update metadata), rather than generating `new Date()` on each pull.
- Manifest, migration, sync-mapping, and Diary replication tests pin the contract and payload.

## Acceptance path

1. Focused Quality Gate on the final task checkpoint.
2. Squash focused-green task into `fix/sync-stall-diagnostics`.
3. Full stable-Preview canonical Quality Gate and exact-SHA Vercel Preview.
4. Apply the production Diary `created_at` migration only after the accepted tree is green; re-read the live column and confirm it is available/compatible.
5. On the existing recreated `test@test.com` device, hit Sync Now (or let live replication retry) and verify one Diary row reaches Appwrite with stable `created_at`/`updated_at`.
6. Confirm Sync Status reaches Up to date and no backend Function redeploy is needed.
7. Do not promote to `dev` or `main` without explicit user instruction.
