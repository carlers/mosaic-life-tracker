# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1033 disable task completion control during Select mode.

## Boundary
- Base: protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` (v0.29.12); separate accepted #1008 Preview v0.29.13 has an open dev-promotion PR #1031.
- Task branch: `chatgpt/1033-select-mode-checkbox-20261020`, with planned v0.29.14 Preview revision to avoid #1031's v0.29.13.
- Frontend-only change. No backend, schema, Appwrite/Supabase, Vercel configuration, dev/main promotion, or 1.0 release authorized.

## Changes
- Select mode completion circle remains visually unchanged but is aria-disabled and never mutates completion or selection, including nested keyboard events.
- Existing task completion, keyboard editing and row/title/category selection outside this exception remain unchanged.
- Update `tests/components/TaskItemGestures.test.tsx` and `docs/PROJECT_REFERENCE.md` §2 for intentional changed behavior.
- Synchronize `package.json`, `package-lock.json`, and `src/lib/appVersion.ts` for the next user-testable Preview candidate.

## Verification
- GitHub-only changes prepared; no local test run performed.
- Pending coherent task commit with `[verify:focused]`, CI evidence, stable Preview canonical acceptance, Vercel delivery, and manual/device checks.

## Next action
- Finish task changes, request focused CI on exact task SHA; repair failures if needed. After focused success, create/squash PR to `fix/select-mode-checkbox-1033-20261020` and verify canonical Preview CI and deployment. Keep #1033 open; do not promote to `dev` or `main` without separate approval.
