# Reversible core-only backend MVP — #1027 / #967 / #975

Updated 2026-10-19. **Plan and source guardrails, not a live migration or authorization to promote.** The current shipped app is Appwrite Cloud. Preserve Oracle self-hosted Appwrite and Supabase Free as viable independently testable choices.

## First release boundary

- Enable a strictly personal, local-first task tracker: authenticated owner, categories, tasks, Calendar, Todo List, Day View, Backlogs, local edits and two-device owner-scoped cloud synchronization.
- Defer **Diary until the very next post-core milestone** (high priority, ahead of bucket lists/social), including private text/emoji, privacy, offline replay, accurate tombstones and optional photo storage only when safely supported.
- Gate bucket lists, friend calendar/carousel, Explore, chat, alerts/push, invitations, shared tasks and reactions on explicit verified backend capabilities; show Coming Soon for direct disabled routes, never delete stored rows or drafts because their UI is hidden.
- Local preferences may still exist, but MUST be explicitly described as device-local until account-synced settings can be safely migrated. New task photo uploads must be disabled until trusted storage exists; preserve references for recovery.

## Capability boundary already staged in source

`src/lib/backendCapabilities.ts` defines a deterministic `full` (default) versus `core-only` frontend profile, two supported MVP sync domain names and typed writer/return acceptance assertions. Unknown modes retain current full Appwrite behavior; **no client flag can grant missing backend capabilities**, and no PostHog/network response is required to use essential core controls.

The profile can be read from the build-only `VITE_MOSAIC_FEATURE_PROFILE`. This is **not** the backend switch, security authorization or complete launch toggle. The current underlying Appwrite Auth and eight-domain sync coordinator are unchanged. Do **not** set the core-only build profile on a real-user deployment or advertise it as a functioning Supabase client until app-level Supabase Auth, writer start/stop, account cache ownership, profile/settings fallback, PWA compatibility and server denials have passed actual signed-hosted/device tests. Tests of `assertSafeProviderSwitch()` establish an intended contract only; the production runtime does not yet execute this guard.

PostHog already supports remote feature flags; eventual rollout may further **disable** supported features. An offline/outage response may never prevent access to previously authorized local core data, and remote toggles never permit unsupported RPCs or cross-account reads.

## How to return to Appwrite without losing writes

The goal is **repeatable tested migration in either direction**, not one-click flipping of a URL after users have edited their Supabase task rows. Returning to Appwrite is safe only after source and destination reconciliation. Both services MUST NEVER be simultaneous authoritative writers for one owner/domain.

1. **Preflight**: Verify a working, capacity-sufficient destination Appwrite deployment (Cloud or OCI), schema/Function/Auth/Storage support, current owner credentials and stable Appwrite-user-ID ↔ Supabase-UUID mapping. A versioned backend portability adapter must preserve original task/category IDs, order, dates, statuses and tombstones.
2. **Export and verify**: Obtain a recoverable, independently escrowed point-in-time encrypted source snapshot, counts/hashes including tombstones and *all* user data and attachments, plus outstanding RxDB local drafts and durable outbox. Keep disabled Diary/social domains recoverable; no user data may silently disappear.
3. **Freeze**: Fence old installed PWA/browser writers (issue #914), temporarily enter read-only/maintenance for mutable domains, drain in-flight operations and persisted offline drafts with owner acknowledgment, record high-water revisions. Never rely on DNS alone to enforce freezing.
4. **Import idempotently**: Transfer only owner-matched rows and media to the destination, maintain stable IDs and metadata and map commit/cursor revisions without reusing incompatible token semantics. Verify all rows, missing files, revocations, deletion markers and independent restore before opening writes.
5. **Single cutover**: Atomically select one authoritative provider per owner/domain, invalidate former writer sessions/credentials where possible, clear/reseed provider-scoped cursor state **without deleting RxDB owner cache**, and prove two-device signed sync/restart/offline and account-switch isolation. Fresh installs and old PWAs must not corrupt either backend.
6. **Post-cutover & fallback**: Monitor sync divergence, capacity and permission denials; retain encrypted source backup and rollback/forward-export scripts through a reviewed window. If writes have resumed on the destination, a return **requires another verified reverse delta**, not a blind provider setting change. Preserve tombstones and account erasure markers so no deleted user data resurrects.

The target is a short, safe *operational* switchover once rehearsed, not unconditional immediate reversibility. `assertSingleCloudWriter()` and `assertSafeProviderSwitch()` encode minimum preconditions in the source-only acceptance contract, and will be wired into the writer orchestration during integration; current tests do not prove an end-to-end reverse migration.

## Social shared-task disable safety (2026-10-19 follow-up)

The core-only profile must **not** expose cached shared-task invitations or peer task titles from a previous full Appwrite session. The `useSharedTasks` hook now returns empty items, skips queue and settlement subscriptions/online refreshes, and rejects shared-task mutation commands when the provider capability is off. Data remains in owner-scoped storage for eventual re-enable; this disables presentation and side effects, not existing records. Full Appwrite mode keeps its existing behavior. Unit/React regression explicitly seeds synthetic cached friend task data to prove the core-only boundary.

Remaining work: social outbox/sync coordinator and backend-specific Auth still need full suppression before enabling the core-only build for any real users; this hook-level hardening is not equivalent to cloud-provider switching.

## Source-only Supabase Auth lifecycle pilot

`supabase-poc/candidateAuthSession.ts` adds an **experimental non-persistent in-memory session manager** around Supabase GoTrue password/refresh/logout/signup/recover endpoints, layered over the existing server-verified `/auth/v1/user` boundary. Every login and refresh resolves the identity from the live Auth endpoint before acknowledging ownership, increases account epoch on token replacement and refuses stale in-flight replies. Switching account invalidates the old session **before** network sign-in. A failed server logout still clears the local token and reports revocation as unconfirmed; JWTs already issued may remain usable until expiration. No credentials/tokens are logged or written to storage.

This supports a genuine disposable local two-owner Auth+Chromium acceptance flow with password grant, refresh-token rotation, owner switch and local sign-out. It does **not** persist sessions across reload, reconnect Appwrite account IDs, configure hosted email confirmation/recovery redirects, perform MFA, or replace `src/hooks/AuthProvider.tsx`. Passwords from Appwrite **cannot** be silently re-used or migrated without user reauthentication/reset. The long-term auth design must maintain offline account cache and server-verification distinction and link identity mapping to imported data before any customer-facing release.

## Experimental two-domain core sync coordinator

`supabase-poc/candidateCoreRuntime.ts` composes the already reviewed task + category native RxDB pilots with one **server-verified Supabase owner** and explicit **legacy identity mapping / old Appwrite writer fence / exclusive writer lease** adapters. Without *all three* independently provided guards it refuses to start. It never silently falls back to Appwrite. Both collections start together; if either fails the other is canceled and the lease released only after confirmed cleanup. If cancellation is unconfirmed, the lease remains held rather than creating a second active writer. Owner switch or expired lease disables explicit resync; retained RxDB drafts are not erased.

The standalone real signed local Chromium test now starts both native RxDB collections and covers task creation, offline completion, restart/return sync, tombstone propagation and owner isolation in addition to the earlier category conflict tests. This is **not** a replacement for hosted two-device acceptance, and the migration guard implementations remain fake/injected for unit testing: the existing shipped `src/db/sync.ts` still exclusively owns Appwrite subscriptions and the actual cross-tab/old-PWA writer lease and Appwrite-ID registry do not yet exist. No implementation may call the coordinator with a no-op lease in a user deployment.

## Must pass before any core MVP release

- Signed, real Supabase Auth signup/login/logout/recovery and validated account mapping, hosted RLS and privileged RPC review, two-owner negative tests, local offline boot and cross-device convergence.
- All task/category mutations including date/reorder/completion/tombstones, stale cursor, CAS racing writers and >90-day retention behavior; no Appwrite fallback writing silently alongside Supabase.
- Restore to **separate** disposable target, cryptographic export/data verification, old-PWA cutoff/rollback tests, measured Free-tier limits and safe status UX.
- CI-first isolated Preview, mobile Safari/Android tests, explicit owner `dev`/`main` and Production approvals; #889 release gate unaffected.

## Next priorities

1. Complete the core-only mode **without background social fetches, side effects or Appwrite multi-domain writers**. This initial branch is frontend/capability scaffolding, not a finished full feature gate.
2. Wire Supabase Auth and owner-locked task/category replication behind provider-specific session and writer lifecycles, while keeping Appwrite code usable and reversible.
3. Exercise a **real** forward AND reverse task/category migration using disposable owner data before touching user data.
4. After a functioning approved core MVP release, **Diary immediately next**. Then synced personal settings/storage and Bucket List, then social only as independently verified capabilities.

Issues: [#1027](https://github.com/carlers/mosaic-life-tracker/issues/1027), [#1026](https://github.com/carlers/mosaic-life-tracker/issues/1026), [#967](https://github.com/carlers/mosaic-life-tracker/issues/967), [#975](https://github.com/carlers/mosaic-life-tracker/issues/975), [#914](https://github.com/carlers/mosaic-life-tracker/issues/914).
