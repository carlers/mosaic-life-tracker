# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 independently prove encrypted fourteen-table Supabase Scratch disaster recovery without bypassing protected GitHub main.

## Verified
- Owner-approved five additive `mosaic-dev` migrations installed, now **21 total** through `20261028070024`. Scratch is ACTIVE_HEALTHY. Original rows preserved: 87 Auth users/identities/core authorities, 54 revisions, 69 tasks, 59 categories, 7 Diary, 5 Settings, 5 Buckets, 5 links. Registry adds 1 installation, 87 Mosaic accounts, 87 verified provider bindings, 87 audit events; **0 owner mismatches**, 3 active/84 frozen authorities. Four new private RLS tables have no browser grants; all six personal Realtime publications present. Consent remains unset; release evidence NULL; **final writer fence NOT installed**.
- Original ten-table BEFORE R2 generation `20261028T053525682Z` fully age-authenticated, independently restored with exact PG17 rows, signed owner/foreign denial and all private-media bytes on Fedora. Do not repeat it. **New fourteen-table AFTER R2 backup/restore is NOT DONE**.
- Recovery source `feature/1027-supabase-recovery-20261020@2128be03404181bdabd43e3792fc56a8a3b515be`: full canonical #40643925995 attempt 2 SUCCESS, real GoTrue and private-media labs PASS. Protected main-only fourteen-table workflow [PR #1421](https://github.com/carlers/mosaic-life-tracker/pull/1421) is DRAFT/BLOCKED by mandatory `dev→main` canonical promotion gate; do not bypass, merge unrelated application code, or change `dev`/`main`/Production.

## Scoped implementation
- Task branch `chatgpt/1027-fourteen-offsite-trusted-operator-20261028` stages `supabase-poc/operator-fourteen-offsite.py` and 13 offline Python tests + Vitest wrapper. The approved alternative reuses existing accepted `unified-offsite.mjs --backup`, independent R2 read-only `--watch`, and `restore-unified-r2.py`. One exact-SHA Fedora command asks hidden keys once, uses saved private pooler/age escrow, probes disposable Docker before secrets, encrypts ALL 14 PostgreSQL/Auth/personal tables and private media, commits exact R2 marker, verifies it read-only, restores locally with signed original-password owner and cleans only its local stack. No hosted writes or app deployment; R2 ciphertext publication is the only intended external write. Failed post-commit stages retain and report the exact R2 generation for a restore-only retry.
- Local 13-test no-network suite PASSED. First task focused CI failed **only** because this checkpoint exceeded the handoff token cap and omitted the required `## Next action` heading. Repair is documentation-only; rerun focused before isolated stable Preview merge.

## Next action
1. Shorten checkpoint and rerun focused CI; squash task PR into **isolated recovery branch only**, verify full canonical/specialist labs.
2. Give owner ONE SHA-pinned Fedora operator command. Only final `MOSAIC_FOURTEEN_R2_COMPLETE_OFFSITE_DISPOSABLE_RESTORE_PASS: <snapshot-id>` establishes the new independent AFTER recovery.
3. Hosted signed two-owner/RLS/Storage, managed SMTP/signup/reset and devices remain separate. Do NOT install consent writer fence, publish evidence, approve protected Preview, or promote `dev`/`main`/Production without distinct release authorization.

Runbooks: [Unified offsite](SUPABASE_UNIFIED_OFFSITE_DR.md) and [One-pass operator](OPERATOR_ONEPASS.md). [Issue #1027](https://github.com/carlers/mosaic-life-tracker/issues/1027).
