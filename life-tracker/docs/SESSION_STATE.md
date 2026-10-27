# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1027 unblock unchanged disposal-only Supabase labs from anonymous GHCR image-pull 429.

## Accepted and verified
- Stable isolated source `feature/1027-supabase-recovery-20261020@7687138398941ba8d537ac501577030dab9ae242`. PR #1397 added NEW Supabase-only empty portableSettings RxDB store, distinct from legacy social/avatar `settings`; no original Appwrite data copied and no six-domain production writers activated. Focused Quality #40525814743 and full canonical Quality #40526049828 SUCCESS, including browser shards.
- Previous protected immutable Supabase Preview remains `https://mosaic-life-tracker-peuppzcdz-carls-projects-72516fde.vercel.app` at `79e83581...`, Vercel READY. Owner manually passed sign-in, tasks, categories, Diary, Sync Now. This newest source is NOT deployed; dev/main/Production unchanged.
- Live hosted six-domain signed RLS/CAS probe `951e8da7665d2cac71a42dfb` PASSED, with 2 retired users and zero live rows. No reason to rerun the hosted ownership test or historical Fedora/R2 restore.

## Active CI unblock and next gate
- Four independent disposable database labs at exact `7687138` failed before tests could run: ten-table restore #40526049611, real GoTrue restore #40526049727 (attempt 2), eight-table Settings restore #40526049805 (attempt 2), Core App Lab #40526049967. Logs show GHCR anonymous `ghcr.io/supabase/postgres:17.6.1.095` `toomanyrequests`, NOT assertion/database failures. Other five cryptographic/synthetic labs passed. No security gate is green without executing.
- New source-only CI patch authenticates GHCR pulls via the standard short-lived `GITHUB_TOKEN`, with top-level `packages: read` and existing `contents: read` and no PAT/secret logging. Scope limited to the four affected workflows plus unit contract. All migrations, restore, signed JWT, RLS, Auth and browser tests remain unchanged and mandatory.
- After focused CI, squash into isolated stable recovery branch; require canonical and actual 4 disposable jobs to pass. If GHCR continues denying, record real infrastructure blocker without weakening tests. No protected Preview bypass or dev/main/Production cutover. Then resume fresh-owner guarded six-domain Settings/Bucket List app integration, offline/ZIP/photo/device acceptance, and original Appwrite escrow/old PWA server fencing.

## Historical checkpoint (2026-10-23 onward)
## Accepted
- Recovery feature/1027-supabase-recovery-20261020@a493f555da2ab6b8c915d98c175ab842f93a7570; exact full Quality #40341254320, signed local two-owner GoTrue and 8/10 table original age/media labs PASS. Non-shipped six-domain Sync Now false 100% fix accepted.
- User-approved hosted mosaic-dev additive Settings/Bucket/task links installed with owner RLS, triggers, signed CAS, two foreign keys. Existing user rows and Appwrite Production data unchanged, no original history imported or six-domain app activated.
- Post-install real TEN-table encrypted PostgreSQL/Auth + entire private Storage R2 generation 20261026T153242858Z: protected main backup #40350285859 SUCCESS; immutable COMMITTED marker in GitHub job. User independently completed exact pinned Fedora restored original database/media age archives, exact PG17 source/target bytes, original-password owner login, exclusive authority, cross-owner denial, private Storage+synthetic photo; stages 01-07 PASS and final MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS. No new backup or Fedora step necessary.
- Protected backup workflow-only user-approved Preview→dev→main PR #1370 accepted, main@dd9cc77f49e83dbd9252daa311fd11de4a86a1bb and dev@ff350076204742ff020a7ad962ba402210d8ea62; main Quality #40346349166 and production Vercel redeploy READY; unchanged app v0.43.8/Appwrite provider. No Supabase provider Production cutover.
- Earlier anon and null-owner hosted SQL negatives passed but are NOT real signed HTTP two-owner proof; connected provider lacks access to credential pairs for two preexisting disposable test accounts. Do not impersonate real users, create hosted accounts, or claim hosted signed test pass.

## Next action
- Focused Quality, squash isolated source, full canonical and relevant labs, one private signed hosted probe.
- All Production cutover, Appwrite fencing, media/outbox, device/offline/ZIP and Auth gates remain separate.
