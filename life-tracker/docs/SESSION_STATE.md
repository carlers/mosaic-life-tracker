# Session checkpoint

Updated: 2026-10-10
Current task: issue #406 shared tasks, version 0.14.0. Stable Preview `feature/shared-tasks` at `47118000c4d129489a6184bdcd3bf9a6d96bfda3`; `dev` and `main` have not been authorized for this feature.

## Verified baseline

- Stable Preview exact-SHA [full canonical Actions 38047563899](https://github.com/carlers/mosaic-life-tracker/actions/runs/38047563899) succeeded; Vercel deployment `dpl_CXafqvdxEyRyXjAb9UVkNbFtSxVY` was READY for that SHA.
- Scratch `6a96e82d000d1310b3be`: `task_shares` table exists, `friendships` table permissions are server-controlled. Active `message-action` deployment `6ac9fbd7d43a5f48f949` is READY and has executed requests successfully, but Appwrite returns `live:false`. Function configuration was updated after the active deployment was created; Appwrite documents redeploying after such a change. Do not weaken readiness or claim it green.
- Scratch's corrected three test accounts exist as of 2026-10-10, but test rows had not been seeded when this task branch was started.

## Current repair

The prior `appwrite-preview-seed.mjs` fixture correction used `fixture_cat_`, `fixture_diary_`, `fixture_task_` prefixes on synthetic user IDs. This generates invalid Appwrite row IDs (up to 39 characters; maximum 36). Repair via short deterministic prefixes (`cat_`, `diary_`, `task_`), matching task category references, fail-fast preflight validation, and regression coverage for all row IDs. Preserve canonical `profile_` and hashed `fr_` identifiers and permission behavior. No production backend changes or version bump.

## Verification

Task branch focused Quality Gate is required for this change. Do not claim it passed before reading GitHub Actions. Full canonical CI and exact-SHA Vercel acceptance must run after squash to the stable Preview.

## Next action

Verify this task's focused CI; squash task PR to `feature/shared-tasks` only after green. Re-run canonical and Vercel. Seed the three isolated Scratch accounts using the corrected fixture schema, then verify owner/friend/unrelated auth, privacy, invite, CAS, revocation, retry/queued completion, and Diary through real logins. Rebuild the exact reviewed Function with the current scratch config to resolve `live:false`, check no shared Preview incompatibility, and rerun strict readiness. No `dev`/`main` promotion without separate approval.
