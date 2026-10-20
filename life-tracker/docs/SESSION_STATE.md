# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 isolated email confirmation/password recovery; candidate v0.32.3.

## Baseline and constraints
- Stable `feature/1027-supabase-recovery-20261020@d36102220c28e43e577059c4989bc1f293db7143`, PR #1132, v0.32.2. Canonical #39468574466 and Supabase lab/artifact #39468574342 passed; all five browser/security cases passed.
- Live isolated Preview remains accepted v0.32.1 at https://mosaic-supabase-core-preview.vercel.app, Vercel `dpl_CSBQtqBXqz2naXLx3bS73rE4UTAR`. Its deployed UI/conflict checks passed; temporary access was revoked and protection unchanged.
- v0.32.2 deployment stopped before creating a deployment: exact artifact `12286895853` uses blocked `productionresultssa5.blob.core.windows.net`. An additive environment draft is saved; publication is required. No local rebuild substitution. Evidence: #1027 comment 6293773081.
- Task `codex/1027-supabase-recovery-email-20261020` refines the same core feature. PATCH 0.32.3 checked against 225 stable/integration branches without collision; dev 0.36.3/main 0.29.1 still require later promotion reconciliation.
- No Production, real-user migration, dev/main promotion or 1.0. Keep #1027/#967 open; Diary #1029 follows core release. Scratch Appwrite is suspended; Oracle remains unprovisioned. Do not repeatedly request unavailable keys.

## Implementation
- Separate email routes never mount the ordinary Auth provider or core writers. URL fragments are removed before startup and on repeated same-document navigation; a new link remounts the action and stale replies cannot clear it.
- Explicit verification exchanges a one-time hash and checks the signed Auth user before showing its email. Password update rechecks the owner; completion revokes only the link session. No active-account replacement or token persistence. Appwrite callbacks retain their flow.
- Signup/recovery requests supply exact callback paths. The hosted policy helper prepares the isolated site/redirects/templates, preserves confirmation and unrelated settings, and verifies readback. No hosted Auth policy was changed in this task.
- Generated-link browser runner restricts admin generation to exact server-marked disposable users, removes secrets from child diagnostics, and verifies fixture retirement even after failure. Local CLI CI skips these two hosted-only email cases; its existing five core cases remain.

## Evidence and limits
- 64 related Auth/browser-session/DOM/safety/documentation tests passed across scoped runs. TypeScript, changed-file lint, contracts/discovery, Supabase build/PWA and blocking sizes passed. Light/Dark/Black/System screenshots and computed text/control contrast passed at mobile viewport; physical mobile is separate. Remote focused/lab and deployed acceptance remain pending.
- Real hosted run `f8d80f40899fefe5742ec2ec` passed confirmation and recovery, preserved another active account, rejected the old password and used links, and signed in the target through actual Mosaic UI. Both users retired; zero live rows.
- Initial run `d160fd0ff3ecf188b8075ab0` passed confirmation/login but failed same-document replay navigation; both users retired. The URL callback lifecycle was repaired and the hosted rerun passed.
- Generated links use admin-prepared accounts and do not prove public signup or actual mail delivery. Hosted policy still has localhost redirect/no custom SMTP/two emails per hour. Actual controlled-mailbox acceptance, template rollout and physical Android/iOS remain mandatory.
- Only backend is mosaic-dev `hcxtiifzxoaflhjgoglb`; migrations are already installed. Never rerun `--apply-empty-project`. No temporary automation credential is outstanding.

## Next action
- Finish the coherent focused email task and PR; update issue evidence without a status-only post-green source commit. Keep it separate from the v0.32.2 delivery.
- After publication, deploy d3610222 from exact stable artifact #39468574342 and run all three deployed core cases with approved temporary access, then revoke/read back.
- Only then squash the green email task, require new stable canonical/lab acceptance, deliver its exact artifact with matching email-policy readback, and verify deployed core/email behavior.
- Remaining MVP: actual signup/mail delivery, existing-user mapping and old Appwrite PWA cutoff, reversible three-installation transfers preserving pending edits/tombstones/revisions, encrypted restore, physical mobile, and discard-device/use-cloud conflict choice.
- Operator logs/deployment helpers are under `/workspace/mosaic-preview-operations/`; the issue checkpoint is the durable live status.
