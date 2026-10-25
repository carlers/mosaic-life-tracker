# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 unified Supabase offsite database/Auth-row + media encrypted backup foundation.

## Verified source baseline
- Previous Fedora one-command encrypted Scratch PG17/GoTrue and entire hosted photo-bucket local restore PASSED; hosted source had zero real photo objects, but nonempty synthetic WebP recovered. Do not repeat this historical accepted drill.
- Existing independent Appwrite `dr-backup` Function captures all Auth users, TablesDB schema/rows, all Storage buckets/files, R2 ciphertext with one manifest, immutable completion and independent restore. Supabase media-only R2 was separately source implemented in PR #1299 and hardened #1300; it does not protect offsite PostgreSQL records.
- Isolated stable recovery branch before this new scoped change: `5aac40208765190f9eaba60b30fe8c30c48b8f4c`. `dev`/`main` are independent Appwrite deployments. No Production approval.

## Current source-only work
- Add one `mosaic-supabase/v1` generation with two authenticated age archives (PostgreSQL custom dump/Auth data and complete Scratch-private photos). Both full-byte remote readbacks must succeed before the only root `COMPLETED` marker can publish; watcher verifies both, no-clobber download preserves both. Retention 7 daily / 4 weekly / 6 monthly and all 30-day-locked data with orphan refusal and opt-in pruning.
- Add dormant daily GitHub Actions source+read-only watcher, eight negative and positive offline Node tests via Vitest wrapper, reviewed runbook and docs navigation. Use only new dedicated Supabase bucket under existing Cloudflare account; never use Appwrite DR credentials or mutate hosted source.
- This is **not** managed-Supabase/Auth/SMTP configuration DR, cross-service atomic snapshot or real full hosted R2 restore acceptance.

## Operator setup report / runner correction (2026-10-25)
- User reports completing R2 bucket, provider lock, two scoped R2 credentials and protected GitHub settings. Available connected GitHub access does NOT expose secrets, variables, environment rules or Cloudflare R2 configuration; treat them as unverified, with no live snapshot or permissions proof.
- Source-only correction: unified backup workflow now pins ubuntu-24.04 and installs official signed PGDG PostgreSQL 17 client (GitHub runner image preinstalls PG16). Still fully disabled; no new remote backup or main/Production writes.

## Next action
- Require `[verify:focused]` green task branch, PR squash into isolated stable, exact SHA canonical CI and Supabase labs. Keep new and legacy scheduled workflows **disabled**, no R2 environment creation, no DB/Storage hosted mutation, no protected Preview/dev/main/Production promotion. Next external gate is dedicated R2 bucket/key escrow and first real encrypted unified upload and complete independent restore with delivered alert test, only after explicit review/approval. Keep #1027 open.

## 2026-10-25 exact-R2 independent restore handoff
- **Observed live:** main manual Scratch unified offsite backup #40157401249 SUCCESS with immutable recovery point `20261025T031343499Z`; independent read-only R2 watcher #40166002937 SUCCESS for the same point. Both DB/Auth and private Storage encrypted remote bytes were validated with all chunks; no age decryption or isolated restoration from those exact bytes has happened yet.
- **Authorized scope:** one new source-only Fedora runner for downloading this exact ID with dedicated R2 read-only keys entered at private tty, authenticating both age archives and restoring via already proven private PG17/GoTrue/Storage local scripts, verifying owner isolation and synthetic media. Never capture a fresh hosted source, write hosted photo fixtures, promote provider, alter main/dev, or enable schedules/pruning.
- **Next acceptance:** task focused CI and stable full canonical/lab gates; then one exact Git-pinned operator command from the updated unified runbook. Require actual `MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS` from Fedora before accepting this R2 recovery. Real source currently has zero stored photos; full managed Auth/SMTP/OAuth still separate.

## 2026-10-25 native lock audit and Brevo failure-notifier source-only safeguards
- Operator supplied actual Fedora stage 01-07 exact R2 generation 20261025T031343499Z PASS, including owner password, privacy, byte-exact seven-table and synthetic Storage recovery. No re-run needed.
- Add fail-closed Cloudflare native 30d lock GET-only audit, accepts only all-future-snapshot prefix Age >=30d or Indefinite rules, no deletes/edits, requires separate Cloudflare configuration-read API token for later one-command Fedora proof.
- Add source-only Brevo failure-only trusted main Actions event notifier with typed synthetic alert probe, no email sent and no environment secrets changed. CI mocks provider/network negative cases; future default-branch integration and inbox delivery proof separately gated.
- Keep SUPABASE_DR_ENABLED=false, PRUNE_ENABLED=false, R2_LOCK_CONFIRMED=false. Do not modify Production, Appwrite, R2 data, or existing backup workflow. Issue #1027 remains open.
