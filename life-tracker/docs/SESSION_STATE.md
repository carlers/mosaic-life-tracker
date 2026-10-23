# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1029 deliver Supabase owner-private Diary on the reconciled isolated Preview before user device testing.

## Exact baseline, scopes
- Base for this task: signed Diary-focused PR #1274 head `b2ab7c810a9e929845921959049e852af3e28897`, based on isolated feature `feature/1027-supabase-recovery-20261020@dcf685b91645efca2402295d3a20fbc319929e2d`. Four canonical v0.44.1 runs successful; protected Vercel immutable READY at `https://mosaic-life-tracker-yz0y7gr7h-carls-projects-72516fde.vercel.app`, build `core-only`. `dev@ebc8614` and `main@c938c825` untouched.
- New candidate `chatgpt/1029-core-diary-preview-v0450-20261023` version **v0.45.0**, changes only isolated Preview artifact from `core-only` to `core-diary` and guards its exact-SHA evidence. Existing Appwrite Production `full` untouched. Client already implements private-only Diary, no social/photos, and native 3-domain RxDB.
- Disposable signed Diary SQL/RLS/CAS owner boundary test passed in [Core Lab #39904216588](https://github.com/carlers/mosaic-life-tracker/actions/runs/39904216588) `core-app` job. Hosted-artifact stage failed because verification-only branch was intentionally not allowed by protected artifact rules; no Preview deployment.

## Backend hard gate
- Read-only Supabase inspection `hcxtiifzxoaflhjgoglb`: hosted has NO `public.mosaic_candidate_diary` table/migrations. Existing locally verified disposable additive SQL `20261022_candidate_private_diary_domain.sql` and `..._realtime.sql`; do NOT flip hosted UI until its migrations reviewed and applied in order.
- Before hosted DDL, obtain **current encrypted offsite snapshot** and independent restore of fresh Auth identities, tasks/categories, active sessions and configuration/Storage scope; 2026-10-22 historical encrypted core six-table backup is stale; no current independent hosted DR proof. Existing operator scripts `supabase-poc/hosted-encrypted-backup.sh` and `run-private-core-recovery.sh` cover only part of that and must not be misrepresented as full DR.
- Supabase advisory flags four private schema tables without RLS; direct catalog grants show `anon`/`authenticated` have neither schema USAGE nor table SELECT/INSERT/UPDATE. Must review defense in depth, not blindly change server-owned tables.
- No dev/main/Production or hosted data writes, no Expo/media/social rollout, no one-click provider migration. Protected exact-SHA GitHub environment approval is still mandatory for the *new* v0.45.0 artifact.

## Implementation, verification, next
- Candidate changes built artifact contract to `core-diary`, embedded profile checks, version 0.45.0, Playwright signed real UI fixture with owner/private save and device/foreign-owner checks; local signed lab rebuilds core-diary on disposable DB and runs this browser test.
- Run focused Quality task CI, fix legitimate test/UI failures, then after reviewed fresh hosted snapshot/restoration and additive migration, squash isolated Preview task, run four exact-SHA canonical labs, approve protected deployment, verify immutable Vercel READY with `core-diary`, perform manual mobile two-owner/offline acceptance before using real user data.
