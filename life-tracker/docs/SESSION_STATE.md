# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 offsite private Supabase media recovery hardening and safe read-only recovery.

## Verified baseline
- Real Fedora one-command database/Auth/two-owner/empty-hosted-bucket and nonempty **synthetic** local Storage recovery passed at isolated `1cef0482fccc087a6c4331167bcdf184b0e5bd0c`. No repeat operator action for that gate.
- Stable isolated recovery `6e4ca7696d83bbc435088c8a44df637817ef7a96` fixed the offline matcher; exact Quality, Synthetic and GoTrue SUCCESS. Core App's protected Preview was WAITING reviewer approval. No release or Production authorization.

## Scoped work
- Implement opt-in offsite Scratch private media capture through existing exact-origin, age-verified source snapshot and chunked R2 encrypted-byte upload. Verify each remote chunk and only then commit; add full-byte freshness watcher, no-clobber ciphertext recovery and guarded completed-snapshot 7d/4w/6m retention.
- Add **disabled** scheduled backup/watch workflows requiring `main`, a repository enable switch and protected environment secrets, plus negative offline tests and the runbook `docs/SUPABASE_MEDIA_OFFSITE_DR.md`.
- No Supabase hosted/storage mutation, provider credential provisioning, Vercel Preview approval, dev/main/Production promotion or application version bump (backend-only tooling).

## Follow-up hardening (2026-10-25)
- Detect same-size ciphertext source mutation before publishing any R2 COMPLETED marker. Verify all historical snapshot inventories/markers before retention deletes. Allow read-only watch and download after writer disablement. Include negative offline regressions. No scheduler activation, credentials or cloud writes.

## Next action
- Get task-head `[verify:focused]` green, squash-merge via PR into isolated stable `feature/1027-supabase-recovery-20261020` and check fresh canonical exact-SHA jobs. Do not activate scheduler or R2 retention without protected environment configuration and separate approval. Independently test nonempty hosted data/restore, actual notifications and R2 lock, managed Auth/SMTP, personal feature parity, old-PWA write fencing and provider reversibility later. Keep #1027 open.
