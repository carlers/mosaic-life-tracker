# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1027 verify exact Supabase CI-artifact prebuilt staging.

## Source and safety
- Accepted isolated baseline `feature/1027-supabase-recovery-20261020@277252bd8ac551934e3fb9fd9e75b911de770fac`, v0.32.3. Canonical Quality Gate #39541536470 and signed disposable Supabase lab #39541536518 SUCCESS. Artifact #12319758414, GitHub-reported ZIP SHA256 `b861bc9a496d2d0e50d82175e297954441da99d4a836e47647b6715d7e411aea`; 178 static files verified.
- Deployed isolated alias `mosaic-supabase-core-preview.vercel.app` still points to protected older READY `dpl_CSBQtqBXqz2naXLx3bS73rE4UTAR`; no current v0.32.3 deployed proof. Preserve Production/dev/main, existing user data, original Appwrite support, external credentials and registered SSO/aliases. Appwrite Scratch suspended; OCI VM not provisioned.
- Original Codex operator VM expired. Reconstructed credential-free OTP email templates/code-entry UI in PRs #1141/#1142/#1144; historical hosted-code evidence was from *different* source, so not acceptance for current SHA.

## Implemented
- Task `chatgpt/1027-verify-prebuilt-staging-20261021` adds an exact-SHA disposable CI execution of the previously accepted `scripts/stage-supabase-core-artifact.mjs` after building the isolated Supabase public-input ZIP.
- Assert Vercel v3 static files and `STAGED_NOT_DEPLOYED` marker; negative checks forbid digest mismatch and overwrite. Job never rebuilds after staging, contacts Vercel, changes email policies or passes cloud secrets. Local ZIP digest tests mechanics only; separate operator must verify GitHub-reported artifact digest and both gates.
- No user-visible version impact; keep version v0.32.3.

## Verification
- Focused task, then stable full canonical plus signed Supabase lab and fresh exact SHA-bound artifact required. Never reuse earlier SHA evidence for new source.
- Hosted RLS: task/category policies constrain `auth.uid()`; privileged CAS/core session functions have owner/session checks, empty search_path and revoked anonymous EXECUTE. Security Advisor still reports intentionally authenticated-executable SECURITY DEFINER RPCs and disabled leaked-password protection. Final security signoff pending.

## Next action
- Repair actual focused/lab failures, squash to isolated Preview, verify exact source and artifact.
- Fresh-account beta still needs trusted external immutable Vercel prebuilt delivery, clean hosted Auth email template readback, 3 deployed core + 2 hosted OTP tests, real SMTP/mailbox delivery and physical PWA acceptance. Never use unsafe old hash-token email links or bypass Vercel SSO.
- Existing-user release additionally needs server Appwrite legacy-PWA writer cutoff, verified owner mapping, three-provider reversible changes/tombstones/pending offline edits, encrypted DR and restore. No Production or user migration without approval; Diary #1029 after core. Keep #1027/#967/#975/#1026 open.
