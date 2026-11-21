# Mosaic working rules

Run project commands from `life-tracker/`; Git root is its parent.
Read [the checkpoint](docs/SESSION_STATE.md), inspect Git/current files, then read
only relevant source and reference sections. [Docs index](docs/README.md) routes
additional reading. Current code and Git override stale progress prose.

## Parallel Appwrite environments — mandatory target selection

For normal feature work, use **Appwrite Preview** (project `6ae94a2100014d01f5ed`, Oracle service `appwrite-preview`) with the existing official Vercel Preview/dev project. For isolated E2EE work only, use **Appwrite Scratch** (project `6b00671500279e901846`, service `appwrite-scratch-lab`, separate E2EE Vercel project). Production remains `6ae9599c002ab812f9c3` and requires explicit authorization. All projects share the endpoint, so the endpoint is **not** sufficient target proof. The legacy `appwrite-scratch` service and `mosaic_oracle_scratch_release` still point to **Preview**, not the new Scratch lab; new agents must not use those ambiguous aliases. Read [canonical environment map and concurrent-agent rules](docs/APPWRITE_ENVIRONMENTS.md) before backend changes. Never copy keys, accounts or data between projects or treat a Preview database as disposable. Parallel Git branches do not authorize concurrent project-wide schema/Function changes.

## Work and delivery

- Follow the requested scope. Preserve unrelated edits. Default to one agent.
- Use [GitHub Issues workflow](docs/ISSUE_WORKFLOW.md) for explicitly requested idea capture,
  issue-first planning, cross-chat recovery, and lifecycle tracking. An issue is not
  implementation or promotion authorization; the repo's contracts remain authoritative.
- For a fresh-chat request such as "pick up where we left off on shared tasks", use
  [issue-specific resume](docs/ISSUE_WORKFLOW.md#natural-language-cross-chat-resume):
  resolve the topic through GitHub, inspect its latest resume checkpoint and live
  branches/PRs/checks, then resume only previously authorized work. The global session
  checkpoint can belong to another issue. Do not require the old chat or an issue number
  when the repository can resolve the request.
- Resolve routine choices and complete authorized work without repeated confirmation.
- Use focused tests during edits; broaden for shared behavior or failures. Report actual
  results and unresolved limitations. Do not manufacture red evidence or add trivial tests.
- Tests protect durable behavior/invariants, not incidental JSX/CSS. Do not assert Tailwind
  classes, DOM ancestry, decorative styling, exact colors, or pixel geometry. A visual
  product description does not by itself justify an automated styling assertion; use
  semantic/behavioral checks or manual visual acceptance unless the observable geometry is
  required for interaction, accessibility, clipping, or overflow correctness. Reserve
  Playwright for browser-only failure modes. Follow [test workflow](docs/TEST_WORKFLOW.md).
- Commit scoped task changes automatically and batch remote edits so ordinary WIP pushes are
  rare. For GitHub-connected Chat/Code Mode, preflight connector-call count and split large
  Git-object writes before execution; follow the call-budget protocol in
  [AI workflow](docs/AI_WORKFLOW.md#github-connector-call-budget). The final coherent
  `chatgpt/**` task commit includes the current checkpoint and requests
  `[verify:focused]`; after focused green, squash it into the stable Preview branch, where
  the one routine full canonical gate + Preview run. Do not add a status-only post-green
  commit. Follow [delivery](docs/DELIVERY.md). Never force-update shared history or divergent
  Preview. No unrelated service changes.
- Update the checkpoint at meaningful milestones and handoffs. Keep objective, constraints,
  completed/remaining work, working files, checks, blockers, and next action concise.
  Do not copy prompts, Git status, or response boilerplate into it.
- For user-visible features, propose Preview version impact during planning, stamp each successfully delivered Preview candidate before acceptance, and preserve it through dev/main. Increment PATCH only on subsequent user-testable revisions, not internal fixes. Check active branches for collisions and use descriptive merge subject/body; follow [versioning](docs/VERSIONING.md).
- **Already-installed Appwrite Preview Function operator:** Before claiming Function deployment is unavailable, inspect the connected Oracle Operations `mosaic_oracle_scratch_release` legacy **Preview** release path, its source-pinned branch, live journal and exact push CI; see [backend procedure](docs/APPWRITE_BACKEND_WORKFLOW.md#connected-chat-preview-function-delivery--already-installed). Generic typed-management failure does **not** imply this operator is unavailable; do not confuse it with isolated E2EE Scratch. It cannot provision arbitrary Function variables.
- **Connected-chat terminal rule:** Before telling the owner to run Git, npm or
  Scratch preparation commands, check whether Vercel Sandbox session/create/command
  tools are available. When present, use an ephemeral exact-SHA checkout and
  least-privilege network policy. Distinguish shell access from Appwrite admin
  authentication; do not invent credentials or bypass Scratch/Production gates.
  See [Vercel Sandbox execution](docs/AI_WORKFLOW.md#vercel-sandbox-execution-in-connected-chat)
  and [Scratch readiness](docs/SCRATCH_PREVIEW_WORKFLOW.md).
- A `dev` merge is **not** PWA delivery. Before reporting dev as deployed, verify
  that the existing stable dev Vercel alias resolves to the exact live dev SHA,
  its deployment is READY in the official Preview/Scratch project, and the
  matching canonical CI succeeded. An immutable deployment URL is not a
  replacement. Use the read-only `scripts/verify-stable-dev-deployment.mjs`
  or equivalent direct Vercel alias/deployment readbacks. If stale, complete a
  guarded alias repair and verify readback, or explicitly report deployment
  incomplete. Never retarget Production; PWA service-worker installation is a
  separate manual acceptance. See [delivery](docs/DELIVERY.md#stable-dev-pwa-delivery-gate).
- On each dev push, the protected standalone `Dev Stable PWA Alias Delivery` workflow waits for successful exact-SHA canonical CI and verifies the current dev SHA and READY official Preview deployment, repairs only the existing stable dev alias if stale, and fails visibly if verification cannot succeed. Agents must still independently read back that alias before claiming the PWA is deployed. Do not bypass the protected job or reinterpret its failure as success.
- Report outcome, checks, commit, and deployment status briefly. Telemetry is opt-in.
  Connected-chat agents must also follow the read-once, repair-batching, CI-polling, and
  build-size preflight rules in [latency discipline](docs/AI_WORKFLOW.md#connected-chat-latency-discipline);
  do not burn wall time on repeated fetches, status polling, or serial micro-fix branches.
  Read [AI workflow](docs/AI_WORKFLOW.md) for environment setup, connector batching, or
  handoff details.

## Data and application constraints

- UI uses domain hooks, never raw RxDB/RxJS/Appwrite services. SDK construction belongs
  in `src/lib/sdk.ts` and `src/lib/appwrite.ts`; use guarded clients elsewhere.
- Preserve account isolation, cached offline identity, provider ownership/order, race
  protection, bounded retries, and sync coordination. Confirmed 401 differs from offline.
- Before handing off an Appwrite-dependent Preview, follow [scratch readiness](docs/SCRATCH_PREVIEW_WORKFLOW.md): confirm exact scratch target, reconcile approved additive migrations, review/activate the exact Function deployment, check Appwrite origin/auth policy, and prove Diary sync on disposable data. Never copy production accounts or silently substitute a production backend. Normal frontend-only work skips this cloud gate.
- Schema changes require migrations, sync mappings, mirrored test schemas, and applicable
  remote rollout steps. Appwrite schema/Function changes also follow
  [backend workflow](docs/APPWRITE_BACKEND_WORKFLOW.md); never use Console edits or an implicit
  production target as the normal development path. Local `isDeleted` maps to remote `deleted`; use tombstones.
  Ordinary record deletion follows [retention](docs/TOMBSTONE_RETENTION.md). The only
  hard-delete exception is explicit, typed-confirmation account erasure through the
  server-owned durable deletion worker documented in [project reference](docs/PROJECT_REFERENCE.md#238-permanent-account-erasure).
- Row IDs: at most 36 characters; Appwrite accepts alphanumeric, underscore, period, and hyphen, with an alphanumeric first character. Preserve existing valid period/hyphen IDs during local migration; newly generated hashed IDs use only alphanumeric and underscore. Existing rows
  use `updateRow`; new rows and update-404 fallback use `createRow`, never `upsertRow`.
- Cross-user writes go through `message-action`; outgoing `read_at` is server-owned.
- Preserve existing UI unless the task requests a visual change. Use shared BottomSheet,
  semantic controls, visible focus, accessible labels, and existing interaction patterns.
  Accessibility work must not silently redesign the interface. Dynamic colors use inline styles.
  New or modified themed UI must use the semantic tokens and acceptance checklist in
  [theming guide](docs/THEMING.md); preserve Dark/Black while fixing Light.
- Read [project reference](docs/PROJECT_REFERENCE.md) sections for the affected domain
  before changing its contract. Section numbers remain stable regression references.

## Definition of done

Focused checks and diff review pass; checkpoint is current in the final task commit; the
stable Preview branch has remote canonical acceptance and Preview delivery, or their concrete
blockers are reported. Ordinary
prose edits need contracts and diff checks locally. Tooling changes need relevant tests
and lint. Required manual/device checks remain separate from automated results.
