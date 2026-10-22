# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1250 protected Supabase Preview deployment and ZIP/TodoMate emergency recovery.

## Source of truth
- Isolated `feature/1027-supabase-recovery-20261020@710cbbd6`, version 0.44.0. Previously all four canonical CI workflows passed on `c000c42d`; Production, dev and main untouched. User configured GitHub protected Preview environment and Vercel token.
- The trusted historical Appwrite Oct 18 R2 backup has five eligible owners, 2,361 retained rows and 121 files after privacy deletion filtering; live source delta and old PWA server-side writer fence are still unavailable.
- Legacy Mosaic ZIP/JSON Merge and confirmed TodoMate task/category Replace are implemented for signed Supabase core candidate. Keep original PWA ZIP; photos, settings, Bucket List and social are not certified synced. No real-user migration or approved Production release.
- PR #1261 fixed Vercel CLI missing explicit protected `--token` and authenticated same-run CI artifact reruns. No Vercel READY yet.
- Current PR #1264 (replacement of stale PR #1263) addresses **external** Docker registry `toomanyrequests` failures during disposable Supabase image pulls by bounded retries on both local `supabase start` calls (at most three attempts; fail closed; all database/RLS/browser gates preserved). Focused CI must pass for the current PR head before merge; do not treat the prior failed check as acceptance.

## Next action
- Merge #1263 into isolated recovery branch after focused success. Verify Quality, Core App, Synthetic Restore and Real GoTrue workflows on exact merged SHA, then the protected Preview approval, Vercel CLI deployment and immutable READY/project/backend/SHA/artifact readback.
- If environment reviewer approval is required, ask only for that GitHub protected decision; this connector cannot approve deployments. Do not remove reviewer/CI gates merely for speed. Do not touch dev/main/Production, aliases, live accounts or personal ZIP.
- After a verified Preview URL, rehearse signed disposable ZIP Merge → TodoMate Replace, two-device RLS and offline sync. Legacy owner mapping, complete data parity, photo storage and Appwrite writer fencing remain blockers to real-user/public cutover.
