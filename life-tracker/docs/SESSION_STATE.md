# Session checkpoint
Updated: 2026-10-26 Asia/Manila
Current task: #1027 eliminate flaky disposable GoTrue recovery Storage dependency on `chatgpt/1027-gotrue-storage-reset-health-20261026`.

## Accepted baseline
- Isolated recovery `feature/1027-supabase-recovery-20261020@3b3157388ad8b0e049382e505eb83937567d1d6b`, v0.47.0. Main `bef14fb791a361e8c1f902a5c4adf4536e57aae7` and dev `497919bed4b6ce85b826f2d86fc767920344ec17` stay v0.43.8 Appwrite. No live backend or user-data changes.
- PR #1358 accepted isolated six-domain personal native RxDB runner (tasks/categories/Diary/portable Settings/Bucket goals/links), with one remote owner lease, preflight server guards and full six-group Sync Now. Task 11/11 lifecycle cases and focused Quality #40310096738 PASS; merged exact-SHA full Quality #40310251307 and synthetic/eight-/ten-table/ACL/data/media/links age labs PASS.
- Core App technical checks on merged SHA PASSED; protected hosted Preview deployment waiting separate reviewer approval, not authorized for automatic promotion.
- Appwrite Scratch still paused: 403 project_paused is NOT signed old-PWA mutation denial. Hosted Supabase mosaic-dev remains only 3 personal SQL tables with owner RLS; Settings and Bucket link SQL absent. Earlier operator real R2 seven-table age decrypt/restore + native >=30-day lock already PASS; no repeated manual commands.

## Current CI-only fix
- GoTrue real recovery #40310251297 attempt 1 failed at SECOND `supabase db reset --local` with timeout on disposable `127.0.0.1:54321/storage/v1/bucket`. That test's `supabase start --exclude` omitted Storage even though db reset contacts the Storage API. Retry of failed job attempt 2 requested; results must be checked independently.
- Remove only `storage` from the local test stack exclusions, so Supabase CLI can successfully check/read Storage while resetting the same disposable PostgreSQL/Auth source. Do not bypass/reset skip health, password/owner/security assertions, private archive authentication, or full fresh target restore. No hosted Supabase service, production, R2 or credential is touched.
- Focused syntax/checks and new exact-SHA signed full GoTrue Auth+restore workflow required before accepting fix; docs note the intentional disposable dependency.

## Next action
- Focused task commit/CI, repair, squash into isolated recovery; verify exact-SHA Quality, real GoTrue and independent encrypted restore labs. Protected Preview reviewer approval separately required.
- Continue authorized personal schema/Storage DR planning, trusted old-PWA backend fence, real original media/source and offline drafts, signed two-owner reversible migration, ZIP/offline/mobile acceptance before Production. Full hosted Settings/Bucket installation and Preview approval require explicit authorization; user wants ONE final full SHA-pinned pre-social Fedora acceptance, no piecemeal commands.
