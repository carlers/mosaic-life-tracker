# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 core-only Supabase MVP — async task/category owner-change local mutation fences.

## Baseline and authorization
- Start from accepted isolated Preview `refactor/1027-core-owner-mutation-20261020@7461153db31fc91835e2a88d202d6892082a6e1b`; PR #1068 merged; full CI #39372122960 and trusted prebuilt #39372284658 recorded SUCCESS/READY in #1027.
- Task branch: `chatgpt/1027-core-async-owner-fence-20261020`. Source-only local ownership defenses; version impact NONE. Appwrite remains shipped; hosted Supabase, user data, OCI, Vercel Production, `dev` and `main` unchanged.
- Do not promote protected branches or enable core-only backend without separate approval. Preserve symmetric Appwrite reverse migration, one-cloud-writer ownership, signed-hosted RLS/CAS and independent DR.

## Change in this task
- `src/hooks/useTasks.ts` and `useCategories.ts` track the currently committed authenticated owner; revoke on unmount. Re-check owner after async reads and before new local patches/inserts in edit, create, move and reorder flows. Old closures and queued drag promises may not mutate after an owner switch.
- `tests/react/coreOwnerMutations.test.tsx`: paused-read owner-switch negative regressions for task/category edit, queued category drag, post-unmount callback and task creation; preserved existing same-owner/foreign owner checks.
- `docs/CORE_MVP_PROVIDER_RETURN.md` documents bounded protection and limits.

## Verification
- Await exact task-SHA focused CI after coherent `[verify:focused]` commit; no tests, canonical Preview, Vercel deployment or signed-hosted acceptance claimed in this task yet.

## Next action
- If focused checks fail, batch corrections. If green, squash into new isolated stable Preview; require exact-tree canonical full, trusted prebuilt READY before calling it accepted.
- Next critical work: app-owned Supabase Auth/session and legacy Appwrite identity mapping, server-side old-PWA/single-writer fencing, real task/category app bootstrap, hosted signed two-owner tests, audited backup + forward/reverse Appwrite import and multi-device offline acceptance. Diary #1029 immediately after working core release; #967/#975 remain open.
