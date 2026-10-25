# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Task: #1027 protected Scratch Supabase unified encrypted PostgreSQL/Auth + private Storage disaster recovery. For previous implementation/proof details, use the latest issue #1027 resume comment and exact live Git/CI state.

## Accepted recovery evidence
- Scratch project hcxtiifzxoaflhjgoglb only. Live manually dispatched main backup Actions #40157401249 committed one completed unified encrypted database/media R2 recovery generation: 20261025T031343499Z. Separate reader-only Actions watch #40166002937 SHA-256 verified all remote ciphertext bytes and 36h freshness. Inert daily schedule and pruning remain OFF.
- Owner's trusted Fedora exact-snapshot R2 restore PASSED all seven stages with original-password local GoTrue sign-in, positive owner task/category read, cross-owner denial, seven-table PG17 byte parity, whole Storage archive restore, synthetic nonempty WebP and isolated stack/network/worktree cleanup. The hosted source had zero real photos. The full exact R2 chain is accepted for covered domains, NOT complete managed Supabase platform/SMTP/OAuth/JWT recovery.
- Recovery branch feature/1027-supabase-recovery-20261020@48636c9ae4b80fcc0e3edf75fbf7a79f683eac46 passed full Quality Gate #40167282093, Synthetic #40167282120, Real GoTrue #40167282112. Protected Core App Lab #40167282121 awaits Preview gate. Appwrite Production main@0519489042c53ed0bcdaebe10664417091c4d7d8 and dev@256bea48847b795dc33f7c5247e9312a75915812 remain unchanged by restore work.

## Current source-only safeguards
- Cloudflare native R2 lock audit: new supabase-poc/r2-lock-audit.py performs only authenticated GET of dedicated bucket lock rules. Requires an enabled 30d Age or Indefinite prefix covering all current/future mosaic-supabase/v1/snapshots/ keys. Provider readback not yet run; no DELETE or lock modification will be attempted.
- Failure email: new supabase-poc/dr-alert.mjs accepts exact trusted main Scratch backup/watch failure events only, rejects other/fork/success events, has typed TEST_SCRATCH_DR_ALERT probe and sanitized Brevo payload. No main workflow/alert secrets installed and NO email delivery claimed.
- Unit and offline negative tests wrap both tools; task branch final focused acceptance required, then squash to stable for full canonical. Release version NONE. Do not promote to dev/main, touch production/cloud data, enable recurring schedules/pruning or assert native retention/alert receipt without separate proof.
- Next real gates: Cloudflare account API readback with owner-held separate bucket-configuration token (not R2 S3 key), independently received alert email, backup key/identity escrow, managed Supabase Auth/SMTP/OAuth/JWT configurations and real photo-containing source once one exists. Keep #1027 open; do not repeat historical successful Fedora disaster-recovery run.
