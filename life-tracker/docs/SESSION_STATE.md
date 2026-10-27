# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1027 fail-closed empty TodoMate Replace for Appwrite and isolated Supabase.

## Active #1027 gate
- Stable isolated recovery source `feature/1027-supabase-recovery-20261020@841bdbd21e5352ba7b0743b7d246d2ca5a8ba548`; canonical Quality #40465970280, Core App Lab core-app #40465970213, eight restore/crypto labs PASS. Preview deploy remains protected/waiting; dev/main/Production unchanged.
- **Hosted signed security gate PASSED** at `mosaic-dev`, run `951e8da7665d2cac71a42dfb`: two verified Auth owners, six live CAS winners, six stale conflicts, 12 exact foreign-ID denials, 12 signed fixtures, 53 direct write denials and five writer guard denials. Independent SQL: 2 frozen/banned accounts, 12 tombstones, zero live rows across six owner tables. No reason to repeat this signed security drill.
- New isolated source task closes a remaining source-only Sync Now race: initial read can miss newly added local drafts, and final remote page can become stale after a concurrent CAS. Add second owner-filtered RxDB inventory and read-only remote revision tail; preserve all drafts, foreign-owner caches and checkpoints; fail rather than report false 100%. Existing open PR #1281 is stale and not merged; this adaptation is based on current accepted SHA.
- Sync Now in-flight owner-audit fence accepted: PR #1394 squash `21380e3306377ab32ca2d1cbc82ced9133922418`, focused #40517856442 and full Quality #40518319132 PASS; eight restore/encryption labs PASS, Core App Lab still running during this checkpoint. No hosted mutation.
- New source-only import safety: TodoMate Replace must stop before any deletion or safety backup when normalized tasks/categories are both empty; preserve the newer Supabase image-upload code. Stale PR #1254 also proposed an obsolete photo-progress change; only port the still-missing empty-Replace guard with tests for both backend drivers.
- Next: focused task Quality, squash onto isolated recovery after accepted checks, full canonical/relevant labs. Remaining personal runtime/storage parity, device/offline/ZIP, old PWA fencing and separate cutover authorization unchanged.


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
