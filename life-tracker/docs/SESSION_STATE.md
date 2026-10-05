# Session checkpoint

Updated: 2026-10-05
Current task: Appwrite backend version-control/workflow foundation on task branch `chatgpt/appwrite-version-control-foundation`, targeting stable Preview `refactor/appwrite-version-control-audit`.
Status: Investigation confirmed Git already contains Function source, portable backend manifest, bootstrap tooling, and idempotent migrations, while live production deployments are manual and have no Git/VCS provenance. The implementation standardizes that existing foundation without adding permanent staging: read-only managed-state drift/status tooling, one ordered migration runner, exact-HEAD inactive Function deployment plus explicit activation, project-ID confirmation guards on every new mutation command, and a documented policy that `My first project` remains the disposable scratch/DR project. Production Appwrite has not been mutated by this task.
Next action: Run focused verification for the coherent task commit, fix any failures, squash the accepted task tree into `refactor/appwrite-version-control-audit`, then require the stable Preview canonical gate/delivery. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Backend workflow decisions

1. **No permanent cloud staging project.** Normal work keeps its existing workflow. Risky Appwrite integration/schema work uses local isolation where sufficient or the existing `My first project` scratch project when real Cloud behavior is required.
2. **Git remains authoritative.** `infrastructure/mosaic-backend.mjs` owns fresh managed data/storage shape; per-Function configs own portable Function structure; `appwrite.config.json` is the production CLI target/overlay; ordered migrations evolve existing projects.
3. **Mutations fail closed.** New migration/deploy/activate tooling requires `--project <id>` and matching `--confirm-project <id>` even when environment variables are present.
4. **Function deploy and activation are separate.** Deployment packages must match clean Function source at the supplied `HEAD` SHA, build inactive, and report the SHA/deployment mapping. Activation is a separate explicit command and verifies the active deployment ID.
5. **Migration ledger deferred.** Existing migrations are idempotent, so the unified runner safely reconciles them in numbered order without adding another Appwrite table. Add a new numbered migration for future schema changes.

## Delivery boundary

This task changes repository tooling/docs/tests only. No Appwrite Cloud resource, schema, Function deployment, Function activation, schedule, secret, or project state should change during acceptance. Stable Preview receives the normal full gate after the focused task branch is green.
