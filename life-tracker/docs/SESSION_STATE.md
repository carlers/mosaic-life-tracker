# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1027 repair direct cold-navigation 404 for Supabase email confirmation.

## Source and safety
- Isolated accepted baseline `feature/1027-supabase-recovery-20261020@faa4649b9f60174205c89f9c1064fa02269d7789`, v0.32.3; Quality Gate #39545036549 and Supabase Core App Lab #39545036568 SUCCESS; signed CI artifact #12320933249 with 178 verified static files.
- Immutable Vercel Preview `dpl_8SQCLXk2NG6JAbPtTQ8J3eWgfC5r` READY at `https://mosaic-life-tracker-a52pfxk0n-carls-projects-72516fde.vercel.app`. Protected alias `mosaic-supabase-core-preview.vercel.app` still points to older READY `dpl_CSBQtqBXqz2naXLx3bS73rE4UTAR`. User reproduced private/incognito cold 404 at `/auth/confirm` while `/reset-password` worked. No credentials, provider policy, real accounts or Production/dev/main changed.
- Vercel project Root Directory `life-tracker`, SSO enabled. Appwrite Scratch suspended; OCI VM not provisioned.

## Implemented in current task branch
- Root cause: React `RootAuthProvider` recognizes `/auth/confirm`, but `vercel.json` and strict Build Output API v3 route generator omit that deep-link rewrite; cached PWA navigation masked missing server fallback.
- Add the exact `/auth/confirm` SPA rewrite; update strict prebuilt route counts 15 → 16 without relaxing headers or filesystem handling; assert both email routes and unmatched paths in routing tests. Set next user-testable Preview revision `0.32.4` in all three version fields. Email token/auth code unchanged.
- Main-owned trusted generic Appwrite prebuilt writer retains its independent reviewed routing fingerprint; no relaxation of that trust boundary. Isolated Supabase staging independently verifies route digest at the new exact source SHA.

## Verification
- Focused task CI `[verify:focused]`; squash PR into isolated stable `feature/1027-supabase-recovery-20261020`; require new exact-SHA full Quality Gate and signed Supabase Core App Lab/artifact. Old v0.32.3 CI evidence and deployed bytes do **not** accept corrected route.

## Next action
- Assemble new verified prebuilt, deploy only immutable protected Preview with operator gating; never move alias/Production without acceptance. Browser incognito HTTP navigation to `/auth/confirm` and `/reset-password`, then hosted disposable Auth/core/email-code tests, safe isolated email template readback, controlled SMTP, physical PWA remain.
- Supabase security review: three intentionally authenticated privileged SECURITY DEFINER RPC Advisor warnings; disabled leaked-password protection. Existing-user Appwrite writer fencing, owner mapping, tombstones and reversible DR remain separate release work. Keep #1027/#967 open; Diary #1029 after core.
