# Session checkpoint

Updated: 2026-10-06
Current task: Double-check/harden the accepted Appwrite backend change-control foundation on task branch `chatgpt/appwrite-version-control-double-check`, targeting protected Preview `refactor/appwrite-version-control-audit`.
Status: Re-audit found real follow-up holes despite the prior green Preview: the checkpoint was stale; drift checking allowed unexpected managed columns/indexes and ignored Function variables; DR config incorrectly classified public R2 routing identifiers as secrets; three intentional empty pre-foundation tables were not explicitly modeled; and eight historical scripts still embedded the production project ID outside the new confirmation guard. The follow-up tightens managed-state comparison, versions the tolerated legacy-table inventory, aligns DR variable secrecy/bootstrap behavior with live production, adds regressions preventing executable scripts from embedding the production project ID, retires the obsolete one-off scripts, and updates migration documentation to the numbered post-baseline workflow. Production Appwrite remains read-only and unchanged.
Next action: Finish the coherent follow-up patch, run focused verification, fix any failures, then merge the exact accepted tree to protected `refactor/appwrite-version-control-audit` through PR and require the stable full canonical gate plus READY Vercel Preview. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Backend workflow decisions

1. **No permanent cloud staging project.** Use local isolation where sufficient and `My first project` as the disposable Cloud scratch/DR project when real Appwrite behavior is required.
2. **Git remains authoritative for managed state.** The manifest owns active database/table/bucket shape; Function configs own structural/variable contracts; known pre-foundation placeholder tables are explicitly tolerated but not provisioned fresh.
3. **Mutations fail closed.** Current migration/deploy/activate entry points require matching `--project` and `--confirm-project`; pre-foundation production-hardcoded one-offs are retired from the active tree.
4. **Status is the environment preflight.** It checks exact declared managed columns/indexes, bucket/Function structure, live deployment presence, and declared Function variable presence/secrecy without exposing secret values. Remote schedules/VCS linkage remain operational and reported.
5. **Function deploy and activation remain separate.** Exact clean `HEAD` source builds inactive; activation is explicit and verified.
6. **Migration history has a baseline.** Fresh forks bootstrap current state; the numbered runner owns changes from the backend-change-control baseline forward rather than replaying every historical Console/script mutation.
7. **Build identity stays outside hashed app chunks.** The prior Vercel-size fix remains accepted; no bundle ceiling was raised.

## Delivery boundary

This follow-up changes repository tooling/docs/tests only. It must not mutate Appwrite Cloud resources, schema, Function deployments/activation, schedules, secrets, or project state during acceptance.
