# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 eliminate unsupported core-only AuthProvider background side effects without changing shipped Appwrite behavior.

## Baseline and safety
- Previously accepted isolated Preview: `refactor/1027-core-two-domain-20261019@09dbbfc8b8fd460bfd01f75fd0aaea1c70bf7fd6`; full canonical #39367657759, signed lab #39367657766, trusted delivery #39367821057 all SUCCESS. Source-only signed Supabase Auth / task/category RxDB pilots not wired into the shipped app.
- Current task branch: `chatgpt/1027-core-auth-side-effects-20261020`, based on that exact accepted isolated Preview. No `dev`/`main`/Production/hosted Supabase changes or authorized provider migration. Existing user data and reversible Appwrite/OCI return remain mandatory.

## Change
- In `src/hooks/AuthProvider.tsx`, gate shared-task background queue scope/flush on `hasCapability('sharedTasks')` and push owner registration on `hasCapability('alerts')`. Disable the eight-domain Appwrite `initializeSync` startup when `MOSAIC_FEATURE_PROFILE !== 'full'`; never claim this is working Supabase sync. Keep all default `full` behavior and owner cache cleanup unchanged.
- Add `tests/react/AuthProviderCoreOnly.test.tsx` using a seeded owner with online/offline synthetic connectivity. Assert disabled paths do not dispatch sharing, push or Appwrite sync. Do not delete cache/drafts.
- Describe the gap precisely in `docs/CORE_MVP_PROVIDER_RETURN.md`. Actual provider-aware auth, session persistence/identity, hosted ACL review, writer/old-client fencing, two-domain app lifecycle, backup/rollback/DR, devices and Diary sequencing remain outstanding.

## Verification
- A new scoped commit requests focused CI. No local npm, browser verification, stable full gate, trusted Preview delivery or real backend write is claimed yet. Previous signed lab #39367657766 proves the isolated candidate only.

## Next action
- Review exact task focused CI; repair any failures without weakening coverage. After green, squash via PR to a NEW isolated stable Preview and verify full canonical gate and trusted prebuilt READY for the resulting SHA; no `dev` or `main` promotion.
- Then implement real Supabase app Auth/session, signed identity migration, single writer and task/category bootstrap with recovery/rollback validation; keep #967/#1027/#975 open and prioritize Diary #1029 immediately following usable core release.
