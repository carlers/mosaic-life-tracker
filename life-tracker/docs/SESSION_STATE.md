# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 real eight-table authenticated TOC/profile acceptance.

## Accepted live and isolated milestones
- Production Appwrite main bef14fb791a361e8c1f902a5c4adf4536e57aae7 and dev 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged. Supabase branch isolated; hosted Settings schema remains UNAPPLIED.
- Real seven-table Scratch R2 snapshot 20261025T031343499Z passed encrypted upload, independent remote byte watch and Fedora signed PG17/Auth/media restore; native >=30d R2 lock readback verified, no DELETE-denial exercise. Do NOT rerun.
- Source-only Settings two-owner GoTrue/CAS/RLS and synthetic 8-table age encrypted/PG17 independent row parity + signer proof accepted CI #40193775207. Main alert workflow installed but automatic Brevo/daily backup/pruning disabled; Proton sender Gmail-free support ticket pending.
- PR #1320 stable SHA 52080567ca582453f1ea96bd07570d2c24a4e4a0: unified offsite backup now authenticates entire age archive and verifies TOC personal data against explicitly restorable 7/8-table profile before media/R2 upload; old profile refuses newly present Settings or unknown future personal collections; historical v1 markers remain readable. Focused Quality #40195958356 and stable full Quality #40196108367 SUCCESS.

## Current source-only follow-up
- Extend existing CI-only eight-table Settings restore lab to run actual TOC inspection and assert that full synthetic age archive passes exactly the same future R2 eight-personal-settings profile gate and FAILS historical seven profile. Other signed restore, tombstone, security and cleanup steps unchanged. No cloud secret, hosted SQL or R2 publication.
- Complete task focused CI and squash into isolated stable; canonical eight-table lab and Quality again. No Fedora commands until all personal/DR/portable provider work packaged into ONE pre-social run, with separate Prod/device authorization.

## Next action
- Accept real R2 TOC fixture stage, then implement signed Settings incremental sync/outbox and portable Bucket List/task links, preserve data in offsite profiles and reverse Appwrite↔Supabase rehearsal. Confirm actual remote evidence only when separately approved.
