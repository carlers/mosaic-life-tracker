# M2 owner-only ciphertext staging — Scratch and source only

## 2026-11-25 v0.114.8 candidate — authenticated legacy direct-create replay (no backend mutation on deployment)

The independent [ops #334 resolved seal](https://github.com/carlers/mosaic-server-ops/issues/334#issuecomment-7082721509) already established closed table and bucket browser-create grants *before* M2-ON. The current signed M2 Function release guard rechecks six table metadata $permissions=[] and zero legacy rows, the old task_images bucket permissions=[]/zero files, and owner ciphertext ACLs. Thus the old OFF-only general seal preflight returning blocked while M2-ON is not evidence of seal failure. Do not re-seal or turn M2-OFF.

This opt-in hidden synthetic Scratch-only UI uses the current owner's authenticated browser session and explicit root/MFA gate. It submits individually valid disposable canary row shapes against the six historical direct TablesDB create routes, then an old task_images create, using the exact normal guarded Appwrite SDK paths. Only explicit HTTP 401/403 counts as denial. Any success stops immediately and preserves the canary for isolated admin inventory and cleanup; 400/409/network failures are INCONCLUSIVE, not PASS. The UI never displays raw response bodies, identifiers, or credentials. No requests run automatically. No normal RxDB mapping, owner flags, server ACLs, existing ciphertext, schema or Production code is changed. A 7/7 browser result still does NOT prove old installed-PWA controller, queued offline edits, existing-row ACLs or migrations; those require separate acceptance.


## 2026-11-24 v0.114.7 candidate — explicitly bounded Storage redirects

v0.114.6 isolated MFA owner synthetic image test still returned 503 `storage_transport_unknown`; root host Storage still lists zero files. Same selected deployment `6b059ea892758ff3dd17`, isolated branch SHA `c5484f1e8bc3129637a15d43ce8f3469b45bb7e5`. The observed `TypeError('fetch failed')` has a reproducible cause: `fetch` with `redirect:'error'` rejects an HTTP redirect using a generic `unexpected redirect` cause without a numeric error code. By contrast, node-appwrite's original fetch implementation followed redirects and reached an HTTP rejection. No **live** redirect has yet been observed; this is a specific falsifiable hypothesis.

Keep exact immutable binary multipart bytes, deterministic file ID, single owner/MFA authorization, zero browser ACL, Function-injected key, independently verified ciphertext download and safe error classes. Change `redirect:'error'` to `redirect:'manual'`; for one 301/302/307/308, explicitly reissue the **same POST and bytes** only to the same origin or hard-pinned public Scratch HTTPS origin `https://129-221-244-67.sslip.io` and identical Storage path. Reject redirects to arbitrary hosts, new query, userinfo, different path or HTTPS downgrade, and reject a second redirect. Treat blocked redirect as a fixed safe `storage_transport_redirect_blocked` error. No automatic SDK redirect method-switching, credential exfiltration or unrestricted follow. Node18 loopback checks 302 POST preservation and bad-target denial with global fetch broken.

This candidate remains gated behind exact focused, full canonical CI and signed isolated Scratch owner-only deployment. No migrations, ACL/Function scope, normal Preview/dev/main, Production or general E2EE rollout.


## 2026-11-24 v0.114.6 candidate — isolated Function network stack

Owner's authenticated v0.114.5 test after sign-in: outer execution HTTP 201, inner HTTP 503 at 67 ms with safe `storage_transport_unknown`; account GET 200. This is a no-response transport error, not a Storage rejection. The previous SDK implementation reached Storage, but its multipart was rejected; the v0.114.5 explicit multipart reached neither HTTP response nor timeout because it used Node 18's global `fetch` instead of the Node Appwrite SDK's imported `undici@6`.

Candidate keeps the host-probed exact binary multipart format, fixed Scratch project, platform-injected Function API key, deterministic opaque IDs, zero browser ACL, authenticated ciphertext and mandatory independent byte-readback. It switches only to `undici@^6.27.0` (same supported transport major as node-appwrite@29). It also recognizes bounded nested Node network failures as fixed safe classes without exposing keys, hosts, messages or stack traces. Node18 loopback regression tests explicitly force global fetch to fail, verify 17- and 65552-byte byte-identical multipart and negative metadata, plus nested socket classification. **The underlying failure is still unverified**; this is a network-stack hypothesis requiring exact full CI and owner synthetic browser acceptance.

No changes to normal Mosaic photo sync, legacy writers, migration policy, owner/MFA gates, bucket policies, Preview/dev/main, or Production.


## 2026-11-24 v0.114.5 candidate — explicit multipart Function upload

The synthetic owner browser reported outer POST execution 201, inner
execution failed/503, 74 ms, redacted reason storage_request_rejected
(native Storage 400/422). Exact active Function source was v0.114.4.
The bucket remained empty after failure. Auth, gateway and timeout are
not the observed failure. The exact native error type remains unknown.
The independently successful root canary sends explicit binary multipart
with a closing CRLF, without SDK format headers. This candidate uses the
same narrow wire format under the existing Function-injected key and
endpoint, checks opaque ID, exact bucket, empty permissions and size,
then retains mandatory independent ciphertext byte verification.
Only fixed documented native rejection types may escape the handler;
unknown types are collapsed. No raw responses, keys or content logged.
No changes to permissions, encryption, chunk IDs, owner/MFA gates or
normal app transport. Loopback tests exercise 17 and 65552 bytes and
negative metadata/error checks; only live authenticated Scratch can prove
the fix. No promotion or further activation before exact full CI.

## v0.114.4 canonical acceptance and live transport verification checklist

The v0.114.4 staging patch is a diagnostic and idempotent-ACK improvement,
not evidence that the user-reported Function-side HTTP 503 is cured.
The owner-side signed synthetic Storage canary has already established that
host-local uploads and exact readback work at 17 and 65,552 bytes.
The completed-MFA Function gate separately calls Account.get() through the
Function-injected API endpoint before entering encrypted-media upload.
Therefore a broad Function DNS or endpoint failure is **not proven**, even
though an upstream Appwrite issue described a *scheduled-function* endpoint
bug. Never change host domains, TLS, Docker networking, or API permissions
based solely on that unrelated report.

For acceptance, require all of the following **separate** live evidence:

- An exact stable E2EE branch commit with **canonical-acceptance SUCCESS**
  (not merely the enclosing Quality Gate workflow marked success while its
  core jobs were skipped). Since the stable branch is under `chatgpt/**`,
  a squash commit must include `[verify:full]`, or use an authenticated,
  explicitly authorized full workflow dispatch.
- A dedicated E2EE Vercel Preview built at that exact app SHA, READY, with
  the registered Scratch CORS-safe alias resolving to it and build variables
  verified against isolated project 6b00671500279e901846.
- A separately approved Scratch-only, root-HMAC signed owner-MFA Function
  release from that exact full-CI SHA. Preserve current selected deployment
  6b04061692d4d7d0d3d6 as independent rollback and the preexisting original
  M2 activation/rollback chain. A Vercel-only rebuild does **not** deploy
  the server diagnostic handler.
- Real synthetic owner upload through the *Function's execution key* with
  server ciphertext readback and client AEAD decrypt; a root-admin canary,
  an SDK localhost test, or local-only AES-GCM test cannot substitute.
  If it fails, use only the new allowlisted transport classification, HTTP
  status and client stage; no raw SDK errors, bearer credentials or real media.

No generalized E2EE cutover, durable media outbox, old-PWA write replay
acceptance, normal Preview migration or Production promotion is implied.


## 2026-11-23 same-file retry after validated Scratch Storage probe (staging v0.114.4)

Independent owner-run host-local Scratch Storage canaries of 17 and 65,552
bytes both returned HTTP 201, byte-identical HTTP 200 readback, HTTP 204
cleanup and verified zero final bucket inventory. The prior live Function
`6b04061692d4d7d0d3d6` on Appwrite Scratch still returned
`storage_write_unknown` (HTTP 503) on the same encrypted photo and retry.
This proves that the bucket and host-local API can create and return both
file sizes under the **root Scratch credential**. It does not prove that
the Function's ephemeral execution key or in-container API transport works.

The Function already checks completed MFA by calling Account.get() against the
same APPWRITE_FUNCTION_API_ENDPOINT before attempting Storage. A wholly
unreachable injected endpoint is therefore less likely for the authenticated
HTTP-triggered owner test; the specific Storage path/credentials still need
verification. Upstream Appwrite has separate bugs involving incorrect
injected endpoints on scheduled runs, but there is no live evidence this HTTP
run is one of them. Do not edit host DNS, Appwrite domain/TLS, bucket ACL,
allowed owner, or Function scopes to fit a guess.

The isolated media upload handler now classifies a *bounded* set of SDK
`fetch failed` root-cause codes (DNS, refused, timeout, reset, TLS,
invalid multipart payload), or invalid SDK InputFile, into safe constant
reason strings. It never serializes a raw error, endpoint, credential, request
data or stack. A no-HTTP-status failure also does **one read-only exact-ID
ciphertext reconciliation**: if the server actually persisted identical
bytes before the ACK disappeared, return duplicate; mismatch is collision,
and unverifiable readback returns a sanitized failure. All previous
M2 owner/MFA gates, 64-KiB chunk sizes, immutable AEAD, zero browser Storage
permissions and per-chunk readback remain unchanged.

Focused handler and transport tests prove the redaction, finite cases,
same-byte recovery, wrong-byte collision and no implicit extra write. The
Node18 real-SDK synthetic multipart test is kept in contracts.
This remains an *unproven* runtime repair until an exact-SHA Scratch release
and user synthetic photo retest. No normal app photo sync, offline outbox,
legacy replay or Production E2EE is authorized.


## 2026-11-23 HTTP 503 synthetic media upload hardening (v0.114.3)

Owner browser reported Stage: upload, Result: HTTP 503 after the v0.114.2
diagnostic release. Source audit identified a concrete misclassification:
the Function translated *every* non-409 Storage create error into HTTP 503,
and also masked a server-side post-create readback failure as HTTP 503.
Neither proves the native Storage failure; direct execution logs and live
Function file scopes are not exposed through the bounded Oracle connector.
The live encrypted bucket independently listed zero files after the attempt.

The isolated owner/MFA-gated media handler now returns fixed, redacted Storage
classifications for authorization, missing bucket, rejected payload/size,
rate limit, service outage, unknown write and failed server readback.
The browser only accepts known codes; it never exposes Appwrite exception
messages, IDs, secrets or raw response bodies. For native 502/503/504 the
server tries the same opaque ID and identical ciphertext **at most one extra
time**, treating 409 as successful only after exact persisted-byte verification.
Other failures never automatically retry. This is a bounded transport
mitigation plus root-cause diagnostic; it is NOT proof of successful live
Storage upload. If the native Storage cause is an invalid Function scope or
bucket drift, fix it only through a separately reviewed isolated Scratch
operator after full ACL/source readback. No browser Storage ACL is broadened.

A server Function deployment from this source must be separately prepared and
activated through the CI-pinned, receipt-gated isolated release operator;
the front end alone cannot surface native Storage classifications. Normal
Mosaic photo sync, durable media retry/outbox, old-client replay and full
M2 general release remain unverified.

For the next synthetic owner test, retain the exact selected photo and report
**Stage**, **HTTP result** and the new safe **Storage** classification if an
upload still fails. If `storage_write_forbidden` is returned, first independently
inspect the live Scratch Function's `files.write`/`files.read` scopes and exact
Storage bucket policy; do not add any browser Storage permissions or broaden
the user MFA/allowlist to mask the failure.


## 2026-11-23 synthetic-media upload timeout and safe failure diagnostics

Owner-reported remote encrypted-media verification failed on v0.114.1 while
the dedicated Scratch bucket independently returned zero files. This
observation does not prove the failing operation, because the client hid
both HTTP status and transfer phase. The synthetic media-specific Function
execution now uses a 28-second timeout (within Appwrite's documented
30-second synchronous ceiling); ordinary private-record RPC remains
15 seconds. Client checks distinguish upload, ACK, server readback and
decrypt errors, reporting only whitelisted phase, HTTP 400-599 status
or local timeout classification. No raw SDK error or file contents are
logged, stored or displayed. Existing immutable ciphertext retry, owner/
MFA gate and zero browser Storage ACL remain unchanged.

This is client-only mitigation and diagnostics, NOT successful live
remote encrypted-media acceptance or normal Mosaic encrypted photo sync.

## 2026-11-23 synthetic-photo test UI correction

The isolated Scratch M2 single-synthetic Function activation was independently
read back at deployment `6b038e56e1e316a10cd1` under exact project
`6b00671500279e901846`. A screenshot after **Verify local photo encryption**
showed the stale hardcoded message “Remote upload is NOT yet enabled”; the local
button had never exercised the separate remote transport path. The hidden M2
lab now distinguishes local-only AEAD PASS from remote ciphertext upload,
server readback, download, and owner-authenticated decrypt PASS. Failures are
reported in the media section, retry reuses the same in-memory ciphertext for
the selected file, and selecting another photo clears the result and cache.

This is a **synthetic-only** test fix, not evidence that remote media upload
passed live browser acceptance and not authorization for normal Mosaic media
sync, durable media outbox, legacy PWA write cutover, or Production E2EE.


## M2 encrypted media chunk transport — source stage 2026-11-22

The staged synthetic owner Function now accepts `media_put_chunk` and
`media_get_chunk` only after exact Scratch owner, completed MFA, synthetic
allowlist and default-OFF general M2 feature flag checks. Each maximum
64 KiB plaintext AES-GCM chunk (up to 65552 ciphertext bytes) is transferred
through the Function, stored under a deterministic caller-owner/media/key/chunk
hash ID into `private_owner_media_v1` with **zero browser file permissions**.
No plaintext, image MIME or original app ID is sent. After a write the server
reads back exact ciphertext; retries with the same opaque ID and identical
bytes are idempotent and collision mismatches are rejected. All client
replays use an already sealed `EncryptedMedia`, never regenerate a nonce
for a lost response. The client re-fetches every uploaded chunk, checks exact
metadata and ciphertext, then decrypts under authenticated owner AEAD.

The hidden M2 synthetic UI can test remote upload/download and compare
original image bytes **only if general owner M2 activation is separately
approved**; it is OFF currently. This is a staged, bounded 64KiB Function
transfer, not a deployed normal task/Diary photo adapter or native Appwrite
Storage-browser write permission. Persistent offline photo queue and
orphan media cleanup are not implemented; these remain security/migration
acceptance gates. No live Scratch Function deployment of this source,
backend bucket permission, normal Preview/dev/main or Production change
is implied by this source-only stage.

## Isolated Scratch six-domain synthetic UI — source stage 2026-11-22

A dedicated lazy Settings route `/settings?e2eeM2=1` now provides a
separate authenticated/MFA-gated test surface for the **six staged private
owner domains**. It refuses any project other than isolated E2EE Scratch
`6b00671500279e901846`, checks live account owner before protected
actions, requires independently saved/re-entered emergency recovery key
before remote root creation, reuses existing wrapped-device IndexedDB
keyring, supports recovery on a fresh browser, encrypts/decrypts authenticated
owner-domain records, and stores immutable ciphertext intents before
trying remote writes. Offline/network failure preserves the queue for a
manual retry. All test data must be synthetic; UI does not show decrypted
rows until unlocking. Local AES-GCM photo chunk round-trip can be tested,
while **remote encrypted photo upload requires separate live test acceptance**.

This is intentionally NOT the normal Mosaic RxDB replication/Calendar UI,
nor a claim of M2 cutover. The backend general-owner flag is default OFF
until independent legacy TablesDB/Storage writer denial, source
attestation, encrypted normal-app adapter, media upload and cross-device
acceptance. The hidden M2 route cannot bypass the server feature gate. The isolated
single-synthetic M2 flag was subsequently activated on 2026-11-23; this does
not activate normal Mosaic encrypted sync or Production.
No existing test accounts or synthetic M1 diary root were modified by
adding the new source. Normal Preview/dev/main/Production are untouched.


## M2 legacy direct-write inventory — 2026-11-22 (source only)

A new **read-only** checker `scripts/inspect-e2ee-scratch-legacy-writer-floor.mjs`
enumerates the six legacy browser-creatable private tables (tasks,
categories, Diary, settings, Bucket List items and links) plus the legacy
`task_images` Storage bucket. It requires exact isolated Scratch project
ID, exact Git-owned schema/permissions and separately verified zero
Appwrite plaintext rows and zero legacy files. It explicitly reports
`browser-create-open` or `table-create-closed`, without ever sending
an Appwrite write. Nonzero or redacted inventory, unexpected index/column,
permissions or bucket policy blocks the checkpoint. The source tests prove
wrong Preview/TEST/Production rejection and no POST/PUT/DELETE calls.

At the live Scratch checkpoint, the Oracle scoped read-only manager reports
zero rows in all six legacy tables and zero `task_images` files, but its
bounded response omits complete legacy ACL/schema evidence. This means a
complete live run of the new checker is **not yet performed**. A future
separate root-owned exact-source E2EE Scratch operator must perform these
fixed read requests, then perform an approved, carefully staged
table/bucket/row writer-denial migration with independent readback. The
existing generic Oracle typed manager cannot update tables/buckets and
must not be broadened or used with Preview's legacy alias. Even a zero-row
snapshot is not an atomic fence: an installed old PWA could create a
row between preflight and permission changes. The account-level migration
must stop/coordinate all old Function/direct/Storage writers, prevent replay
and prove no recoverable unsent edits were lost before any M2 cutover.

This checker does not switch permissions, enable `MOSAIC_E2EE_OWNER_ENABLED`,
rewrite plaintext, migrate images or make any claim of completed E2EE.
Normal Mosaic Preview/dev/main and Production remain unchanged.

## M2 Scratch legacy Function action fence — 2026-11-22 (source only)

A source-only, project-and-feature-gated **Function-side** deny policy
now blocks legacy write/action names when **both** exact isolated Appwrite
Scratch project `6b00671500279e901846` and the separate default-OFF
`MOSAIC_E2EE_OWNER_ENABLED=true` are present. This is not the unrelated
synthetic `MOSAIC_E2EE_PILOT_ENABLED` flag. All legacy HTTP actions,
internal category mutations and event handlers are denied at the central
Function dispatcher before old row/media handlers. Only independently
guarded M2 owner ciphertext/M1 synthetic Diary actions and authenticated
account-erasure entrypoints are allowlisted. When enabled, scheduled
maintenance performs account-deletion retries only, not legacy
task/notification/media maintenance that could rewrite plaintext.
Normal Preview, TEST, Production, and current Scratch (flag OFF)
are unchanged.

This is **defense in depth, not the complete E2EE writer floor**.
Older installed PWAs still have direct `TablesDB.createRow` permissions
through existing `ownerTable()` grants, and may hold owner-row update
permissions or legacy `task_images` Storage upload rights.
Those cannot be blocked by a Function dispatcher. Schema/row/file ACL
migration, old-client offline replay testing, server-side deployment
attestation, and encrypted RxDB integration remain mandatory BEFORE
enabling the general M2 owner flag. Source-only tests exercise wrong
project/flag, old actions, event denial, ciphertext bypass-free allowlist
and unchanged default-OFF behavior; no live Function or backend update is
part of this change.

## M2 authenticated encrypted mutation feed — 2026-11-22 (source only)

The staged `list` ciphertext API is a **snapshot**, paginated by opaque
`$id`. It cannot be used as an incremental RxDB replication cursor: an
update to an earlier row ID moves nowhere in ID order and would be lost.

A separate `changes` action now stages a bounded, owner/MFA-gated encrypted
change feed for six owner-private domains. It uses Appwrite's **server-owned**
`$updatedAt` then `$id` with lexicographically tied ID keyset continuation;
it does not trust the client-controlled `updated_at` routing field.
The server returns only ciphertext records and server timestamp/opaque-ID
checkpoints, not semantic IDs or plaintext. It rejects bad cursors,
foreign/other-collection rows, malformed or regressing timestamps, damaged
envelopes, and oversize pages. The client validates row order and matching
checkpoint, decrypts every record with owner/project/row/revision AEAD
binding, checks deterministic opaque IDs, and only then releases a cursor
to the caller. Tombstone state travels through authenticated routing.
An idle poll repeats its last verified cursor without fabricating progress.

This is an **incremental transport primitive**, not yet a live RxDB plugin.
Its correctness still requires a live Appwrite index/runtime test on the
isolated Function, long-running concurrent-write feed acceptance, complete
migration, and a server-enforced legacy direct-write barrier. A cursor is
not a complete atomic cross-domain snapshot and cannot independently prove
every other device has stopped plaintext sync. The owner Function flag
remains OFF; the currently active Function's older SHA does not carry this
new staged action. No Function, schema, data, or E2EE flag was changed by
this source-only step.

## M2 shared private-write preflight — 2026-11-22

The existing shadow migration rejected public/inherited visibility and
plaintext media references, but the lower-level owner ciphertext writer
could be called independently without those same checks. A single
`ownerPrivateWritePolicy` source gate now rejects unsafe inputs for **both**
shadow migration and direct encrypted mutation preparation, before any
ciphertext operation is queued or sent. It rejects wrong owner/document IDs,
unknown fields, public/follower/missing visibility for tasks/categories/Diary,
legacy media references, media-related settings keys, unsafe routing values
and oversized record payloads. The ciphertext-only outbox and raw commit path
independently reject public/nonprivate routing even if a caller constructs an
encrypted mutation manually.

Unit coverage round-trips all six currently staged owner-private domains
(tasks, categories, Diary, Bucket List, Bucket List links and safe settings)
with real client WebCrypto, verifies semantic IDs and private content never
appear in the wire record, and exercises wrong-owner, media, metadata and
manual-outbox bypass negatives. This is a source-level staging invariant;
missing backend ACL inspection, old-PWA plaintext-writer closure, valid
snapshot provenance, future encrypted media references, and live Scratch
owner-transport activation remain separate blockers. No legacy data is
rewritten, deleted, cut over or deemed encrypted by this change.


## M2 isolated Scratch source boundary repair — 2026-11-22

Live app/ops inspection confirmed E2EE Scratch project `6b00671500279e901846`,
while ordinary Preview remains project `6ae94a2100014d01f5ed`. Four legacy
M2-adjacent source paths still accepted the old Preview ID rather than the
isolated Scratch ID: the owner RPC, owner table migration, private media
bucket migration, and synthetic Diary table migration. All now permit **only**
the isolated Scratch project; targeted tests explicitly prove the normal
Preview, TEST and Production IDs are rejected before any network request.
The client additionally requires the pinned Appwrite endpoint and owner scope.

The synthetic Diary migration was additionally hardened: a successful table
creation POST is not proof of safety. It now requires an independent full
readback of empty table-wide permissions, enabled row security, all expected
columns/indexes and table identity, refusing missing ACL fields, partial
schema, or unverified post-create state. The owner and media migrations
already required independent schema/ACL readback. No migration was executed
by this source repair.

Read-only Oracle Scratch broker status reports the two M2 owner tables with
six and ten columns, respectively, and both `task_images` and the
`private_owner_media_v1` bucket present. Its bounded summaries **do not
expose sufficient ACL or encryption settings** to verify table-wide/row
permissions, bucket security or full migration identity. The bootstrap
worker reports `media_ready`. The existing Function is authorized only for
the separate single-synthetic Diary pilot, and general `e2ee_owner_v1`
remains default OFF. This is an environment-routing and fail-closed source
gate, **not M2 activation**. No existing data, Function deployment, media,
legacy writer, old PWA or general Preview backend was changed. Do not issue
M2 owner/media mutations until authoritative restricted-ACL and live
Function readiness gates are satisfied.


This candidate defines two **new**, server-only tables: `account_crypto_roots_v2`
and `private_owner_ciphertexts_v1`. The generic E2EE root is deliberately
isolated from the synthetic Diary pilot's older incompatible account-root
domain. A root envelope is always encrypted on the browser; the server has
owner-routing metadata, never the recovery secret or data root.

**Migration 028** is explicitly opt-in (`--only 028-e2ee-owner-staging`)
and rejects any project other than the pinned disposable Oracle Scratch ID.
Both tables use row-level access control and **no table create/update/delete
permissions** for browsers. When a Function creates a row it must grant only
owner-row read permission. Default migration runs exclude migration 028.

**Security gate:** A table alone does NOT close legacy direct writes to
`tasks`, `diary`, `settings`, `categories`, `messages`, or the
`task_images` bucket. Those paths remain plaintext until all affected
client writers, old signed-in PWAs and row/file ACLs are reconciled with
a tested, resumable migration and an explicit account cutover.

The owner-record transport is limited to user-private domains. Social,
chat, shared tasks and public publishing require independently authenticated
recipient keys and separate protocol work (#2085). Storing opaque ciphertext
in this table does not imply that other server-side notifications, search,
analytics or historical disaster-recovery snapshots are encrypted.

No live Scratch schema or Function change is asserted by this document.
Migration/readback tests and synthetic quotas must pass before activation.

**Owner ciphertext Function source:** The opt-in `e2ee_owner_v1` action adds atomic owner-root create/recovery-CAS and strict private-record create/get/list/CAS. It is **disabled by default** and refuses every operation outside exact Oracle Scratch and explicit synthetic MFA/owner allowlist. A separate table namespace prevents the old pilot root domain being reused accidentally. Server validates only allowlisted routing metadata, rejects `published` and unknown document fields, and never receives raw content or recovery secret. It accepts only owner-private records, not chat/shares. No active Function change or database mutation is claimed. The disabled Function code still needs backend and browser tests before an activation decision.

**Shadow migration preflight (M2):** A new source-only staged migration accepts only an explicitly complete/fresh, owner-scoped snapshot of all six owner-private collections and a memory-only root. It rejects public/follower visibility, any current plaintext file references, unclassified fields, duplicate/oversize records, partial collections and batches larger than the protected outbox's bound. Already-encrypted records are read back and AEAD-decrypted; mismatches abort. New records go to the ciphertext-only outbox *before* remote writes, with readback verification and idempotent replay. It never mutates legacy plaintext tables, makes cutover decisions, or rekeys a compromised account. Source fingerprint is not a substitute for signed/atomic server cutover or old-PWA fencing. The network replay path cannot be exercised on Scratch until its disabled Function is deployed and migrated with correct ACLs.

**Live Scratch schema creation checkpoint (2026-11-20):** Using exact isolated Oracle Scratch `life_tracker`, the typed Oracle broker accepted creation (HTTP 201) of the two new tables, all 16 required columns (HTTP 202), and both requested indexes (HTTP 202). Readbacks: 2 tables present, six root columns and ten owner ciphertext columns; all 16 independently inspected as `available`, required, with matching types; index listings each contain one index. **Still unverified**: complete table/row ACLs and index uniqueness (broker's read summaries omit those fields), full application Function deployment (`message-action` reports `live:false`), synthetic MFA operation, and legacy-write floor. No owner records were migrated or exposed. The dedicated migration 028 remains opt-in and the new endpoint disabled by default. Do not activate any protected write path until the restricted permissions and source-deployment SHA can be read back authoritatively.

**Private media source-only codec (M2):** New browser WebCrypto AES-256-GCM codec encrypts supported compressed image Blob bytes before any future remote media upload, deriving an independent key for each random 128-bit opaque media ID and authenticating every fixed-size chunk, immutable owner/project/key ID, sizes, count, order, and MIME metadata. MIME is encrypted; ciphertext file size and chunk count are disclosed. It rejects modified, truncated, swapped, cross-account, wrong-root and unsupported HTML/SVG image payloads. 12 MiB bound, 64 KiB chunking, one-pass in-memory media encryption and independent crypto tests. This **does not authorize any existing Storage upload**: a dedicated ciphertext-only bucket with server-side upload acceptance/ACL and migration of historic media is still required. Do not replace current `saveTaskImage`/`saveDiaryImage` while old client uploads and media Function routes remain plaintext.

**Cross-device staged owner page decryption:** The client can now read and AEAD-verify a bounded 20-row owner/collection page from the disabled Scratch Function, compare deterministic opaque IDs against plaintext IDs stored inside the ciphertext, enforce strict owner/project/key/collection metadata, reject duplicate or nonmonotonic page cursors and reject scans beyond 500 records instead of pretending a partial result is complete. This is explicitly a **full bounded snapshot scan, not RxDB live incremental replication**. Appwrite's current server list orders by opaque row ID and cannot observe subsequent edits to rows before an earlier cursor; do NOT attach it as a live pull checkpoint until a reviewed monotonic update feed is implemented.

**Privacy correction (2026-11-20):** Shadow migration's old `sourceFingerprint` was an unkeyed SHA-256 of ordered private record values, which would be inappropriate to export or log because short titles and diary text are guessable. It now derives a domain-separated nonextractable HMAC-SHA-256 receipt key from the account root, scoped to project and owner; same snapshot and root reproduce the same receipt for interruption detection, while wrong root, owner and content differ. No raw private content, root or receipt is sent to a server. Receipt is still *not* a cutover/old-PWA write-fence or proof of backend migration success.

**M2 dedicated ciphertext Storage schema (source-only 2026-11-20):** Opt-in migration `029-e2ee-private-media` defines a separate Scratch-only `private_owner_media_v1` bucket with no browser-wide ACL, per-file security, a 12MiB+AEAD-tag hard size ceiling, only `.bin` opaque encrypted files, no server-side image transforms, compression disabled, encryption-at-rest as defense in depth, and antivirus disabled because it cannot inspect authenticated ciphertext. The encrypted client codec separately enforces permitted plaintext MIME and authenticates file/chunk metadata. The migration refuses any project except pinned Scratch, does not change the legacy `task_images` bucket, fails on any existing schema/permission drift, and requires a full authoritative GET after creation. **Not deployed:** current typed broker's bucket constructor cannot set/read back the full policy and using its truncated constructor would create an insecure/drifting resource. Wait for owner-installed Scratch Admin MCP. Uploads still require server registration/ownership and a ciphertext-only Function route before test.
