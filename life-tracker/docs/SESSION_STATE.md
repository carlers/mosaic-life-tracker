# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 isolate repeated Cloudflare R2 S3 SignatureDoesNotMatch without making more seven-credential backup attempts.

## Verified
- Scratch `mosaic-dev` has 21 owner-approved additive migrations, original 87 Auth accounts, private identity mapping with zero owner mismatch, unchanged personal rows. No user consent, release evidence, final writer enforcement or Production cutover.
- Ten-table BEFORE R2 `20261028T053525682Z` completed immutable encrypted paired Auth/database+media and passed independently restored PG17/GoTrue two-owner and media bytes; **preserve, never repeat or prune**. No fourteen-table AFTER R2 marker/restore accepted.
- Trusted Fedora private PG17.11 alongside untouched installed PG18 works. Two owner attempts 08:31 and 08:39 UTC on isolated recovery `feature/1027-supabase-recovery-20261020@17ff359cfc1c027102b1623075151ca14f558498`: Stage 01/02 passed; Stage 03 failed at the FIRST R2 read-only LIST: `FOURTEEN_R2_R2_PREFLIGHT_LIST_HTTP_403_SIGNATURE_MISMATCH_FAILED`; Stage 06 cleanup passed. No new source capture or R2 publication in either retry.
- Crucial independently confirmed: exact R2 signer Git blob `aab6fb184978f71f8638bb5ffbc77029b2245695` at current source is byte-identical to protected ten-table successful GitHub run #40638837505 (source `51e5b1b4a5077f6ffce2e93fa151709a67c3022b`). This strongly favors invalid/mismatched **writer S3 ID + secret** or Cloudflare account context over a newly broken signer; not proof of exact cause. Cloudflare documents `SignatureDoesNotMatch` separately from permissions-only `AccessDenied`.
- `17ff359` full Quality #40656181679 and real PG17/GoTrue, bucket, Settings, encrypted media specialist labs SUCCESS. Core App protected signed-UI lab still awaiting independent approval. `dev`/`main` unchanged; protected manual main workflow PR #1421 still DRAFT/BLOCKED.

## Scoped implementation
- Task `chatgpt/1027-r2-readonly-paired-credentials-20261028` adds `operator-r2-paired-probe.py` + `r2-paired-probe.mjs` for exact-SHA operator read-only diagnostic. Prompts **only** R2 account + separate READ-ONLY and WRITE S3 credential pairs (five hidden fields). Both perform only LIST historic R2 snapshot prefix and GET known-good ten-table `COMPLETED` metadata, no PUT/DELETE, Supabase, DB, Docker or age. Prints fixed allowlisted role-specific results and safely cleans own detached worktree. No plaintext credentials in argv/files/logs.
- Six Node synthetic and six Python offline tests plus Vitest wrapper; updated operator runbook. **Focused and canonical CI pending.** Do not change full one-pass backup runner or weaken permissions.

## Next action
1. Finish focused CI, merge only into isolated recovery; verify full canonical and relevant specialist gates. Do not alter hosted Scratch or protected `dev`/`main`.
2. Owner first verify Cloudflare R2 S3 Access Key ID and Secret Access Key are from the SAME R2 API token creation; account ID matches bucket owner and WRITE token allows `Object Read & Write` for `mosaic-supabase-backups`. Key secret can't be revealed after creation. Then ONE source-pinned Fedora **R2-only** differential command; do not ask 7 Supabase+R2 fields or redo full capture until both R2 pairs pass.
3. If reader PASS/writer SIGNATURE_MISMATCH, replace only the writer pair with one correctly issued token, keeping working reader/old backups. If both PASS, run existing fourteen-table one-pass recovery with independent watch and restore. Final writer consent/Preview/Production remain separately gated.

Runbook: [OPERATOR_ONEPASS.md](OPERATOR_ONEPASS.md). Issue [#1027](https://github.com/carlers/mosaic-life-tracker/issues/1027).
