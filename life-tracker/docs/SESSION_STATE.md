# Session checkpoint

Updated: 2026-10-06
Current task: Appwrite backend version-control/workflow foundation targeting stable Preview `refactor/appwrite-version-control-audit`.
Status: The backend foundation is implemented and repository verification is green through the initial stable Preview. Vercel exposed that deployment-specific Git metadata in hashed JavaScript could trip the size guard; commit `0d992e53` moved that identity into `index.html` metadata without raising budgets. Its Vercel build then remained only 17 gzip bytes over because the first defensive runtime metadata parser itself consumed the recovered margin. The current follow-up keeps the same build-info contract but reduces that parser to the minimum required for build-controlled metadata. The final stable CI also hit one unrelated existing task-drag browser flake (21/22 tests passed in the shard); the failed job was rerun before any product-code diagnosis. Production Appwrite remains untouched.
Next action: Focused-verify the compact build-info parser, merge it to protected stable Preview through PR, then require a green full canonical gate and READY Vercel Preview. After delivery is green, perform a read-only live Appwrite sanity check and hand off. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Backend workflow decisions

1. **No permanent cloud staging project.** Normal work keeps its existing workflow. Risky Appwrite integration/schema work uses local isolation where sufficient or the existing `My first project` scratch project when real Cloud behavior is required.
2. **Git remains authoritative.** `infrastructure/mosaic-backend.mjs` owns fresh managed data/storage shape; per-Function configs own portable Function structure; `appwrite.config.json` is the production CLI target/overlay; ordered migrations evolve existing projects.
3. **Mutations fail closed.** New migration/deploy/activate tooling requires `--project <id>` and matching `--confirm-project <id>` even when environment variables are present.
4. **Function deploy and activation are separate.** Deployment packages must match clean Function source at the supplied `HEAD` SHA, build inactive, and report the SHA/deployment mapping. Activation is a separate explicit command and verifies the active deployment ID.
5. **Migration ledger deferred.** Existing migrations are idempotent, so the unified runner safely reconciles them in numbered order without adding another Appwrite table. Add a new numbered migration for future schema changes.
6. **Build identity must not invalidate app chunks.** Hosted Git SHA/branch/message/time remain user-visible diagnostics, but live in HTML metadata rather than hashed JavaScript.

## Delivery boundary

This task changes repository tooling/docs/tests and build-metadata placement only. No Appwrite Cloud resource, schema, Function deployment, Function activation, schedule, secret, or project state should change during acceptance.
