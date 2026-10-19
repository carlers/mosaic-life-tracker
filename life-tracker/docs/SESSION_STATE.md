# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 combine authentic local Supabase signed HTTP and RxDB browser/IndexedDB replication.

## Verified base
- Accepted isolated Preview `refactor/967-rxdb-dexie-restart-20261019@5970a70ba4f732685ac3c8ec504aec41e98a73c4`, canonical #39195705350 and trusted READY #39195885233 SUCCESS; PR #1000 merged. Issue #967 OPEN.
- Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged. No Supabase hosted accounts/schema/data or Appwrite/Production configuration modified; still two hosted `authenticated_security_definer_function_executable` WARNs.
- Separate earlier real signed local Auth/CAS lab #39192772712 SUCCESS and browser Dexie/IndexedDB synthetic-remote persistence test #39195480777 SUCCESS. Combined HTTP + browser proof previously absent.

## Current task
- Task branch `chatgpt/967-signed-rxdb-http-20261019` from exact isolated accepted source, no shipped runtime change or app version bump.
- Add localhost-only signed browser fixture `tests/e2e/supabase-signed-rxdb.{html,ts,spec.mjs}` that uses RxDB Dexie/IndexedDB with actual candidate HTTP pull/create/master/CAS transports and server-verified Supabase Auth sessions (two disposable password users, no elevated API key).
- Add dedicated ephemeral local Supabase + Chromium GitHub Actions workflow `.github/workflows/supabase-signed-rxdb-browser.yml`. Test fixture runs only when modern local CLI publishable key env is present; normal app browser suite skips it. Use same isolated candidate SQL migrations as previous accepted signed lab.
- Test plan: signed RLS owner reads, initial pull, reopen with server-side additional row (persisted checkpoint), offline draft survives close/reload and reconnect CAS, concurrent independently applied remote revision while offline conservatively preserves both server winner and local pending draft.
- Docs/Supabase evaluation updated with exact limits. The combined lab is **not yet verified**; hosted acceptance not claimed.

## Verification
- Dedicated real local Supabase/Chromium test job and task browser/focused checks pending. Diagnose failures before stable Preview squash. Do not reduce owner/RLS, checkpoint, offline replay or conflict preservation assertions to make CI pass.

## Next action
- Commit coherent task tree with `[verify:browser]`, inspect dedicated ephemeral signed browser lab and repo browser/focused tests, repair failures in batch.
- When task gates pass, squash to fresh isolated stable Preview, run canonical full Quality Gate and trusted CI-first READY; post exact SHA evidence to #967. Keep #967 OPEN.
- Next after this milestone: resolve fail-closed pending conflict UX/retry policy, multi-device/owner switch under real Supabase server, other six domains, hosted signed-user proof, privileged RPC security review, media, DR, cost and reversible cutover. No protected dev/main promotion, Production/backend migration or 1.0 release without separate explicit user approval.
