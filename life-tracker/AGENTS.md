# Mosaic working rules

Run project commands from `life-tracker/`; Git root is its parent.
Read [the checkpoint](docs/SESSION_STATE.md), inspect Git/current files, then read
only relevant source and reference sections. [Docs index](docs/README.md) routes
additional reading. Current code and Git override stale progress prose.

## Work and delivery

- Follow the requested scope. Preserve unrelated edits. Default to one agent.
- Resolve routine choices and complete authorized work without repeated confirmation.
- Use focused tests during edits; broaden for shared behavior or failures. Report actual
  results and unresolved limitations. Do not manufacture red evidence or add trivial tests.
- Tests protect durable behavior/invariants, not incidental JSX/CSS. Do not assert Tailwind
  classes, DOM ancestry, decorative styling, exact colors, or pixel geometry. A visual
  product description does not by itself justify an automated styling assertion; use
  semantic/behavioral checks or manual visual acceptance unless the observable geometry is
  required for interaction, accessibility, clipping, or overflow correctness. Reserve
  Playwright for browser-only failure modes. Follow [test workflow](docs/TEST_WORKFLOW.md).
- Commit scoped task changes automatically, push a `chatgpt/**` task branch, and publish
  Preview after exact-SHA canonical acceptance. Follow [delivery](docs/DELIVERY.md).
  Never force-update shared history or divergent Preview. No unrelated service changes.
- Update the checkpoint at meaningful milestones and handoffs. Keep objective, constraints,
  completed/remaining work, working files, checks, blockers, and next action concise.
  Do not copy prompts, Git status, or response boilerplate into it.
- Report outcome, checks, commit, and deployment status briefly. Telemetry is opt-in.
  Read [AI workflow](docs/AI_WORKFLOW.md) only for environment setup or handoff details.

## Data and application constraints

- UI uses domain hooks, never raw RxDB/RxJS/Appwrite services. SDK construction belongs
  in `src/lib/sdk.ts` and `src/lib/appwrite.ts`; use guarded clients elsewhere.
- Preserve account isolation, cached offline identity, provider ownership/order, race
  protection, bounded retries, and sync coordination. Confirmed 401 differs from offline.
- Schema changes require migrations, sync mappings, mirrored test schemas, and applicable
  remote rollout steps. Local `isDeleted` maps to remote `deleted`; use tombstones.
  Permanent deletion follows [retention](docs/TOMBSTONE_RETENTION.md) only.
- Row IDs: at most 36 characters, `[a-zA-Z0-9_]+`, no leading underscore. Existing rows
  use `updateRow`; new rows and update-404 fallback use `createRow`, never `upsertRow`.
- Cross-user writes go through `message-action`; outgoing `read_at` is server-owned.
- Preserve existing UI unless the task requests a visual change. Use shared BottomSheet,
  semantic controls, visible focus, accessible labels, and existing interaction patterns.
  Accessibility work must not silently redesign the interface. Dynamic colors use inline styles.
- Read [project reference](docs/PROJECT_REFERENCE.md) sections for the affected domain
  before changing its contract. Section numbers remain stable regression references.

## Definition of done

Focused checks and diff review pass; checkpoint is current; remote canonical acceptance
and Preview delivery are completed or their concrete blockers are reported. Ordinary
prose edits need contracts and diff checks locally. Tooling changes need relevant tests
and lint. Required manual/device checks remain separate from automated results.
