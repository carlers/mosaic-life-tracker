# Session checkpoint

Updated: 2026-10-06
Current task: Double-check/harden the accepted Appwrite backend change-control foundation on task branch `chatgpt/appwrite-version-control-double-check`, targeting protected Preview `refactor/appwrite-version-control-audit`.
Status: The re-audit found and fixed several real holes: stale handoff state; drift checks that missed unexpected managed columns/indexes and Function variables; incorrect DR variable secrecy classification; three intentional pre-foundation tables that were not explicitly modeled; and eight old scripts that still embedded the production project ID outside the new confirmation guard. Focused CI initially caught one stale table-name test fixture; that fixture was corrected and the next focused run passed. A read-only live Appwrite comparison then found one additional real production drift: `task_images` still has bucket-wide authenticated-user read access even though Mosaic already grants intended reads per file. Appwrite documents bucket and file permissions as additive, so that bucket grant bypasses file-security restrictions. Live inventory showed 134 files: 132 already have per-file authenticated-user read; the two owner-only legacy files are unreferenced by current tasks/profiles. The repository now includes an explicit idempotent `003-task-images-bucket-permissions` reconciliation, plus recovery-drill-aware status handling. Production Appwrite remains read-only and unchanged during this task.
Next action: Commit the final hardening patch, run focused verification, fix any failures, then merge the exact accepted tree to protected `refactor/appwrite-version-control-audit` through PR and require the stable full canonical gate plus READY Vercel Preview. The production bucket permission migration is intentionally not applied until an explicit production rollout is authorized. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Backend workflow decisions

1. **No permanent cloud staging project.** Use local isolation where sufficient and `My first project` as the disposable Cloud scratch/DR project when real Appwrite behavior is required.
2. **Git remains authoritative for managed state.** The manifest owns active database/table/bucket shape; Function configs own structural/variable contracts; known pre-foundation placeholder tables are explicitly tolerated but not provisioned fresh.
3. **Mutations fail closed.** Current migration/deploy/activate entry points require matching `--project` and `--confirm-project`; pre-foundation production-hardcoded one-offs are retired from the active tree.
4. **Status is the environment preflight.** It checks exact declared managed columns/indexes, bucket/Function structure, live deployment presence, and declared Function variable presence/secrecy without exposing secret values. `--recovery-drill` models the credential-less isolated restore topology; remote schedules/VCS linkage remain operational and reported.
5. **Function deploy and activation remain separate.** Exact clean `HEAD` source builds inactive; activation is explicit and verified.
6. **Migration history has a baseline.** Fresh forks bootstrap current state; the numbered runner owns changes from the backend-change-control baseline forward. Migration `003` captures the one live bucket-permission drift found during acceptance rather than normalizing Git to a weaker production setting.
7. **Storage read access stays file-scoped.** Bucket-level `read("users")` defeats file security because Appwrite grants access through either bucket or file permissions. Mosaic keeps only bucket-level create and uses per-file read/update/delete permissions.
8. **Build identity stays outside hashed app chunks.** The prior Vercel-size fix remains accepted; no bundle ceiling was raised.

## Delivery boundary

This follow-up changes repository tooling/docs/tests only. It must not mutate Appwrite Cloud resources, schema, Function deployments/activation, schedules, secrets, bucket permissions, or project state during acceptance. The new bucket migration exists for a later explicit rollout.
