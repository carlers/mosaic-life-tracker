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

## Core-only AuthProvider background side-effect boundary (2026-10-20)

The Appwrite-backed `AuthProvider` now leaves shared-task queue scoping/online flushes and push-notification owner registration **unmounted** when their build capabilities are disabled. When `core-only` is explicitly selected, its automatic eight-domain **Appwrite** sync startup also stays off rather than dispatching unsupported/social writes or accidentally creating a second writer. The existing `full` Appwrite build preserves all three behaviors. React tests use a cached synthetic owner and prove that online core-only startup dispatches none of these effects.

**This is a fail-closed source guard, NOT operational Supabase sync.** Appwrite authentication and signup/profile actions remain coupled to legacy code, additional social/background paths require review, and core-only must not be enabled for real users until Supabase session persistence, two-domain sync routing, data preservation and old-PWA writer fencing are implemented.

## Core local RxDB owner mutation hardening (2026-10-20)

Owner-scoped **pull and push transports are not sufficient** if an old UI retained a task or category ID from a previously selected account. The normal task/category hooks now reject ID-addressed writes against any local RxDB document whose `userId` differs from the current authenticated `user.$id`. They also reject caller-supplied changes to the document's `id` or `userId`. Category reorder preflights **every** proposed local document's owner before applying any order writes, avoiding partial changes from a mixed-account drag snapshot. Synthetic React tests exercise foreign task edit/completion/tombstone, category edits/deletion/reorder, identity rewriting, account-switch rerender and ordinary same-owner actions. Full Appwrite and candidate core-only logic retain same-owner workflows; no cloud writers or user data are changed by the isolated code milestone.

This is client-side defense in depth, **not** a replacement for server RLS, old-PWA fences or a signed session lifecycle. Race tests after unmount, cross-tab stale asynchronous callbacks and privileged server ownership still require independent end-to-end verification.

## Source-only Supabase Auth lifecycle pilot

`supabase-poc/candidateAuthSession.ts` adds an **experimental non-persistent in-memory session manager** around Supabase GoTrue password/refresh/logout/signup/recover endpoints, layered over the existing server-verified `/auth/v1/user` boundary. Every login and refresh resolves the identity from the live Auth endpoint before acknowledging ownership, increases account epoch on token replacement and refuses stale in-flight replies. Switching account invalidates the old session **before** network sign-in. A failed server logout still clears the local token and reports revocation as unconfirmed; JWTs already issued may remain usable until expiration. No credentials/tokens are logged or written to storage.

A definitive 401/403 refresh denial now clears the in-memory session immediately; an ambiguous network outage preserves the previous token only for later independent server verification. Unit tests distinguish these cases and successful HTTP 204 logout. The signed RxDB test fixture preserves category-only checkpoint probes while the independent task stream is exercised. All this remains unverified until runner CI executes.

This supports a genuine disposable local two-owner Auth+Chromium acceptance flow with password grant, refresh-token rotation, owner switch and local sign-out. It does **not** persist sessions across reload, reconnect Appwrite account IDs, configure hosted email confirmation/recovery redirects, perform MFA, or replace `src/hooks/AuthProvider.tsx`. Passwords from Appwrite **cannot** be silently re-used or migrated without user reauthentication/reset. The long-term auth design must maintain offline account cache and server-verification distinction and link identity mapping to imported data before any customer-facing release.

## Signed refresh restoration foundation (2026-10-20)

`supabase-poc/candidateAuthSession.ts` now supports **optional injected persistence** for a **single isolated candidate session**. It stores a provider-origin-bound **refresh token and untrusted owner UUID hint only** (never an access JWT, password, email or signed offline identity), with a versioned record. Browser storage is **not automatically enabled**. After reload, `restoreFromPersistence()` must exchange the saved refresh token and obtain the account ID from real Supabase Auth `GET /auth/v1/user`; until both succeed, the adapter has **no authenticated owner**. A definitive 401/403, malformed record or owner mismatch discards the credential; a network outage retains it without granting authentication. Refresh rotation updates the stored credential before acknowledging the new token and invalidates memory if writing fails. Sign-out clears stored credentials even if remote revocation cannot be confirmed. An account switch erases the old stored identity *before* password login.

Tests exercise reload/rotation, wrong owner, revoked session, malformed stored input, ambiguous outage, stale restore races, failed storage write, and sign-out. **Storage exposure to XSS, cross-tab refresh-token single-use races, old-PWA writers, account identity migration, and durable signed app Auth integration remain UNSOLVED.** Never enable this opt-in persistent store on live users until same-origin tab-exclusive rotation/epoch storage and a verified server-side single writer are implemented; Supabase refresh tokens are rotated and cannot be safely treated as a reusable static credential.

### Disposable signed browser persistence acceptance (2026-10-20)

The dedicated local Supabase CLI/Auth/Chromium test now verifies the same injected persistence path using real signed disposable account credentials and browser `sessionStorage`: login persists **refresh-only**, reload restores only after Auth verification, a second reload rotates the refresh token again, logout clears browser credentials, and another reload refuses authentication. The synthetic test-only storage is destroyed with the browser/local CLI stack; never store real-user secrets in these acceptance fixtures.

This verifies a **single browser-tab test session**, not an app-level persistent Supabase login or safe multi-tab refresh-token rotation. The task branch is eligible for the existing dedicated signed lab pattern `1027-core-auth-*`; canonical CI alone must not be interpreted as real signed Auth acceptance.

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

### Owner-switch asynchronous local mutation fence (2026-10-20)

A further isolated hook guard tracks the **currently committed owner** and invalidates it on unmount. Task/category ID edits re-check after awaited lookups; task creation checks after its sibling lookup; queued task moves/reorders and category drags re-check after asynchronous reads and before dispatching new patches. Old callbacks cannot initiate a new write after account switch/unmount. React negative tests pause lookups, switch the authenticated owner, release the lookups and assert **no local patch or insert**. This remains defense in depth: a write already dispatched before a switch cannot be retracted by the hook; cross-tab writer exclusion, Auth session-epoch fences, server-side authoritative provider cutoff and RLS must still be verified before a real Supabase switch.
