# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 preserved-draft conflict review; internal completion of candidate v0.32.1.

## Accepted baseline and scope
- `feature/1027-supabase-recovery-20261020@f010d9008adef064d429d9e968426c9afe513a9a`, PR #1103: canonical #39444309814 and real Supabase lab/artifact #39444309733 passed. Resume evidence: #1027 comment 6293773081.
- Current task `codex/1027-supabase-recovery-conflicts-20261020` targets that stable branch. Version impact NONE: the isolated Supabase v0.32.1 Preview remains undelivered. No Production, real-user migration, dev/main promotion or 1.0. Diary #1029 follows core MVP release.
- Recovery pauses local writers before same-owner token rotation, then releases/reacquires signed authority. Ambiguous failures retain drafts; denied Auth/unconfirmed cancellation block replacement writers. The real expiry test starts from an acknowledged task; it does not cover a lost create response.

## Current implementation
- Pending conflicts now reach an owner-scoped, provider-neutral review hook and Sync Status UI. It shows device/cloud differences, explicit keep-device/deletion action and refresh comparison; closing retains the draft. No silent master-wins resolution.
- Existing signed conditional resolution requires the exact reviewed cloud revision and unchanged local snapshot. A cloud change updates the comparison and rejects the stale choice. Missing masters/protected-field changes cannot be applied automatically. There is not yet a discard-device/use-cloud action.
- Local edits made while an old native batch is parked require a guarded writer restart on Refresh comparison. It rebuilds review from current durable RxDB state. Review work is serialized and drained before writer cancellation/lease release; queued/stale-owner actions are rejected. Account changes clear the review registry.
- New real browser case deliberately commits a create server-side but aborts its browser acknowledgement, edits offline, reconnects, edits again while parked, rejects a stale cloud choice, then resolves and verifies a second device. It is local-stack only; separate hosted conflict fixtures remain required.

## Checks and environment
- Local 31 targeted runtime/owner/UI tests passed. Supabase production build/PWA/blocking sizes and reconstruction of 177 static files passed. New browser acceptance is pending CI; do not claim it from mocks.
- Deployment is blocked by enforced egress. Saved draft adds `mosaic-supabase-core-preview.vercel.app`, `productionresultssa7.blob.core.windows.net` (task artifact), and `productionresultssa1.blob.core.windows.net` (stable artifact). Requires user Review/Save/Publish. No Supabase deployment has been created; do not substitute a local rebuild for CI bytes.
- Supabase/Vercel environment credentials work. Only backend target is mosaic-dev / `hcxtiifzxoaflhjgoglb`; exact Vercel scope and deployment procedure are in `supabase-poc/HOSTED_CORE.md`.
- Hosted Auth has confirmation enabled, localhost redirect, no custom SMTP; signup/recovery acceptance remains open. Scratch Appwrite is suspended, Oracle is unprovisioned. Never substitute Production or request unavailable Appwrite credentials repeatedly.

## Next action
- Finish focused validation and real conflict browser acceptance, squash only after green, then stable canonical/lab acceptance. Record results in #1027 without a status-only post-green commit.
- Deploy verified CI bytes after network publication; verify actual hosted UI/retirement. Operator helpers are in `/workspace/mosaic-preview-operations/`.
- Remaining MVP: persistent offline cold-start/cross-tab rotation, complete Auth recovery, existing-user mapping/old Appwrite writer fencing, reversible three-backend transfers, encrypted restore and physical mobile acceptance. Keep #1027/#967 open.
