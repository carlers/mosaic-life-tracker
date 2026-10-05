# Session checkpoint

Updated: 2026-10-06
Current task: Appwrite backend version-control/workflow foundation targeting stable Preview `refactor/appwrite-version-control-audit`.
Status: The initial backend foundation task commit `5168269e` passed focused verification and was squashed to stable Preview as `97a4e38b`; the full canonical GitHub gate passed. Vercel then exposed an unrelated delivery-edge bug in the existing build-size guard: deployment-specific branch/commit-message metadata was injected into hashed JavaScript, so the backend-only commit changed bundle compression enough to exceed the aggregate gzip ceiling by 14 bytes. The follow-up task fix keeps the complete build identity but emits it in `index.html` metadata instead of Vite define replacements, preventing arbitrary Git metadata from perturbing hashed JS/PWA chunks or bundle-size measurements. Production Appwrite remains untouched.
Next action: Focused-verify the metadata-isolation fix, squash the final accepted task tree onto `refactor/appwrite-version-control-audit`, then require a green full canonical gate and READY Vercel Preview. After delivery is green, perform a read-only live Appwrite sanity check and hand off. Do not promote to `dev` or `main` without explicit user instruction.
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
