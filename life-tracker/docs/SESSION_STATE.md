# Session checkpoint

Updated: 2026-10-12
Current task: #645 — Speed up fresh-chat-to-Preview delivery (Phase 1).

## Objective and isolation
- User approved implementation of issue #645 after hardened plan. First batch fixes unnecessarily broad focused Vitest when a Preview version stamp changes only package version metadata.
- Base dev: `48005f0f9327a0ac5d028f2615034a5e2c1ed80f`, version v0.17.9. Task: `chatgpt/focused-version-stamps-645`. Stable Preview: `refactor/focused-version-stamps-645`. Product version impact NONE.
- `scripts/lib/focused-verification.mjs` compares entire parsed previous/current package JSON after normalizing only root version (and lockfile `packages[""].version`); missing/ambiguous/malformed/unrelated changes stay broad. `scripts/verify-focused.mjs` reads exact Git base and HEAD blobs before selecting tests.
- Regression tests cover version-only metadata, lockfile dependency drift, malformed/missing evidence, unchanged/version-inconsistent data, mixed frontend + docs changes, and retained config broad triggers. All standard contracts, doc checks and full stable Preview canonical gates remain.
- No Appwrite/config changes, no auto-merge, and no dev/main promotion authorization. #592/#506/#412 scopes remain separate.

## Next action
- Verify the coherent task commit with `[verify:focused]`; investigate any failures before PR squash.
- Squash accepted task PR into stable Preview, then verify exact-source canonical GitHub CI and Vercel READY.
- Add issue #645 evidence/checkpoint; measure subsequent comparable tasks before designing optional Phase 2 shortcuts. A later unattended task-PR squash mechanism is explicitly conditional on actual measured benefit.
- Keep dev and main unchanged until separately authorized.
