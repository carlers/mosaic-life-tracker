# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 reach protected Supabase Preview/SMTP acceptance before separately approved Production cutover.

## Confirmed gates
- Isolated recovery `feature/1027-supabase-recovery-20261020@659a469b348d2fc5f0be331d34e93d191b9985f2`; focused #40711171077 and full canonical #40711360548 SUCCESS. Eight/ten-table, real GoTrue and archive labs SUCCESS. Core App #40711360748 had its exact-source browser+device synthetic lab still running at last check; protected Preview review had not been approved. `dev`, `main`, Production unchanged.
- Independent read-only hosted: Scratch `mosaic-dev` has 21 migrations, nine intentional signed privileged RPC advisor warnings requiring review. Final personal writer fence NOT installed, release marker count zero and no unmarked accounts consented. Prior approved live signed two-owner #40679406417 attempt 2 SUCCESS with exactly two run-marked consented users frozen/banned, **zero live test rows in all six domains**. Total Auth 89: 86 marked synthetic and 3 unmarked; never conflate synthetic users or consent with live rollout.
- Immovable accepted offsite snapshots: ten-table BEFORE `20261028T053525682Z`, fourteen-table AFTER `20261028T100954899Z` fully independently restored; NEVER backup/restore, overwrite or prune these again.
- GitHub isolated protected `mosaic-supabase-hosted-acceptance` environment and scoped PAT were configured by user; accepted prior two-owner test verified it. Read-only email policy management endpoint returns success, but the prior workflow **discarded** safe Boolean results: SMTP setup, sender, routes and actual inbox delivery still UNKNOWN. Independent Brevo connector enumerated an active Mosaic sender; this does not prove Supabase SMTP uses it.

## In progress (source-only)
- Task branch `chatgpt/1027-email-policy-gate-20261028` adds **read-only** `hosted-email-audit.mjs --inspect`, deterministic safe Boolean markers/tests and isolated `.github/workflows/supabase-hosted-email-policy.yml`; uses protected short-lived Scratch PAT, exact isolated branch/SHA and reviewer. It does NOT re-execute the accepted hosted two-owner fixture suite or send any email.
- Markers reveal confirmation requirement, reviewed **old immutable** EMAIL_PREVIEW site/redirects/code templates, custom SMTP, Brevo relay, sender and bounded email rate-limit without logging private values. Missing fields fail closed; success is policy readiness for the older reviewed email Preview only, **never** real inbox delivery or approval of the new release Preview.
- Requested workflow task CI focused and exact post-merge canonical; on merge, separate email audit waits for a *new explicit environment reviewer approval*. Do not conflate with Preview or Production approval.

## Next action
Finish source/test/CI and isolated recovery squash. Inspect exact latest Core App artifact and protected Preview waiting state. Ask owner for **read-only email auditor** environment approval only if job awaits it. Next design controlled genuine Proton/Gmail inbox signup and recovery tests and protected exact-SHA Preview/device/old PWA authority proof. Separately gate reviewed trusted release evidence, final writer-fence DDL, dev/main and Production promotion.

Issue: https://github.com/carlers/mosaic-life-tracker/issues/1027
