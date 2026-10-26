# Session checkpoint
Updated: 2026-10-26 Asia/Manila
Current task: #1027 scoped safe field-only R2 credential format diagnostics; branch `chatgpt/1027-r2-credential-field-diagnostic-20261026`.

## Accepted state
- Recovery source `feature/1027-supabase-recovery-20261020@48ac0e8e7384433afe73cf61a8811a9145d8441d`, v0.47.0; dev/main/Production untouched. PR #1363 merged local Stage-04 fixed allowlisted restore checkpoints; 16 synthetic tests plus full exact-SHA Quality #40323677974 PASSED, eight table/age labs green; other exact-SHA labs may still be running.
- User approved additive Settings/Bucket/link SQL on hosted `mosaic-dev` **only after** fresh private complete-age backup and independent signed real physical PostgreSQL/Auth/Storage recovery; no Production/Preview or provider-switch approval.
- Fresh protected R2 generation `20261026T121358327Z`: backup #40320887302 SUCCESS and independent ciphertext watch #40166002937 attempt2 SUCCESS. User Fedora original attempted archive: stage 01/02/03 passed, stage 04 physical PG17 failed; cleanup stage 07 PASS. No signed physical recovery/hosted DDL.
- User retried exact newer diagnostic restore but stage 02 FAILED with `Dedicated R2 reader credentials malformed`, then stage 07 cleanup PASS; no network download, no physical recovery proof. Earlier accepted same-age R2 download proves this generation is accessible with valid read-only ID/secret. Only local credential-field format validation failed; no indication yet which field. Do NOT ask for API token/key/secret in chat or logs.

## Current change
- Split `read_credentials()` combined validation failure into safe field-only static errors: account ID, dedicated read-only Access Key ID, dedicated read-only Secret Access Key. Keep exact original formatting constraints, hidden prompts, no credential value/length disclosure, no trimming hidden keys. Do not relax cloud credentials, owner/age/PG17/Storage/cleanup gates. Synthetic no-network tests cover normal valid account+secret, each invalid field/empty/whitespace, and prohibit secret reflection. Existing offline restore suite expanded 16 to 18 cases, canonical wrapper updated.
- Source-only; no cloud backend, R2, Production, dev/main, user-data or Fedora modifications. Run task focused Quality, merge scoped source, then verify exact canonical before ONE operator rerun of same snapshot command with correctly copied read-only credentials.

## Next action
- If download succeeds, local Stage 04 fixed safe checkpoint will pinpoint previous physical restore fault. Resolve and re-run strictly locally before already-approved hosted additive migrations; follow with live signed two-owner RLS and complete ten-table R2 recovery. Preserve sole one-command operator workflow, do not repeat older accepted backups or leak credentials.
