# Session checkpoint

Updated: 2026-10-10
Current task: issue #406 shared tasks, version 0.14.0. dev remains at 224f8a700f35bbe3853206ee208e1dc103ece5b3; main not promoted.

## Verified Preview baseline
- Stable Preview `feature/shared-tasks` SHA `48232bbf72a66e317ced475acab0b8c0578269b1`. Full canonical Actions 38038260964 succeeded on attempt 2, Vercel exact-SHA READY.
- Server-owned task-sharing / optimistic owner completion, private projection and membership, offline queues, UI, owner-pending receipts and safeguards are implemented. See issue #406 and PROJECT_REFERENCE §24.14.
- Live Scratch `6a96e82d000d1310b3be`: explicit Git-owned migration 008 hardened friendship table permissions and migration 007 created private task_shares; readback verified. Exact reviewed Function deployment `6ac9fbd7d43a5f48f949` is READY and activated. A real unauthenticated invocation selected it and returned 401. Production untouched.
- Scratch read-only readiness still reports `function message-action has no live deployment`: Appwrite `live:false` despite matching active deployment ID and successful execution. Do not relax this invariant or claim readiness. Stable Preview branch alias CORS returned matching Access-Control-Allow-Origin via existing wildcard; Appwrite Free plan prevented adding another exact Web-platform hostname.

## Current task
The previous two-user scratch seeder was not valid for shared-task acceptance: it generated profile rows keyed by raw user ID and friendship rows under `fixture_friend_`, while the trusted Function requires `profile_<id>` and canonical hashed `fr_` IDs. Existing dummy profiles have unique user indexes, so silently adding corrected profiles under the same IDs cannot work. The new seed uses three distinct synthetic identities and compatible canonical rows, adds a second mutually accepted collaborator, restricts friendship row permissions to read-only, and leaves earlier fixtures untouched. Regression covers canonical IDs and permissions. No changes to production app behavior or user-facing version.

## Verification
Before task commit, the new fixture regression failed against the old seeder and then passed after the correction: `tests/unit/appwritePreviewSeed.test.ts` 4/4, `contracts:check` green and scoped ESLint/diff check green. Final focused task CI and stable Preview canonical/READY remain to be completed for this repair.

## Next action
Commit fixture repair + this checkpoint on `chatgpt/**` based on current stable Preview, run focused CI, squash via PR to `feature/shared-tasks`, then canonical CI/Vercel. Reseed approved new Scratch fixtures through scoped Git CLI, investigate Appwrite `live:false`, and perform real authenticated three-account completion/privacy/revocation/CAS/offline and device acceptance as available. Never promote to dev/main without explicit separate approval. Keep issue #406 open.
