# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 unified Supabase encrypted offsite R2 personal table completeness gate.

## Accepted recovery and release status
- Production Appwrite Cloud main bef14fb791a361e8c1f902a5c4adf4536e57aae7; dev 497919bed4b6ce85b826f2d86fc767920344ec17, both untouched. Supabase remains isolated feature/1027-supabase-recovery-20261020, not public.
- Actual Oct 25 seven-table Scratch R2 generation 20261025T031343499Z encrypted upload, read-only full-byte watch, complete Fedora age-authenticated PG17/GoTrue/media signed restore, and native R2 30d bucket lock GET readback passed. Do not repeat.
- Source-only Settings RLS/CAS and signed GoTrue two-owner tests green. Real CI eight-table synthetic source->age encrypted->independent PG17 restore->signed owner/cross-owner/tombstone checks passed at exact isolated SHA c4ad590812e84944152e595c5d3cf995d5eda275, full Quality, Synthetic and GoTrue green. Core App Lab still protected Preview waiting at last check.
- Main Brevo DR alert installed but automatic sending, daily backups and pruning disabled. Gmail-free Brevo managed sender+Proton Reply-To support pending vendor response; no automatic alerts enabled.

## Current gate
- Uploader previously made new two-archive R2 markers without proving new Settings TABLE DATA can be independently restored. Add age-authenticated TOC personal inventory check before Storage capture or R2 put. Default/historical seven requires tasks/categories/Diary; explicit future `SUPABASE_DR_RECOVERY_PROFILE=eight-personal-settings` demands Settings too. If Settings appears under seven, fail closed; reject unknown future personal tables. Include recoveryProfile in new marker; verify historical markers with no profile unchanged.
- Pure profile gate tests plus prior unified offsite byte/freshness/prune regression (still no cloud access). No hosted SQL/production change, scheduled workflows or remote R2 writes.
## Next action
- Test and squash only to isolated stable; canonical Quality and relevant restore labs. Then complete full Settings signed transport/outbox + BucketList/task links, offsite allowlist expansion, reversible Appwrite Cloud/Oracle↔Supabase dry runs. User mandates no further piecemeal Fedora commands: deliver ONE complete pre-social operator runner only after all CI work.
