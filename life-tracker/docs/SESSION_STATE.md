# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1250 protected Supabase Preview: repair Vercel CLI staged root-directory mismatch.

## Accepted baseline
- Isolated `feature/1027-supabase-recovery-20261020@cd9e5bb3b7e374ceb666b9ab87ef5c2cacfc9bcf`, v0.44.0; no dev/main/Production promotion.
- All four exact-SHA workflows succeeded: Quality #39822945997, Synthetic Restore #39822945931, Real GoTrue #39822946104 attempt 2, and Core App #39822945936 attempt 2. Core artifact staging and integrity succeeded (179 static files).
- User approved the protected environment for Core run #39822945936 attempt 2. Deployment job 120187731983 FAILED before upload: Vercel CLI requested staged `life-tracker/` matching the project's configured Git rootDirectory, but that directory was absent. No matching Vercel deployment or READY URL.
- Original Mosaic ZIP/JSON and confirmed TodoMate task/category import are supported in the isolated candidate; photos/settings/Bucket List/social not certified synced. Preserve original personal ZIP. Historical Appwrite source delta and old PWA server writer fence remain unavailable.

## Scoped repair
- In the protected Preview publish step, verify prebuilt `.vercel/output/config.json` and fixed project link, require `life-tracker/` absent, create only an empty temporary `life-tracker/` for Vercel CLI rootDirectory validation, then deploy unchanged authenticated prebuilt bytes.
- No relaxing Quality/Core/GoTrue/restore tests, provenance SHA/digest checks, protected approval, Vercel READY validation or isolation. No remote project settings, aliases, hosted database/users, dev/main/Production writes. Version impact NONE.

## Next action
- Focused Quality Gate for task `chatgpt/1250-vercel-rootdir-prebuilt-20261023`; review diff and squash only to isolated Supabase recovery branch once green. On the new merged SHA, require Quality, Core App, Synthetic Restore and Real GoTrue successes and authenticated artifact proof.
- Protected `mosaic-supabase-preview` reviewer must approve the new run. Check exact immutable Vercel Preview READY/project/SHA/backend/digest and report URL. Then signed disposable ZIP Merge → TodoMate Replace and two-device RLS/offline tests; no real-user cutover or Production approval.
