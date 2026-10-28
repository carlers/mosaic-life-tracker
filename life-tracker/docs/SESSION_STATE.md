# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 **post-accepted hosted signed two-owner tests**, next SMTP actual-delivery and protected Preview/devices. Production NOT approved.

## Accepted evidence
- Stable isolated recovery `feature/1027-supabase-recovery-20261020@664a574d98b0e2b45ffa131b3c0c7cb2cd247895`, merged PR #1431, focused Quality #40679225293, full canonical Quality #40679406017 SUCCESS. Other real GoTrue, eight/ten-table, synthetic and archival labs passed at exact SHA. Protected Supabase Core App Preview remains reviewer-gated, not Production.
- Owner approved **only** the protected `mosaic-supabase-hosted-acceptance` GitHub Actions environment. Agent reran originally failed job; [run #40679406417 attempt 2](https://github.com/carlers/mosaic-life-tracker/actions/runs/40679406417) **SUCCESS**, strict source checkout, scoped secret, live signed post-registry two-owner checks, and read-only Auth policy inspection. Markers `MOSAIC_HOSTED_POST_REGISTRY_TWO_OWNER_PASS`, `MOSAIC_HOSTED_EMAIL_POLICY_READ_PASS`; email policy **read succeeds**, NOT actual SMTP inbox/redirect delivery proof.
- Signed current 21-migration hosted acceptance stages PASSED: private account mapping/consent/anti-metadata-forgery and anonymous/foreign denial, six-domain RLS/grants/CAS/race/lease/epoch/session revocation, immutable category retirement/date-effective metadata, atomic category/task tombstone, resurrection and deleted-assignment denial; strict signed two-owner rows.
- Independent post-run read-only hosted audit: run-marked `3dc49e662e68540a0dac6623` has exactly two accounts, BOTH banned and backend frozen, two synthetic consent records, zero remaining live tasks/categories/Diary/Settings/Bucket/bucket links. At latest audit project has **89** Auth users, **86** marked synthetic fixtures and **3 unmarked** accounts; **zero consented unmarked accounts**, **zero release evidence** and final personal writer-fence migration **uninstalled**. Never present synthetic consent as release approval. Global prior 87 Auth count was before this fixture run, NOT 87 real users.
- Immutable independent R2 BEFORE `20261028T053525682Z` and fourteen-table AFTER `20261028T100954899Z` proofs accepted and retained. **No further capture, restore or pruning.** No dev/main/Production migration or provider authority activation.

## Next release gates (separate)
- Hosted SMTP real controlled mailbox confirmation/password-reset delivery (including Proton), actual redirect allowlist/templates/sender, and provider quota/leaked-password risk acceptance. Read-only Auth policy inspection is no substitute.
- Only **reviewer-authorized** exact-SHA Supabase protected Preview deployment, then real device/offline/media/ZIP/account-switch/old-PWA writer acceptance. No automatic Preview review from hosted acceptance.
- Formal privileged SECURITY DEFINER review, trusted administrative release-evidence signature path, consented fresh/recovery-pending account gates and Appwrite dual-writer protection, followed by separately authorized final writer fence and explicit dev/main/Production approval.
- Keep #1027 OPEN. Next safe connected work: prepare controlled SMTP inbox and protected Preview verification without altering real user data. Scope test credentials to the protected GitHub environment, revoke/rotate as appropriate.

Issue: https://github.com/carlers/mosaic-life-tracker/issues/1027
