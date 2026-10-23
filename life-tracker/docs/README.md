# Documentation

This is a **navigation index**, not an additional source of policy. Read only what
applies to the current task. Current source/configuration defines shipped behavior;
live Git branches, issues, PRs, Actions, and deployments establish current status.
The dated [session checkpoint](SESSION_STATE.md) is a handoff snapshot and can lag
behind a completed promotion.

## Task-to-context shortcuts

Read the [agent entrypoint](../AGENTS.md), then the **smallest relevant set** below.
Check the current implementation/tests and live issue/PR evidence before treating
historical prose or a checkpoint as the state of a feature.

| Working on… | Read first | Verify against |
|---|---|---|
| Locating UI source from a feature description | [Source map](REPO_MAP.md), [generated component/page index](COMPONENT_INDEX.md) (optional) | Exact branch-SHA files; map is only a starting hint |
| Sync races, offline startup, owner isolation | [Sync scenario matrix](SYNC_SCENARIO_MATRIX.md), [project reference](PROJECT_REFERENCE.md) §§18, 19, 24.18 | `src/lib/` sync implementation, relevant unit/DOM regressions |
| Appwrite schema, Functions, or scratch previews | [Backend workflow](APPWRITE_BACKEND_WORKFLOW.md), [Scratch readiness](SCRATCH_PREVIEW_WORKFLOW.md) | `infrastructure/`, `appwrite-functions/`, migrations and actual target project |
| Pre-1.0 Production migration, compatibility and acceptance | [Production readiness](PRODUCTION_RELEASE_READINESS.md), [Production acceptance](PRODUCTION_ACCEPTANCE.md), [Client/backend compatibility](CLIENT_BACKEND_COMPATIBILITY.md), [Disaster recovery](DISASTER_RECOVERY.md) | Live Production schema/Function, historical PWA sources and separate approvals |
| Alerts, notifications or push | [Project reference](PROJECT_REFERENCE.md) §2 (Alerts), [Mobile Push](MOBILE_PUSH_SETUP.md) | Alerts UI, Function authorization and browser contracts |
| Theme, contrast or component styling | [Theme guide](THEMING.md) | `src/index.css`, `tailwind.config.js`, modified components and light/dark/black states |
| Gestures, calendars, task reorder | [Project reference](PROJECT_REFERENCE.md) §§2, 13, 24; [manual reorder checklist](MANUAL_TASK_REORDER_ACCEPTANCE.md) when relevant | Gesture owners, interaction regressions and appropriate device acceptance |
| Docs, workflows or CI | [AI workflow](AI_WORKFLOW.md), [Delivery](DELIVERY.md), [Test workflow](TEST_WORKFLOW.md) | `scripts/check-project-contracts.mjs`, workflow YAML and current Actions evidence |
| Account deletion or disaster recovery | [Account erasure](ACCOUNT_ERASURE.md), [Disaster recovery](DISASTER_RECOVERY.md) | Managed backend contracts, migrations and explicit rollout evidence |

These routes select **reading context**, not permission to skip required tests,
authorization, Scratch checks, or release gates.

## Agent and delivery workflow

| Question | Canonical owner |
|---|---|
| Where do I begin? | [Project instructions](../AGENTS.md) — concise mandatory guardrails |
| What task is in progress? | [Session checkpoint](SESSION_STATE.md) — next action and recovery context, verified against live Git |
| What ideas or approvals are recorded? | [GitHub Issues workflow](ISSUE_WORKFLOW.md) — intake, planning, and issue lifecycle; actual issues hold task decisions |
| What workstreams are planned or historically delivered? | [Roadmap](PLAN.md) — durable milestones, not live task status |
| How should an AI agent work or hand off? | [AI workflow](AI_WORKFLOW.md) — execution and connected-chat practices |
| Which branch, CI, Preview, and release gates apply? | [Delivery](DELIVERY.md) — approval and promotion policy |
| How does the protected-main trusted CI-first Preview receiver work? | [Trusted Preview main bootstrap](TRUSTED_PREVIEW_MAIN_BOOTSTRAP.md) — historical pinned trust design; verify current protected main and dev before use |
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
| Private Bucket List and canonical task links | [Bucket List links](BUCKET_LIST_LINKS.md) |
| One-way TodoMate personal-data import and mapping | [TodoMate import](TODOMATE_IMPORT.md) |

## Backend and operational runbooks

| Operation | Canonical owner |
|---|---|
| Git-owned Appwrite manifests, migrations, and Function deployments | [Appwrite backend workflow](APPWRITE_BACKEND_WORKFLOW.md) |
| Historical client/read-write schema compatibility, supported-client policy | [Client/backend compatibility](CLIENT_BACKEND_COMPATIBILITY.md) |
| Isolated old/new PWA, queued-write and server permission compatibility exercise (#914 Phase B) | [Compatibility rehearsal](COMPATIBILITY_REHEARSAL.md) |
| Isolated scratch Preview parity, synthetic accounts, and readiness | [Scratch Preview workflow](SCRATCH_PREVIEW_WORKFLOW.md) |
| Administrator recovery, encrypted snapshots, restore drills, watcher | [Disaster recovery](DISASTER_RECOVERY.md) |
| Exact-source local Production-target pre-release testing (not a Vercel Preview) | [Production acceptance](PRODUCTION_ACCEPTANCE.md) |
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
| [Mobile startup size/performance lab](MOBILE_STARTUP_AUDIT.md) | Read-only throttled Chromium benchmark and nonblocking metrics, not real-device acceptance |
| [Build parity diagnostics](BUILD_PARITY_DIAGNOSTICS.md) | Sanitized GitHub/Vercel exact-SHA size comparison and acceptance steps for #592 |

**Ownership rule:** Specialist runbooks contain unique safety and operational contracts;
the [project reference](PROJECT_REFERENCE.md) owns stable product/architecture invariants;
the [delivery guide](DELIVERY.md) owns release gates. Entrypoints should summarize and
link rather than duplicate these rules. Audit/acceptance documents retain historical
evidence, not permission to override executable code or current release status.
Do not renumber project-reference sections merely to reorganize documentation.

- [Shared tasks owner and collaborator contract](SHARED_TASKS.md)
- [Default task Change Date calendar](TASK_DATE_INTERACTION.md)
