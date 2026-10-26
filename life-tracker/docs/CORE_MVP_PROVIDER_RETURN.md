# Reversible core-only backend MVP — #1027 / #967 / #975

Updated 2026-10-19. **Plan and source guardrails, not a live migration or authorization to promote.** The current shipped app is Appwrite Cloud. Preserve Oracle self-hosted Appwrite and Supabase Free as viable independently testable choices.

## First release boundary

- Enable a strictly personal, local-first task tracker: authenticated owner, categories, tasks, Calendar, Todo List, Day View, Backlogs, local edits and two-device owner-scoped cloud synchronization.
- **Current updated MVP scope:** private tasks/categories/Diary **and owner-private task/Diary photos** must work before public release. Diary text/emoji and photo references must sync on signed accounts; photos require private Supabase Storage with owner UUID path RLS, cross-device downloads, ZIP merge/import, encrypted blob DR and negative access tests. Historical Appwrite photos are recoverable only when present in each owner's retained ZIP until the source comes back. Social and shared features remain separately disabled.
- Only social capabilities are outside the updated personal MVP: friend calendar/carousel, Explore, chat, alerts/push, invitations, shared tasks and reactions remain disabled pending separate backend acceptance. **Owner-private Bucket List/links and synced personal settings are now pre-release MVP requirements**; they stay unavailable until real Supabase parity is proven. Never delete stored rows or drafts because a route is hidden.
- Local preferences may still exist, but MUST be explicitly described as device-local until account-synced settings can be safely migrated. New task photo uploads must be disabled until trusted storage exists; preserve references for recovery.

## Capability boundary already staged in source

`src/lib/backendCapabilities.ts` defines a deterministic `full` (default) versus `core-only` frontend profile, two supported MVP sync domain names and typed writer/return acceptance assertions. Unknown modes retain current full Appwrite behavior; **no client flag can grant missing backend capabilities**, and no PostHog/network response is required to use essential core controls.

The profile can be read from the build-only `VITE_MOSAIC_FEATURE_PROFILE`. This is **not** the backend switch, security authorization or complete launch toggle. The current underlying Appwrite Auth and eight-domain sync coordinator are unchanged. Do **not** set the core-only build profile on a real-user deployment or advertise it as a functioning Supabase client until app-level Supabase Auth, writer start/stop, account cache ownership, profile/settings fallback, PWA compatibility and server denials have passed actual signed-hosted/device tests. Tests of `assertSafeProviderSwitch()` establish an intended contract only; the production runtime does not yet execute this guard.

PostHog already supports remote feature flags; eventual rollout may further **disable** supported features. An offline/outage response may never prevent access to previously authorized local core data, and remote toggles never permit unsupported RPCs or cross-account reads.

## Three backend installations and canonical owner identity (2026-10-20)

The provider abstraction now identifies **three distinct backend targets**: `appwrite-cloud`, `appwrite-oracle` and `supabase-cloud`. Both Appwrite installations share one Appwrite API driver; they are nevertheless **different authoritative deployments** with different operational failure, account, quota and backup boundaries. A switch between those two is a real data migration, not a no-op.

`DomainWriter` now requires `canonicalOwnerId` (the independently proven stable Mosaic account identity), `ownerId` (the identity issued by the selected backend), `target`, `deploymentId` and `domain`. `assertSingleCloudWriter` refuses multiple proposed writers to a canonical account/domain **even when backend-native IDs differ or the same Appwrite driver is involved**; it also refuses binding one backend-native owner to two canonical owners on a domain. `ProviderReturnGate` now names both exact source and destination installations, enabling the same reversible checks for Appwrite Cloud ↔ Oracle, either Appwrite ↔ Supabase Cloud, and moves to a different instance of a given target.

These are **in-process contract assertions**, not trusted identity verification, a production-ready backend setting, a distributed mutex, old-PWA fencing, signed account migration or a real import/export pipeline. A malicious/stale client can ignore them; the server-controlled ownership ledger and writer cutoff are still required. The candidate's legacy identity must pass its existing separately injected trusted mapping/fencing guard before starting task/category replication. No provider selection or hosted backend mutation occurs in this source-only work.

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

## App-owned real RxDB core startup bridge (2026-10-20)

`src/lib/supabaseCoreBootstrap.ts` is now a callable **Mosaic application-side** integration of the existing signed Supabase task/category candidate and the app's **actual** Dexie-backed, multi-instance RxDB `getDatabase().tasks` and `getDatabase().categories` collections. It is distinct from the isolated disposable database used by local signed prototype tests. Nothing in `main.tsx` or the existing `AuthProvider` calls it yet; the default shipped Appwrite UI, cached identity, eight-domain sync and backend remain unchanged.

The app-side bridge is intentionally **non-autostarting**. `createAppSupabaseCoreBootstrap` requires explicit `supabase-cloud` + `core-only`, a caller-supplied server-verified Supabase session, verified stable legacy↔Supabase owner mapping, mandatory old-client Appwrite writer-fence + exclusive remote writer-lease callbacks, and a separately awaited local Appwrite writer shutdown proof. These are **injected requirements, not implementations** of the security server. It checks owner/credential epoch before opening the local DB, checks the local writer fence again after DB initialization, then passes actual task/category RxDB collections into the candidate's signed server/lease-guarded core replication. A session change after starting is followed by a mandatory cancellation; an uncertain writer start/stop causes the bridge to enter a blocked state and prevents automatic reacquisition. Returned sync operations cannot be reused once stopped.

This is material application data-layer wiring, **not a functional Supabase backend cutover** or validated multi-device cloud sync. The bridge is deliberately unreachable from the app UI and must remain so until provider-aware Auth/context, real **server-enforced** legacy identity registry, old-PWA Appwrite cutoff, exclusive cross-device lease and actual in-tab writer suspension are implemented. Test-injected no-op guards are insufficient for release, and neither an env flag nor frontend assertions may authorize cloud writes. Account-local cache and checkpoint isolation, trusted app Auth lifecycle, real signed hosted RLS/CAS, reverse import after Supabase edits, independent DR and device acceptance are still mandatory.

### App build TypeScript contract for the shared candidate

The original isolated Supabase candidate was typechecked only under the pilot environment. Pulling it into the real `src/lib/supabaseCoreBootstrap.ts` app dependency graph exposes the app's stricter `erasableSyntaxOnly` and generic RxDB snapshot constraints. Follow-up source repairs explicitly declare error-class fields instead of TypeScript-only constructor parameter properties, type the owner/pull request shape, and narrow the immutable RxDB snapshot types without turning off TypeScript or relaxing data/owner validation. No network/auth/DB operation is changed by the type-only compatibility repair.

## App-owned signed Supabase Auth lifecycle coordinator (2026-10-20)

`src/lib/supabaseCoreAuth.ts` now connects the **real app-side core RxDB bridge** to the previously isolated signed Supabase GoTrue session manager. It is **callable source**, not yet imported by `main.tsx` or mounted as the shipped `AuthProvider`, and it does not select a backend based on a browser flag. This is the first single lifecycle that ties verified login/restore → trusted canonical Mosaic user mapping → real task/category RxDB writer startup and, conversely, stop → logout.

The coordinator stays signed-out until both the Supabase access token is checked through the existing signed Auth verifier and a separately trusted server identity resolver supplies the matching Appwrite legacy ID ↔ Supabase UUID. Identity mapping is rechecked after asynchronous work and before accepting an active owner. Only the mapped legacy owner ID may be used for Mosaic's existing owner-scoped RxDB tasks/categories. No email, locally decoded JWT, `user_metadata`, cached Appwrite user or saved owner hint can grant access.

The coordinator **requires** the bridge's existing explicit `supabase-cloud` + `core-only` selection, a separately implemented local Appwrite stop proof, an independently verified old-PWA Appwrite server writer fence and exclusive cross-device remote writer lease. It neither creates these security infrastructure pieces nor hides them behind no-op production defaults. It does not offer session persistence by default: an opted-in browser refresh-token store requires independently proven cross-tab locking/rotation first. Restoring a session from a test-injected store must still perform real server verification. Offline/failed Auth never exposes a new authenticated owner.

Logout first confirms stopping the RxDB writers, then signs out GoTrue. If writer cancellation is uncertain, the coordinator enters a blocked state and will **not** allow new login, new writer acquisition or migration. A refresh token changes the session epoch; `refreshAndRestart()` therefore stops the old writers **before** rotating and revalidating the account and reacquiring verified writer guards. A lost/changed owner after writer startup forces cancellation; unresolved cleanup blocks the coordinator. A false sign-out result means server revocation was not confirmed, not permission to keep local tokens.

These are application data-layer lifecycle contracts, not a fully usable alternate sign-in UI or cloud cutover. Current Appwrite-only `AuthContextValue`, live provider selection, registered backend origin/Auth policy, cross-tab session protocol, trusted identity registry, old-PWA cutoff/leases, hosted signed RLS/CAS security and reversible import+DR evidence remain required. Continue isolating experimental deployment from real user data.

## Disposable fresh-account application slice (v0.32.0 candidate)

The explicit `VITE_MOSAIC_BACKEND=supabase-cloud` plus `core-only` profile now mounts
`SupabaseAuthProvider` in the real application. Configure `VITE_SUPABASE_URL` and a
modern public `VITE_SUPABASE_PUBLISHABLE_KEY`. This candidate accepts only loopback
or the isolated `mosaic-dev` project; the normal Appwrite build remains the default.
The UI consumes a provider-neutral `MosaicUser`. Foreground/manual refresh routes
through `appSync`; the Appwrite coordinator rejects startup in a Supabase build.
The local database is scoped to the backend installation and preserves the Appwrite
cache. Existing task/category hooks and Calendar/Todo/Backlogs views are reused.

`20261020_core_fresh_identity_authority.sql` is an additional **disposable-only**
migration. Only Auth users created after installation receive a server-generated
fresh canonical identity. Pre-existing users and imported Appwrite identities are
not automatically enrolled. A private authority ledger and signed-session leases
protect both direct inserts and CAS updates, including old candidate clients that
ignore browser guards. Authenticated callers cannot change authority, provenance,
or epochs; freezing or advancing an authority epoch denies subsequent writes.
Multiple devices can hold leases for the same authoritative Supabase backend.
This is exclusive **backend** ownership, not a one-device-only mutex.

Fresh identities have no migrated Appwrite source. This does **not** prove cutoff
of old Appwrite PWAs for an existing user: existing-user migration remains blocked
until the source writer fence, identity mapping, verified snapshots and reversible
deltas are implemented and rehearsed on Appwrite Cloud and Oracle installations.
No hosted migration or real-user data change is part of this source commit.

Credentials remain memory-only in this slice. An authenticated tab can edit offline
and retry after reconnect; reload requires sign-in. Persistent offline authentication,
cross-tab refresh rotation, recovery completion, account erasure and conflict-review
UI remain outstanding. Unsupported account actions fail explicitly. Preferences
are device-local; deferred Diary/social/image data is retained and capabilities stay
disabled. This candidate is not the completed core MVP.

`Supabase Core App Lab` applies the migrations to disposable real GoTrue/PostgREST
services and runs `supabase-core-app.spec.mjs` against the actual Mosaic UI. It tests
category/task creation, offline completion replay, second-session convergence,
foreign-owner isolation, no Appwrite requests, and signed server lease denials.
The lab must pass before claiming these behaviors work. It is separate from hosted
RLS/security, mobile-device, migration/rollback and Production acceptance.

The first app integration review also found a legacy profile fetch reachable from
Home: `useMyProfile` now suppresses reads, retries and mutations when social support
is absent. Core profile name/bio remain device-local; public profile, username and
photo actions are disabled. App logout requests Supabase `scope=local`, preserving
other device sessions. The original isolated Auth pilot retains its default scope.

The actual-app lab also covers task title editing, movement to Backlogs, offline deletion and second-device tombstone convergence. Task menus omit unsupported sharing, photo and bucket-list actions under the core capability profile. These checks use disposable local Supabase; hosted acceptance remains separate.

Real network-denial verification exposed a shared shell bug: lazy loading the offline banner after losing connectivity crashed the route. The banner is now included with MainLayout, so offline feedback and local editing do not require another JS download. The chat browser regression now disables the browser network rather than only changing navigator.onLine.

## Preserved-draft conflict review candidate

A lost create acknowledgement followed by another local edit can legitimately have
no acknowledged base for a conditional overwrite. The draft remains in RxDB; it
must not be treated as synced or silently replaced by the cloud row. The new
provider-neutral Sync Status review shows both versions and lets the owner keep
the reviewed device version through the signed conditional-write boundary.
Cloud revision changes invalidate the choice and refresh the comparison. A newer
local edit requires Refresh comparison, which restarts the parked native batch
through the normal verified writer lifecycle. In-flight decisions drain before
shutdown; account switches clear the UI registry. Missing/protected remote state
stays blocked and retained. A direct discard-device/use-cloud action is not yet
implemented. The real browser case drops a committed create response and changes
the cloud row from another signed session while the device edits offline.
Identical lost-response retries may recover safely without review; the divergent
cloud edit makes the conflict deterministic. Hosted run
`0c81e95968d43d8d80ef5cde` passed review, newer local draft refresh, stale cloud
choice rejection and explicit convergence on a second browser, followed by
verified retirement of all four fixtures. The local stack must also pass the
same case; expiry tests separately assume a fully acknowledged base and hold a
refresh outage until draft-retention assertions finish.

## Persistent offline restart candidate (v0.32.2)

The isolated Supabase provider now injects a browser session adapter when Web Locks
and localStorage are available. It stores a refresh credential and a separately
verified canonical-owner cache, scoped to the backend origin. Access JWTs and
passwords remain in memory. Each login, restore, rotation and logout holds an
exclusive Web Lock and reads the newest durable refresh token. A random browser
family changes on login/logout; stale tabs cannot overwrite or clear its replacement.
Cached identity permits only owner-scoped local data access. Signed Auth, canonical
mapping and server writer guards are still required before remote replication.

The cached owner renders immediately during a real outage or initial connection
check. Reload can open the precached shell and existing RxDB data offline. Restore
outages retain credentials and local edits; confirmed Auth rejection clears the
family. Access-JWT expiry requires renewal rather than being interpreted as refresh
revocation. Closing/unmounting a view pauses writers without signing out other tabs.
Explicit logout still follows the guarded shutdown path. Cross-tab changes clear
the visible owner; pending task/category writes also consult a synchronous,
provider-neutral account fence before dispatch, independently of React rendering.
After a cross-tab account replacement, reload explicitly adopts the new account.

Unsupported browser locking/storage retains the memory-only behavior and says so.
Stored refresh credentials remain accessible to same-origin scripts; this is not
protection against XSS or browser storage eviction. No existing-user migration,
Appwrite source fence or real-user rollout is enabled. Real browser acceptance for
offline reload, shared-family rotation and separate-device isolation is part of
`supabase-core-app.spec.mjs`; `hosted-core.mjs --offline` runs it against mosaic-dev
and verifies fixture retirement even on failure. Exact passing run evidence belongs
in #1027, not an inference from this implementation description.

## Email callback refinement candidate v0.32.3

The Supabase core candidate now routes email confirmation and password recovery
through a separate, provider-neutral view. The backend wrapper exchanges a
one-time fragment token, verifies the live Auth user, displays the target
email, and changes the password only for that verified owner. It does not
mount the ordinary account provider, persist bearer/refresh credentials, touch
the current browser family, or start a writer. Repeated fragment navigation
cleans the URL and opens a fresh action; stale unmounted replies cannot clear
a newer link. Existing Appwrite callbacks remain separate.

Hosted generated-link run `f8d80f40899fefe5742ec2ec` passed both real browser
cases, including active-account preservation, confirmation, password login,
old-password denial and used-link denial. Both fixtures were retired with no
live rows. Earlier run `d160fd0ff3ecf188b8075ab0` exposed same-document callback
navigation and also retired both fixtures; the regression is repaired.
These accounts were admin-prepared: actual public signup and email delivery,
hosted template/redirect rollout, exact-source CI/deployed acceptance and
physical mobile checks remain open. Never infer mail delivery from generated
links or disable confirmation to make the acceptance pass.

## Protected Preview email credential URL repair — reconstruction, 2026-10-21

An anonymous Vercel protection/SSO redirect was observed preserving a synthetic URL fragment, making one-time credential fragments unsafe to email for the protected Supabase Preview. The isolated v0.32.3 source is therefore held until its original hash-bearing templates are replaced. From the archived, uncommitted Codex handoff, `chatgpt/1027-recover-email-code-entry-20261021` reimplements the intended flow (not a byte-for-byte recovery): code displayed in the email body (`{{ .Token }}`), exact clean route links, and an explicitly entered email/OTP sent exclusively in an HTTPS GoTrue verification POST body. The server-verified token owner and email must match before actions; active Appwrite/Supabase browser account families and RxDB writers remain isolated. Already-issued legacy hash callbacks keep early URL cleanup and session-only revocation, but must not be used in new email templates.

`supabase-poc/email-policy.mjs` rejects a credential-bearing or unexpected template before a hosted policy operation, and disposable hosted runners additionally verify generated code, redact code/hash in diagnostics and test URL/referrer leakage, one-time replay and unaffected active owners. External Vercel operator deployment helpers from the expired Codex VM are **not recovered into this Git tree**. Deployment of repaired v0.32.3 still requires separately verified SHA-bound artifact selection, authenticated clean email-policy readback, old-alias preservation on failure and real deployed browser acceptance. Recorded earlier Codex hosted run `ff73923158367002a1923739` applies to the unavailable original workspace, not independently to this reconstructed source. No live Auth policy or Preview alias changes are authorized by this source patch alone.

## Full personal Appwrite source-content snapshot (source-only, 2026-10-26)

`supabase-poc/appwritePersonalSourceRead.ts` is a dormant READ-ONLY
capture path for the **original raw owner columns** of all tasks,
categories, Diary entries and settings, including logical tombstones.
It complements (does not replace) the three-domain task-identity,
Bucket and task-link reader. It preserves literal task memo/image
references, Diary photo-ID JSON, optional null versus absent values,
unsupported Appwrite-specific settings and original server/permission
metadata in memory. It does **not** rewrite account IDs, create
timestamps, convert social references, import SQL, or download photo
bytes. Unexpected Appwrite application fields or nested values abort,
rather than being dropped to match an older RxDB schema.

The caller must supply an independently server-enforced, unexpired
read-only source lease that binds the exact Appwrite endpoint, project,
database, Cloud/Oracle deployment, owner, generation, and frozen counts
for **all seven** personal row domains. It checks the signed
`Account.get`, app session epoch and immutable lease-count witness
around every owner-filtered `TablesDB.listRows` page and both complete
passes of the four content domains. Pages advance by a strictly
monotonic `$id` cursor; local owner checks, exact returned `total`
and deterministic byte-length-prefixed SHA256 hashes reject missing,
reordered, duplicated, foreign or mutated rows—even when totals remain
unchanged. Memory/row/page limits fail closed instead of silently
returning a truncated snapshot.

The resulting provisional `scanSha256` is **not** an independently
authenticated source archive hash; `completeSourceArchive:false` and
`providerCutoverEligible:false` remain explicit. A genuine migration
requires a real **server-side old-writer/offline-PWA fence**, an
independently authenticated encrypted full-content archive, linked
photo Storage object byte hashes and permissions, and a verified
same-lease join to the Bucket/link history before any target SQL
replay. The existing user ZIP is active-only and cannot prove these
invariants. No hosted schema, Appwrite data or live Supabase writer was
changed to create this contract.

## Cross-source seven-domain owner join — source-only integrity guard

`supabase-poc/appwriteFrozenPersonalJoin.ts` verifies that the
full-content tasks/categories/Diary/Settings readback and the existing
task-identity/Bucket/task-link history readback were issued for the
**same original owner mapping, Appwrite Cloud/Oracle installation,
read-only writer-freeze lease ID and generation**. The personal scanner
now retains the server-issued counts of the three historical domains
alongside its four original content-domain counts. Every page-set's
owner IDs, sorted IDs, tombstones and original deterministic SHA256
are rechecked even when the counts match. The two task inventories
must agree *exactly* on identity and deletion state; it cannot join a
deleted task in the historical link inventory to a live task in the
full-content snapshot. Changes to private Diary photo references,
task metadata, settings or original row permissions also break the
joined witness rather than being silently accepted.

It yields a reproducible `sevenDomainScanSha256` and six-domain count
summary while explicitly returning
`fullEncryptedSourceAuthenticated:false` and
`providerCutoverEligible:false`. This **does not make the caller's
read-only lease authentic or stop an old PWA writer**, and a local
digest is not a signed encrypted full-source backup. A trusted
server-enforced fence and independently encrypted full owner-content
plus Storage binary archive must be validated before the joined
readback is accepted as migration provenance.

## Appwrite direct old-PWA write-denial preflight (#1027)

The existing Appwrite manifest gives personal TablesDB tables the
`create("users")` permission with `rowSecurity:true`. Thus a new
frontend read-only flag, DNS change, Supabase lease or stopped Function
**cannot** stop already-installed old Appwrite PWAs: the old client may
still create rows via table grants and update/delete existing owner
rows via per-row ACL. The owner task/Diary photo Storage bucket
`task_images` similarly allows `create("users")`, and enabled
`message-action` has privileged `rows.write` scopes.

`supabase-poc/appwriteWriterFreezePreflight.ts` is a dormant **read-only
administrative preflight**, not a permission migration. It refuses to
recognize any source as provisionally read-only until an independently
obtained, complete admin inventory covers all six current personal
TablesDB tables and the private Storage bucket, with exact frozen owner
row/file counts and **no remaining client create/update/delete**
table, row, bucket or file ACLs. It also requires a complete Function
inventory with **no enabled privileged write-capable Function**, and
a full seven-surface × three-operation matrix of authenticated old
client HTTP 403 denials tied to the exact owner, source deployment and
frozen generation. A 401 from an expired session is **not** proof of
write denial. Missing, duplicated or foreign owner rows/receipts
cause fail-closed refusal; deterministic metadata hashes support an
independent audit.

**Critically:** the source-only preflight never connects to Appwrite,
changes user permissions, disables Functions, rotates API keys or
issues a server-signed exclusive lease. Its output explicitly states
`serverFreezeAuthorityAuthenticated:false`,
`privilegedWriterCredentialsRevoked:false` and
`providerCutoverEligible:false`. An authorized operator must first
provision/restore an encrypted ACL rollback ledger, stage and verify
the actual grants in an independent Scratch installation, prove
old-PWA offline reconnect behavior and privilege/function denial,
audit all admin credentials and old signed sessions, and only then
activate an authoritative time-bound writer-freeze lease. Production
requires its own explicit approval. Never treat a locally constructed
preflight input as a genuine server-admin snapshot or loosen ACLs
simply to make an offline fixture pass.

## Read-only live-admin ACL collection foundation (2026-10-26)

`scripts/appwrite-source-grant-readback.mjs` builds upon the
source-only `appwriteWriterFreezePreflight.ts` contract. It accepts
only an explicit GET-only backend admin requester and verified target
parameters (endpoint/project/database/Cloud-or-Oracle deployment),
reviewed original owner account, full independent per-domain owner
row counts, Function count, and a separately authenticated owner photo
file-ID witness. It reads **all six personal Appwrite table definitions
and their full owner row permissions**, private task-image bucket
configuration and the entire bucket's file ACL index (not just an
active-only ZIP), plus all Functions and their scopes.

Every row page is owner-filtered by `user_id`, sorted by `$id`, and
uses bounded keyset cursors, explicit server `total:true` and
`ttl:0` to bypass TablesDB query caching. Every Storage file and
Function page is also bounded and strictly ordered; all mandatory
owner counts and expected file IDs must match. It checks two complete
independent scans and refuses unexpected metadata, foreign rows,
missing owner media IDs, pagination/count changes, or altered ACLs
between scans, even when the record counts remain identical.
Only immutable ACL metadata is returned to the caller; task, Diary,
setting and photo contents are never emitted.

**It is not activated in the app, no admin credentials are provisioned,
and NO admin or user data was contacted.** The current existing
Production ACL grants would still fail the downstream write-fence
preflight, and the tool intentionally does not call it automatically.
The operator must separately establish that the file IDs belong to
the signed owner and that no other owner files were omitted: Appwrite
file ACLs alone cannot prove owner membership. Consequently the
response reports `ownerFileMembershipIndependentlyAuthenticated:false`,
`authenticatedSourceLeaseIssued:false`,
`privilegedWriterKeysRevoked:false`, and
`providerCutoverEligible:false`, irrespective of a stable GET scan.
Actual server ACL freeze/rollback, API key disablement,
old signed-PWA HTTP 403 denials and authoritative time-bound writer
lease require separate signed Scratch rehearsal and approvals.
The scanner is deliberately a callable library, not a background
job, scheduled task, Production command or unreviewed CLI.

## Offline encrypted exact-Appwrite-permission rollback escrow (#1027)

`supabase-poc/appwrite-acl-rollback-archive.mjs` stages a **source-only,
offline, revertibility primitive** from the separately verified,
double-scanned Appwrite administrative grants collected by
`scripts/appwrite-source-grant-readback.mjs`. It preserves the
**original** permissions on all six personal table definitions and
every enumerated owner row, original private photo bucket settings and
each witnessed owner file ACL, and original Function enabled/scopes
values. Complete frozen per-domain counts, Function inventory,
global bucket-file count and known owner-media ID membership are
validated again. It rejects unknown fields, foreign/duplicate rows,
malformed ACLs, incomplete inventories and any post-readback drift from
the collector's original SHA256.

The caller must additionally supply a **separately authenticated
source-witness SHA256**; that pin is included in the encrypted payload,
but a caller-provided hash is never mistaken for a server signature or
source authority. The private state is copied synchronously, then
encrypted with an age X25519 recipient **without writing plaintext
files or logging original grants**, to a 0600 ciphertext in an
existing, owner-owned private 0700 directory. The ciphertext is
fsynced and published via an exclusive no-overwrite hard link, then
the directory is fsynced. A separate decrypt verifier demands
independently pinned ciphertext SHA, original plaintext SHA, admin
grant snapshot SHA, source-witness SHA, exact owner and original
Appwrite installation. It validates all grants and original counts
again after decrypt and returns only metadata, never ACL records.

The disposable GitHub Actions ACL escrow lab uses a **synthetic**
pre-cutoff set of permissive grants, a generated age key and real
encrypt→decrypt, original byte equality, overwrite refusal, checksum
drift, malformed/foreign/duplicate rows and even a re-encrypted
malicious manifest with matching hashes. No real Appwrite project,
credential or user record is accessed. The module is a library with
**no automatic ACL restoration**.

**Not a migration freeze or Production approval.** Before use on any
real operator source, separately prove the admin inventory is
authenticated and complete (including Storage owner membership),
independent writer authority/revoked privileged API keys, signed
authenticated old-PWA 403 denials, captured offline device outboxes,
Scratch freeze/rollback/reconnect acceptance and encrypted escrow
retention. A 401 does not prove a write-fence. The decryption function
explicitly returns `sourceLeaseAuthenticated:false`,
`aclRestoreAuthorized:false` and `providerCutoverEligible:false`.
If an owner's ACL inventory exceeds the in-memory size bound, fail
closed and design a streamed authenticated export; do not truncate.

## Ed25519-pinned seven-domain source reader authority (#1027)

`supabase-poc/appwriteSignedFrozenAuthority.ts` closes the gap where a
caller could return an arbitrary in-memory `readOnly:true` lease to
the seven-domain Appwrite readers. It **requires a detached Ed25519
signature** on a strict canonical JSON source freeze witness, checked
against an **independently pinned SPKI public-key SHA256**. The
signature binds the actual Appwrite endpoint/project/database and
Cloud/Oracle source identity, signed owner, time-limited lease ID and
generation, unique nonce, exact frozen owner counts for all seven
domains including tombstones, plus the previously authenticated ACL
inventory SHA256, signed old-client denial matrix SHA256 and actual
server write-fence receipt SHA256. Unknown fields, changed signatures,
other signers, expired/replayed leases, long lifetimes or mismatched
owner/counts/deployment fail closed.

The higher-level `readPinnedAppwriteSevenDomainSource` passes the
**verified lease only** into both existing signed-owner history and
full-content readbacks; each fetches and cryptographically rechecks
the current server receipt around every Appwrite page, then validates
the joined counts, original identities, tombstones and content
fingerprints. An altered signature or changed signed generation
aborts a scan rather than returning a partial snapshot. This library
contains NO Ed25519 private signing key, credential, backend writer,
privilege revocation, issuance endpoint, CI secret or automatic app
activation. Unit fixtures generate a disposable Ed25519 key pair and
synthetic signed owner-only Appwrite page replies; they do not call
the actual provider.

**Scope boundary:** the signature only proves that its externally
pinned authority key signed the stated witness. It does **not** prove
that the real Appwrite server actually revoked table/row/Storage
rights, that an issued write-fence receipt is genuine, that old
installed PWAs cannot reconnect with queued writes, or that
privileged Functions/API keys are disabled. The production
`actualBackendWriterFreezeConfirmed:false` and
`providerCutoverEligible:false` flags remain hard release gates
until a trusted signer/lease issuer is deployed in disposable
Scratch, an independent admin+old-PWA 403 audit succeeds, and the
encrypted original ACL rollback archive can be read back safely.

## Six-domain personal Supabase runner — isolated harness only (2026-10-26)

`supabase-poc/candidatePersonalRuntime.ts` now assembles the previously tested,
owner-scoped task/category/Diary/portable Settings/Bucket List/link RxDB
replicas into **one** six-domain candidate harness. This is not imported by
the shipped `supabaseCoreBootstrap`, `SupabaseAuthProvider`, or feature
profile. Its only accepted input profile is `personal-review-only`; core
build profiles remain unchanged.

Unlike an ordinary optional Settings adapter, its startup requires **all**
six distinct RxDB collections, a separately isolated portable Settings
collection (never the shared avatar/social Settings collection), full
signed source owner mapping, a real backend-exclusive Appwrite writer fence,
fully hosted private six-domain SQL/Storage/DR readiness, independently
retained original owner Settings/media/outbox escrow, and verified same-owner
Bucket task targets. Each server-guarantee callback must be supplied by a
*trusted future caller*, and the signed account/session is rechecked between
all asynchronous guards and replication starts. These callbacks are NOT
implemented as server authority here and must not be replaced by boolean
browser flags or claimed as real live readiness.

The candidate runner shares one writer lease across all six domains; startup
failures cancel all started replicas and release authority only after confirmed
stops. Uncertain cancellation/lease release **retains and blocks** that
authority. Manual Sync Now performs refresh, full signed owner anti-entropy,
and final settlement on all six groups, including tombstones, never reporting
100% while any group differs or conflicts remain. Re-entrant startup,
revoked leases and changed Auth owners fail closed. Link writes require a
fresh externally verified target lookup through the existing isolated
adapter.

A dedicated synthetic lifecycle test suite covers startup/preflight order,
cross-owner changes, partial-start teardown, no-double-writer guarantee,
paused retained lease, all six progress groups, conflicts and drift. It
does **not** install hosted Settings/Bucket SQL, upload/restore original
photo bytes, enforce the backend-exclusive server lock, migrate historical
rows or activate any user-facing feature. The protected hosted Preview
approval and explicit Production/provider transition are separate gates.


## Gated six-domain final Sync Now completion fence (2026-10-26)

The isolated non-shipped six-domain pilot must not emit **100%** merely
because the last Bucket-task-link RxDB resync returned. Its complete-owner
anti-entropy scan and final readback already cover every portable private
domain; the final progress callback now runs **after** the last signed
owner/session/lease freshness check and the last pending-conflict recheck.
A late conflict raised by final settlement fails closed without a false
success UI, and an Auth owner switch before final settlement never emits
completion. Both paths have lifecycle regression tests. This does not make
simulated CI equal actual hosted two-owner HTTP proof or enable the app;
full ten-table age + Storage R2 DR and protected Preview activation remain
separate accepted release gates.
