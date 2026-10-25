# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 repair PostgreSQL 17 TOC verification in CI-only signed eight-table Settings DR lab.

## Live branch and evidence
- Appwrite Cloud remains Production main bef14fb791a361e8c1f902a5c4adf4536e57aae7 and dev 497919bed4b6ce85b826f2d86fc767920344ec17; only isolated feature/1027-supabase-recovery-20261020 changes permitted. Hosted Settings SQL is UNAPPLIED; owner directive: **no more Fedora commands** until single final pre-social bundle.
- Real historical seven-table encrypted Scratch R2 20261025T031343499Z upload, reader verification and Fedora signed restore PASSED; Cloudflare native >=30d prefix lock GET passed. No need to repeat. Daily backups, pruning, Brevo automatic alerts disabled; Gmail-free managed sender support pending.
- PRs #1316–#1319 delivered eight-table Settings synthetic encrypted PostgreSQL/Auth full restore and signed original-password/cross-owner privacy tests; previous actual [Eight-Table Settings Restore Lab #40196108365](https://github.com/carlers/mosaic-life-tracker/actions/runs/40196108365) passed.
- PR #1320 source-enforced exact restorable 7-versus-8 personal TOC profile gates before future R2 uploads; old real snapshots remain readable. Stable recovery 3d00f85c13b30b32a3ad05471844389e6e1bba85 Quality #40196594503, Synthetic #40196594545, GoTrue #40196594558 PASS. **New eight-table lab #40196594536 FAILED** because disposable PG17 pg_dump generated custom archive v1.16 but Ubuntu's older host pg_restore refused it. Age full-byte authentication and signed synthetic source passed; exact TOC/profile assertion never ran. This is a tool-version compatibility failure, not proof of defective ciphertext. Core App workflow awaiting protected Preview authorization.

## Current task
- In eight-table-restore-lab.sh, route the existing unmodified full-byte age/TOC inspector's pg_restore invocation to the same disposable container's PostgreSQL 17 pg_restore via strict private PATH wrapper; require exact local container identity and PG17 version. No plaintext archive materialization or hosted access. Preserve exact 8-profile acceptance and legacy 7 rejection.
- After task focused CI, merge only into isolated recovery branch and demand actual new Eight-Table Settings Restore Lab PASS plus Quality/Synthetic/GoTrue; repair regressions rather than bypass checks. No hosted Settings writer or new R2 publication.
 
## Next action
- After eight-table real TOC/profile CI green, continue signed owner-scoped Settings incremental transport/RxDB parity, full DR allowlists, and owner-private Bucket List/task links before a single complete pre-social Fedora acceptance run. Production/backend cutover and social require separate approvals.
