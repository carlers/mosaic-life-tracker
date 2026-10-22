# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 add real local GoTrue password/account restore acceptance without owner machine or credentials.

## Verified baseline
- Stable isolated Supabase feature/1027-supabase-recovery-20261020@b78efc6504a8747e6c697f83d68c43a2bcf0ef9f: full Quality Gate #39730798206, signed Core App Lab #39730798225 and nine-table Synthetic Restore Lab #39730798205 all SUCCESS.
- Credential-free Vercel synthetic archive rehearsal passed on PostgreSQL 18. The synthetic GitHub lab now fails absent auth.identities or owner authority/revisions and restores nine fake-data tables.
- Read-only hosted mosaic-dev audit: ACTIVE_HEALTHY with 81 users, including 78 marked/banned/frozen disposable users and 3 unmarked; 81 auth.identities, 184 auth.sessions, 58 tasks (9 live), 53 categories (1 live), 49 owner revisions, 81 core authorities (78 frozen), 0 Storage buckets/objects. No hosted Diary/retired_on migration; tasks/categories have RLS and anonymous denial. Privileged signed RPC advisor and leaked-password warnings remain.
- Original private Fedora snapshot and age identity unavailable to connected tools. Exact live-data/identity recovery is unverified. Do not clean up hosted rows, expose secrets or claim release readiness.

## Task
- Introduce a separate disposable CI lab using real GoTrue (not stubbed Auth) on an isolated local Supabase CLI stack. Seed an actual password owner, sign category/task, encrypt and authenticate an archive, local schema reset, allowlisted data-only restore, fresh password sign-in, stable canonical owner and revisions, deny old token authority and foreign owner access.
- Use generated credentials, no hosted/Auth policy writes. Run task focused Quality Gate and own new real-auth restore lab before isolated Preview squash; require exact-sha full Quality Gate + signed Core App Lab + synthetic restore + real GoTrue restore after squash. No version impact.

## Next action
- Repair any genuine CI failures without weakening checks; merge only into isolated Supabase candidate on successful task checks, then verify all exact-SHA stable checks and update #1027.
- Owner followup when Fedora accessible: privately run read-only TOC inspection per supabase-poc/RESTORE_TOC.md and share only sanitized JSON. Then separately verify real encrypted hosted snapshot restoration into independently initialized disposable Supabase with signed-account/password/data/RLS/role checks. Never send backup or private key to chat/GitHub/Vercel.
- Hosted Diary/retirement migration, public signup, exact deployed browser/physical devices, old-PWA compatibility, remaining security and Production release/branch promotion remain separately gated; keep #1027/#1029/#857 open.