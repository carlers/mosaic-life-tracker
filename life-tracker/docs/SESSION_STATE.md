# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 private Bucket List/task-link SQL + age DR + signed read/create/CAS pre-social stack.

## Accepted historical evidence
- Production remains Appwrite. No Supabase Production cutover or hosted Bucket/Settings schema installed. `dev`/`main` unchanged by this task.
- Original encrypted R2 seven-table historical snapshot 20261025T031343499Z restored and verified on Fedora; native >=30-day R2 lock readback. Do not repeat previous accepted Fedora stages.
- Independent disposable signed PG17 eight-table Settings age/TOC/exact-byte restore and Quality/GoTrue/Core technical CI previously passed at cited historical recovery checkpoints. Do not imply new ten-table R2 recovery was already accepted.
- Automated offsite alerts/pruning and Proton-managed sender replacement remain unresolved/disabled as previously recorded.

## Working isolated PR stack (all drafts, not release)
- #1328: private Bucket List and task-link SQL/RLS/owner-linked foreign keys, writer-authority leases, strict CAS, signed GoTrue two-owner fixture and fail-closed old 6/7/8-table restore source. Late SECURITY DEFINER active-link target probe now checks signed owner first, with present/missing foreign-target negative tests. Exact final task SHA `a97cd1c66d0eb489826f4e75ee097bf44acb2ee9`.
- #1329: pinned ten-table age/PG17 source-to-independent-disposable-target exact COPY restore profile, signed bucket/link tombstone and foreign-owner readback. Source-only; not an actual hosted R2 generation, user backup or verified CI success.
- #1330: signed owner-scoped Bucket/link bigint pull, checked no-upsert create/current master, caller-verified target inventory for link create, allowed CAS RPCs, immutable original linked target assertion, malformed/foreign/account-switch negatives. Remote task-reference >36 characters refuses signed pull checkpoint/master; source historical IDs up to 255 remain exportable/quarantined.
- Task-only dependency merges #1331 (into #1329) and #1332 (into #1330) have reconciled the late #1328 privacy fix. Neither touched the stable recovery branch.

## Verification and blockers
- Source inspection of nine relevant dispatch/identity/ack guards passed. Separate CI checks, real disposable signed #1328 SQL/GoTrue, real #1329 ten-table encrypted restore, focused Vitest and canonical Quality gate are **unverified**: the connected GitHub tool exposes neither push-triggered Actions runs nor check-runs for these task SHAs.
- Historical long/dangling/foreign link quarantine must be durably encrypted before import; mapper classification is not yet a persistently recoverable migration ledger.
- No hosted Bucket/Settings writer, RxDB collection binding, ZIP/offline/photo backfill, provider-switch rehearsal, or final mobile/device acceptance has been authorized or claimed.

## Next action
- Obtain exact SHA GitHub CI evidence for #1328, #1329 and #1330 and repair failures. Merge these PRs into isolated recovery in dependency order only after focused/signed tests pass; then run one stable canonical set with protected Preview approval.
- Finish private Bucket/Settings RxDB checkpoints and owner-protected migration/ZIP/media reconciliation, ten-table R2/Storage full DR, Appwrite Cloud/Oracle ↔ Supabase single-writer reversible migration. Then execute the **one** consolidated SHA-pinned pre-social Fedora acceptance. No piecemeal Fedora, dev/main/Production promotion, social, unattended alerts, pruning or data mutation before explicit approvals.
