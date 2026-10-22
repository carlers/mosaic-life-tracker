# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 credential-free synthetic recovery acceptance.

## Verified baseline
- Isolated Supabase feature/1027-supabase-recovery-20261020@46cdc37f9b6e762351a8c75a250bfa1381efcf4e: Quality Gate #39725299240 SUCCESS, signed Core App Lab #39725299287 SUCCESS.
- Vercel Sandbox ran source/target PostgreSQL 18 with actual Mosaic migrations, two fake owner sessions, age encryption, selective eight-table restore, exact source/target hashes and signed-claim RLS checks: PASS. This is simulated Auth, not real GoTrue.
- Private Fedora snapshot and age key are inaccessible to ChatGPT/cloud workers. The original snapshot still lacks an independently verified restore.
- Hosted mosaic-dev has core-only schema and Realtime but no hosted private Diary or category-retirement migrations. Public signup disabled. dev/main/Production unchanged.

## Current scoped change and next action
- Add an automatic disposable GitHub Action to replay the synthetic recovery on a clean runner, with a strict no-hosted-credentials boundary; version impact NONE.
- Verify task focused CI, squash into isolated feature branch, then verify exact full Quality Gate, signed Supabase Core App Lab and Synthetic Restore Lab. Diagnose failures without weakening gates.
- Real Auth/SMTP/Storage backup and restore, private source recovery, protected Preview + device tests and explicit Production approval remain mandatory before release. Keep #1027/#1029/#857 open.
