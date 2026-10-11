# Session checkpoint

Updated: 2026-10-11
Current task: #405 Bucket List v0.19.0 visual refresh + owner-only linked canonical tasks, explicitly approved.

## Branch and scope
- Task `chatgpt/bucket-list-linked-tasks-405-20261011` branched from accepted v0.18.0 `feature/bucket-list-405@8fdf0063`; current `dev/main` remain v0.17.4 and untouched. No Scratch, Production, or Vercel modifications.
- Editorial Bucket List overview, read-first full-page detail with shared sheets, private linked tasks (own tasks only) and task-side reverse linker. Date-free new steps default to ordinary Backlog; choose existing task category/date. Link does not modify canonical task or expose goal to shared users. Goal achievements remain independent of task completion.
- Owner-only `bucket_task_links` with deterministic IDs, 8th RxDB pilot and CAS; additive backend migration 011, owner erasure, GC, backup v4 (legacy compat), account cleanup, regression coverage. Version candidate 0.19.0.
- Scratch currently uses combined `message-action@6acba22560abbd99d124` for prior v0.18.0. **Do not activate or alter shared Scratch** until explicit coordinated rollout checkpoint under #526; preserve stable Preview v0.18.0. Backend change is not yet user-testable.

## Next action
- Initial focused CI 38152472127 failed only because new BUCKET_LIST_LINKS.md was not indexed. README index now links it; added v4 cross-account remapping, legacy Replace preservation and orphan-link regression tests. Re-run focused task CI and fix all code/type/test failures incl privacy/performance. Check same-tree GIPHY Vercel before any budget revision.
- After focused green, squash into stable `feature/bucket-list-405`, run full canonical CI + exact Vercel READY. Coordinate separate Scratch migration 011 + combined Function activation under #526 only with explicit authorization, then cloud/user acceptance. Do not merge dev/main or release Production.
