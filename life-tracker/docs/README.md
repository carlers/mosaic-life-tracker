# Documentation

This is a **navigation index**, not an additional source of policy. Read only what
applies to the current task. Current source/configuration defines shipped behavior;
live Git branches, issues, PRs, Actions, and deployments establish current status.
The dated [session checkpoint](SESSION_STATE.md) is a handoff snapshot and can lag
behind a completed promotion.

Operator-controlled optional features: [Operational feature controls](FEATURE_CONTROLS.md).

## Task-to-context shortcuts

Read the [agent entrypoint](../AGENTS.md), then the **smallest relevant set** below.
Check the current implementation/tests and live issue/PR evidence before treating
historical prose or a checkpoint as the state of a feature.

| Working onâ€¦ | Read first | Verify against |
|---|---|---|
| Locating UI source from a feature description | [Source map](REPO_MAP.md), [generated component/page index](COMPONENT_INDEX.md) (optional) | Exact branch-SHA files; map is only a starting hint |
| Secure chat photo attachment rollout | [Chat photos](CHAT_PHOTOS.md) | Scratch Storage ACL, Function, compatibility, and device checks |
| Sync races, offline startup, owner isolation | [Sync scenario matrix](SYNC_SCENARIO_MATRIX.md), [project reference](PROJECT_REFERENCE.md) Â§Â§18, 19, 24.18 | `src/lib/` sync implementation, relevant unit/DOM regressions |
| Appwrite schema, Functions, or scratch previews | [Backend workflow](APPWRITE_BACKEND_WORKFLOW.md), [Scratch readiness](SCRATCH_PREVIEW_WORKFLOW¶»§q«^