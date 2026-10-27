# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1027 resolve transient hosted signed GET after completed CAS and guard tests.

## Active #1027 gate
- Isolated recovery base `feature/1027-supabase-recovery-20261020@14d2b4e2ba2c4eb9069b16e40dbbd36640e158f4`; Quality gate #40462741648 retry PASS; signed Core App Lab #40462741653 and eight restore/crypto labs PASS. dev/main Appwrite and Production unchanged.
- Owner-approved signed hosted probe `341212469279944360d3048f` originally failed malformed PATCH; fixed at base SHA. Its two Auth users are banned/frozen with 6 tombstones, zero live rows.
- Owner run `e3acf9789cde5740da265f78`: 2 signed identities, 6 real CAS races and 3 writer guard stages reached; failed on transport/redirect between successful session-release and expected task GET, before strict full owner audit. Independent live SQL confirms both Auth accounts banned/frozen, exactly 12 tombstones and **0 live rows** across six domains.
- This task adds short bounded retries only for read-only GET transport failures in the trusted hosted-core runner; never retry session/CAS/other writes or HTTP denial responses. Adds failure stage markers around release/revocation/identity refresh. No hosted SQL changes.
- Next: focused task gate, squash into isolated recovery, canonical and relevant lab verification, then one exact-SHA private hosted probe. Do not repeat completed Fedora restore, R2 or personal-account setup. Other Appwrite writer-fencing, media/outbox, device/offline/ZIP/Auth and explicit cutover gates remain.


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
