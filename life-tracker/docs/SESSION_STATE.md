# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1027 repair six-domain negative permission test after owner-approved live run.

## Active #1027 gate
- Isolated recovery source `feature/1027-supabase-recovery-20261020@c2d597176165972c39832872ea23dbd93d78ab73`; canonical Quality #40443086517 and all eight recovery/preservation labs PASS; main remains Appwrite v0.43.8.
- Owner-approved `--six-domains` signed hosted run `341212469279944360d3048f`: 2 Auth accounts retired, frozen/banned; independent SQL confirms exactly 6 tombstones and **0 live rows** across six domains. Probe failed before owner audit/CAS when Diary direct PATCH used nonexistent `order_index` (HTTP 400). No full hosted security pass yet.
- Repair tests exact owned IDs with shared `is_deleted` (401/403 only, not 400); strict no-row RPC accepts complete typed-null results but rejects partial disclosures.
- Next: focused task gate, squash to isolated branch, canonical gate, one verified pinned operator rerun. Then Appwrite writer fence/source/outbox/media, offline/ZIP/device, Auth/email and separate cutover approval; prior Fedora restore stays accepted.

## Historical checkpoint (2026-10-23 onward)
## Accepted
- Recovery feature/1027-supabase-recovery-20261020@a493f555da2ab6b8c915d98c175ab842f93a7570; exact full Quality #40341254320, signed local two-owner GoTrue and 8/10 table original age/media labs PASS. Non-shipped six-domain Sync Now false 100% fix accepted.
- User-approved hosted mosaic-dev additive Settings/Bucket/task links installed with owner RLS, triggers, signed CAS, two foreign keys. Existing user rows and Appwrite Production data unchanged, no original history imported or six-domain app activated.
- Post-install real TEN-table encrypted PostgreSQL/Auth + entire private Storage R2 generation 20261026T153242858Z: protected main backup #40350285859 SUCCESS; immutable COMMITTED marker in GitHub job. User independently completed exact pinned Fedora restored original database/media age archives, exact PG17 source/target bytes, original-password owner login, exclusive authority, cross-owner denial, private Storage+synthetic photo; stages 01-07 PASS and final MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS. No new backup or Fedora step necessary.
- Protected backup workflow-only user-approved Preview→dev→main PR #1370 accepted, main@dd9cc77f49e83dbd9252daa311fd11de4a86a1bb and dev@ff350076204742ff020a7ad962ba402210d8ea62; main Quality #40346349166 and production Vercel redeploy READY; unchanged app v0.43.8/Appwrite provider. No Supabase provider Production cutover.
- Earlier anon and null-owner hosted SQL negatives passed but are NOT real signed HTTP two-owner proof; connected provider lacks access to credential pairs for two preexisting disposable test accounts. Do not impersonate real users, create hosted accounts, or claim hosted signed test pass.

## Scoped source task
- Isolated recovery source feature/1027-supabase-recovery-20261020@06c299a69f72cf2f688c7b4e479c7e57f215afe5 includes accepted focused-only R2 ten-profile watchdog PR #1373, but full canonical Quality #40415836451 failed. Root cause: `tests/unit/supabaseUnifiedOffsite.test.ts` expects literal `# pass 12` even though all 13 real underlying node:test recovery cases PASS after adding the new profile mismatch regression; all other Quality jobs passed.
- Replace hardcoded total with a verified parse of node:test's complete `# tests N`, `# pass N`, `# fail 0` summary, minimum prior coverage 12. Never weaken actual test failure detection or skip security checks. Source-only focused+canonical acceptance; no hosted/SQL/R2/Appwrite/dev/main/Production mutations.

## Next action
- Focused task CI then squash reviewed repair into isolated recovery, rerun exact full canonical + applicable restoration labs. Only after the new source SHA is accepted, re-pin the separately staged `chatgpt/1027-ten-profile-watch-workflow-20261027` review candidate from dev, run workflow-only focused/full Preview, then require explicit approval for dev/main promotions. Never change main watcher/schedules early.
- Remaining signed hosted two-owner + positive lease, original Appwrite owner/media/outbox and server writer fence, six-domain Preview/device/offline/ZIP, managed Auth/SMTP and Production provider cutover gates remain separate.
