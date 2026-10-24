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

## Next action
- Require `[verify:focused]` green task branch, PR squash into isolated stable, exact SHA canonical CI and Supabase labs. Keep new and legacy scheduled workflows **disabled**, no R2 environment creation, no DB/Storage hosted mutation, no protected Preview/dev/main/Production promotion. Next external gate is dedicated R2 bucket/key escrow and first real encrypted unified upload and complete independent restore with delivered alert test, only after explicit review/approval. Keep #1027 open.
