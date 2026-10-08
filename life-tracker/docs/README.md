# Documentation

This is a **navigation index**, not an additional source of policy. Read only what
applies to the current task. Current source/configuration defines shipped behavior;
live Git branches, issues, PRs, Actions, and deployments establish current status.
The dated [session checkpoint](SESSION_STATE.md) is a handoff snapshot and can lag
behind a completed promotion.

## Agent and delivery workflow

| Question | Canonical owner |
|---|---|
| Where do I begin? | [Project instructions](../AGENTS.md) — concise mandatory guardrails |
| What task is in progress? | [Session checkpoint](SESSION_STATE.md) — next action and recovery context, verified against live Git |
| What ideas or approvals are recorded? | [GitHub Issues workflow](ISSUE_WORKFLOW.md) — intake, planning, and issue lifecycle; actual issues hold task decisions |
| What workstreams are planned or historically delivered? | [Roadmap](PLAN.md) — durable milestones, not live task status |
| How should an AI agent work or hand off? | [AI workflow](AI_WORKFLOW.md) — execution and connected-chat practices |
| Which branch, CI, Preview, and release gates apply? | [Delivery](DELIVERY.md) — approval and promotion policy |
| Which automated/manual tests are appropriate? | [Test workflow](TEST_WORKFLOW.md) — test ownership and verification |
| When do Preview versions change? | [Versioning protocol](VERSIONING.md) — semantic version and build identity |

## Product and data contracts

| Domain | Canonical owner |
|---|---|
| Product behavior and architecture, with stable numbered § references | [Project reference](PROJECT_REFERENCE.md) |
| Theme, semantic tokens, contrast, component checklists | [Theme guide](THEMING.md) |
| Sync races and edge-case evidence | [Sync scenario matrix](SYNC_SCENARIO_MATRIX.md) |
| Irreversible account deletion, privacy fencing, and DR non-resurrection | [Account erasure](ACCOUNT_ERASURE.md) |
| Tombstones, garbage collection, and stale-client recovery | [Retention procedure](TOMBSTONE_RETENTION.md) |
| User-controlled backup format and restore behavior | [Backup and restore](BACKUP_RESTORE.md) |
| One-way TodoMate personal-data import and mapping | [TodoMate import](TODOMATE_IMPORT.md) |

## Backend and operational runbooks

| Operation | Canonical owner |
|---|---|
| Git-owned Appwrite manifests, migrations, and Function deployments | [Appwrite backend workflow](APPWRITE_BACKEND_WORKFLOW.md) |
| Isolated scratch Preview parity, synthetic accounts, and readiness | [Scratch Preview workflow](SCRATCH_PREVIEW_WORKFLOW.md) |
| Administrator recovery, encrypted snapshots, restore drills, watcher | [Disaster recovery](DISASTER_RECOVERY.md) |
| Independent forks and maintainer continuity | [Forking and recovery](FORKING.md) |
| Friendship rollout, permissions, and legacy repair | [Friendship recovery](FRIENDSHIP_RECOVERY.md) |
| Android/iOS Web Push and VAPID setup | [Mobile Push setup](MOBILE_PUSH_SETUP.md) |

## Audits, acceptance evidence, and optional tools

| Artifact | How to use it |
|---|---|
| [Accessibility review](ACCESSIBILITY_AUDIT.md) | Dated audit findings and manual/browser verification protocol |
| [Build-vs-reuse audit](BUILD_VS_REUSE_AUDIT.md) | Completed architectural tradeoff evidence; reassess against current code |
| [Task reorder acceptance](MANUAL_TASK_REORDER_ACCEPTANCE.md) | Human mobile gesture checklist; not an automated test result |
| [Workflow telemetry](WORKFLOW_TELEMETRY.md) | Optional local-only measurement protocol, not a required gate |

**Ownership rule:** Specialist runbooks contain unique safety and operational contracts;
the [project reference](PROJECT_REFERENCE.md) owns stable product/architecture invariants;
the [delivery guide](DELIVERY.md) owns release gates. Entrypoints should summarize and
link rather than duplicate these rules. Audit/acceptance documents retain historical
evidence, not permission to override executable code or current release status.
Do not renumber project-reference sections merely to reorganize documentation.
