# Appwrite environment roles for concurrent Mosaic development

**Canonical agent routing policy — 2026-11-21.** See [agent rules](../AGENTS.md), [backend workflow](APPWRITE_BACKEND_WORKFLOW.md), [Preview readiness](SCRATCH_PREVIEW_WORKFLOW.md), and [delivery](DELIVERY.md). These roles are based on live Oracle service mappings and Vercel project IDs, **not on legacy product names**. Before any remote write, recheck live IDs and the relevant task's approval.

| Role | Appwrite project ID | Oracle Operations service | Vercel project | Authorized usage |
| --- | --- | --- | --- | --- |
| **Appwrite Preview** | `6ae94a2100014d01f5ed` | `appwrite-preview` | `mosaic-life-tracker` / `prj_jysOLDbuO9c5rP8x6Q145DVIw0fc` | Normal feature branches, stable Vercel Preview testing and `dev`; approved additive backend work |
| **Appwrite Scratch** (dedicated E2EE lab) | `6b00671500279e901846` | `appwrite-scratch-lab`; `mosaic_oracle_e2ee_lab_bootstrap` for bounded provisioning | `mosaic-e2ee-scratch` / `prj_O7svU9O5nN9AkKaCdKkwjud3Gk05` | **Only** the isolated E2EE workstream (#1662 / Oracle #295), synthetic users/data and reviewed E2EE-only operations |
| **Appwrite TEST** | `6ae1bf2e00034572451b` | `appwrite-test` | None | Oracle infrastructure tests; not a normal app Preview or E2EE lab |
| **Appwrite Production** | `6ae9599c002ab812f9c3` | `appwrite-production` | Production environment in `mosaic-life-tracker` | Explicitly authorized Production migrations/releases only |

All four projects use **`https://129-221-244-67.sslip.io/v1`**. **The endpoint alone cannot identify the target project.** Project ID + Vercel project/environment + typed service ID must agree. Vercel Preview build guard in `scripts/lib/preview-backend-isolation.ts` pins the ordinary Preview ID and refuses the Scratch lab; the separate E2EE branch has its own reviewed Vercel-project/branch guard. An isolated project is *not* an isolated Oracle host, database process or disaster-recovery sandbox.

## Parallel agent routing

**Normal feature agent:** Work on the current approved app base and its own task branch. Follow task → stable feature/fix/perf Preview → explicit owner-approved `dev` → explicit owner-approved `main`. For all normal Vercel Preview builds (including `dev`), select **Appwrite Preview**, the existing official Vercel project and its registered stable origin. Before Appwrite reads or authorized writes, select `appwrite-preview`, verify project `6ae94a2100014d01f5ed` and exact feature's schema/Function deployment. Preview may contain reusable test data: **do not clear/reset it, run an E2EE-only migration, copy Production data, or alter its Functions for a different branch without compatibility review.** Frontend-only features need no Appwrite mutation.

**E2EE agent:** Remain on the isolated E2EE app security/task branch and the separate Vercel `mosaic-e2ee-scratch` project. For Appwrite operations use only `appwrite-scratch-lab`, verify `6b00671500279e901846` and call the dedicated Git-SHA/CI-gated lab operator for provisioning. Do not use normal Vercel Preview, `appwrite-preview`, `dev`, `main`, or Production for unfinished encryption work. E2EE app changes require their own Source/CI/Function/origin checks and disposable-user testing before any promotion.

**Shared source/concurrency:** Every agent must reread live branch SHAs, PRs and issue status. Parallel Git task branches are safe; **parallel mutations to the same Appwrite project are not automatically safe**. Coordinate schema/Function/platform changes per project, avoid stale branch merges and never change another agent's target through an environment variable or legacy alias. Promotion approvals do not transfer between issues/branches.

## Legacy aliases (compatibility only)

- Oracle typed service `appwrite-scratch` **still resolves to Appwrite Preview** (`6ae94a2100014d01f5ed`); it **does not** select the new Scratch project. New agents must use `appwrite-preview` explicitly.
- `mosaic_oracle_scratch_release` is likewise **pinned to existing Preview**. It must **not** be called for E2EE Scratch. Retire or rename only in a separately reviewed, backward-compatible operations change.
- Older variable names `MOSAIC_SCRATCH_PROJECT_ID`, `MOSAIC_SCRATCH_ENDPOINT`, CLI command names `appwrite:preview:*` and the document filename `SCRATCH_PREVIEW_WORKFLOW.md` remain compatibility paths referring to **Preview**. Use canonical `MOSAIC_PREVIEW_*` names in new code; preserve aliases until audited.
- Credentials remain project-specific and root-owned where applicable. Never pass keys through browser `VITE_*` variables, copy a key between roles, or infer key permissions from tool names. Unverified/missing credentials block writes.

## Before reporting a deployment/test ready

1. Confirm the exact Git task/Preview source SHA, required CI, proper feature branch and correct Vercel project. For normal flows, the same official project serves stable Preview and `dev`, while `main` is its Production target.
2. Confirm **actual runtime** Appwrite project/endpoint and Function ID, not just the Vercel build status. Explicit Preview project ID is required; never rely on an implicit production fallback.
3. Confirm the deployment hostname is a registered Web platform on **that exact Appwrite project**. Complete applicable additive migration/Function activation checks and disposable-user auth/Diary sync before calling a backend-dependent Preview testable.
4. Keep the Preview→dev→main manual approval boundaries and protected CI/alias gates intact. No app changes or Production writes are authorized merely by this routing policy.

## Current E2EE state and recovery

As of 2026-11-21, Oracle E2EE lab bootstrap is **`partial / BOOTSTRAP` with zero databases, Functions, buckets and users**. The owner's guarded diagnostic installer reported **`HOST_NODE_MISSING` and `HOST_NPM_MISSING`**. E2EE provisioning cannot resume until a reviewed runtime is present and the lab preflight passes again; do not bypass the journal or requeue bootstrap directly. Keep the changing checkpoint in [E2EE issue #1662](https://github.com/carlers/mosaic-life-tracker/issues/1662), [Oracle issue #295](https://github.com/carlers/mosaic-server-ops/issues/295) and related live PRs. **Normal Appwrite Preview development is not blocked by this E2EE dependency.**

Refs: [parallel routing #2196](https://github.com/carlers/mosaic-life-tracker/issues/2196).
