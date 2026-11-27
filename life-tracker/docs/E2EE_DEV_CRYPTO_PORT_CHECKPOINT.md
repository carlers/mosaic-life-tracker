# #1662 dev-based crypto portability checkpoint — 2026-11-25

**Source-only, default-OFF.** Parent live dev source SHA `fd6b715ea43b46dd741d257b42cefc34e504dd2e`. Selectively copied ten exact existing Git blobs from isolated E2EE stable baseline `56c60f4c4a489d989f5fbfeeb731f7fb107bc53f`: six reusable modules `domainRegistry`, `coreCrypto`, `accountRootLifecycle`, `rememberedRootIndexedDb`, `recipientIdentityGate`, `privateMediaCodec` and four existing unit tests (root lifecycle, remembered IndexedDB root, recipient identity trust and media codec). These modules depend only on one another and browser/WebCrypto interfaces; no Appwrite backend, Function, schema, normal RxDB hook or UI has been wired. They remain dormant and make **no full E2EE claim**. No key/credential/real-user data transported.

**Why selective:** isolated branch v0.114.11 vs newer dev was diverged 82 dev-only and 75 E2EE-only commits. Do not wholesale merge the old E2EE app. Other modules `fieldManifest`, `ownerRecordCodec`, `ownerEncryptedOutbox` and transports are intentionally omitted until current dev schema, account state, current message-action actions and all write sinks are reconciled. Source-only compilation and existing unit vectors can prove portability, not encrypted normal sync or browser Safari/Android behavior.

**Next:** compare current dev task/Diary/Bucket/shares/media fields and Functions with security manifests; stage typed encrypted owner bridge behind disabled runtime gate, then implement actual migration with independent row/media readbacks. Preserve normal Preview and Production; synthetic destructive testing belongs only to dedicated Appwrite Scratch `6b00671500279e901846` / Vercel `mosaic-e2ee-scratch`. A separate code-only PR on dev ancestry does not authorize dev/main or normal Preview backend activation.

**Acceptance:** focused TypeScript/unit CI PASS at exact task SHA, full canonical at stable source branch after review; no user manual test or deployed E2EE claim. Track #1662/#2083–#2087.

## 2026-11-25 current-dev field privacy manifest extension

Added the isolated field manifest after comparing actual `dev@fd6b715e...` TypeScript interfaces. Extended compile-time exhaustive typing to `ActivityDocument` and `ActivityTaskLinkDocument`, classified `CategoryDocument.startedOn` as encrypted, `FriendshipDocument.acceptedAt` as routing metadata, and newly present `MessageDocument.taskRequestId/taskRequestEvent` as encrypted. Existing owner data models remain unchanged; this classification is a preliminary privacy contract, **not** proof that these fields are protected by remote E2EE. Current server/notifications/export/import/MCP writer and metadata exceptions still need independent review before enabling any cutover. `satisfies Record<keyof T, PrivacyClass>` should make unclassified new domain properties fail TypeScript when this module is compiled. The source-only unit tests require no backend.

## Current-dev owner codec groundwork

Ported the versioned source-only record codec and its tamper/missing-field tests into dev ancestry. Extended private domain names/mapping for the current `ActivityDocument` and `ActivityTaskLinkDocument`, with workouts/linked task identifiers and localDate inside AEAD-encrypted payload, while owner ID/timestamps and tombstone metadata remain explicitly routing-only. This is **not activated** for current workouts or any normal RxDB sync, does not migrate real accounts, and exposes no new backend write path. Reconcile scope with app social/notifications/MCP, and review every intentionally disclosed field before cutover.

## 2026-11-26 private calendar metadata closure (source-only)

The previous preliminary manifest allowed task and Diary calendar dates/visibility and task reminder times as plaintext `routing` metadata. The dormant **dev-based** owner record codec now encrypts those fields, alongside already private category start/end dates and Activity dates, with explicit regression checks that serialized ciphertext records omit private days and reminder text. `userId` remains the authenticated server routing owner, and server-visible timing fields such as `updatedAt` remain disclosed for compatibility until the complete metadata threat model is approved. The codec also refuses decryption when the authenticated routing owner is absent or differs from the context. This changes no normal synchronization, notification scheduling, Function, database migration or production release. Client-side reminders and encrypted private calendars must be reconciled before real cutover; existing server queries by plaintext dates cannot silently be used afterward.

## 2026-11-26 current-dev workout and activity-link deterministic migration identity

The source-only root-keyed opaque row-ID mapping now explicitly includes current-dev `activity` and `activity-task-link` domains. HKDF+HMAC still binds project, owner, domain and original semantic ID; identical retry or second device must derive the same opaque destination ID, while a different account/root or related domain yields a different value. Unknown recipient/chat domains remain rejected. Focused tests cover these invariants. This is dormant correctness groundwork, **not** an authorized new real-account migration or normal Appwrite sync activation. Server migrations and per-user accepted-ciphertext floor remain separate prerequisites.

## 2026-11-26 source-identical local pending-action recovery port

Copied the six previously focused/full-verified isolated E2EE legacy queue recovery source/test blobs **exactly** from Scratch branch `24cc21693ad6735146e88d2ce9f88f1db9323a52`, including `legacyPendingRecovery`, `localPendingQueueSnapshot`, `localPendingRecoveryFile` and the three unit suites. They provide an opt-in read-only account-scoped collector for known `mosaic_social_outbox`, `mosaic_message_action_queue`, and `mosaic_friendship_commands_v1` localStorage formats and owner-root authenticated encrypted file bytes; no queue mutation, replay, upload or normal sync activation. Existing dev storage keys were checked against live `src/lib/{outbox,socialOutbox,messageActionQueue,friendshipCommands}.ts`. Source parity does not prove complete historical installed-PWA origin support, RxDB pending revisions, pending Blob file packaging, or safe reimport. Do not use the normal v6 backup as a complete offline recovery or remove legacy queue bytes. This source port does not make production E2EE ready.

## 2026-11-26 current-dev offline action durability port (source-only)

Copied nine **exact-blob** previously isolated Scratch reviewed social, message-action and friendship command queue implementations and matching three unit suites into current-dev ancestry: `outbox.ts`, lazy `outboxDelivery.ts`, narrow `encryptionCutover.ts`, `socialOutbox.ts`, `messageActionQueue.ts`, `friendshipCommands.ts`, and existing outbox/social/message unit tests. Code comparison against dev v0.151.0 confirmed current application helpers were unchanged outside these cutover-specific changes. The shared outbox refuses to evict already pending owner actions at 100 capacity, fails instead of reporting a phantom durable enqueue on write errors, keeps corrupt legacy arrays for explicit recovery, and only stops/restricts opted-in social and message consumers after the **exact signed** HTTP 409 denial or five transient retries. Generic outbox consumers retain their original non-E2EE permanent/5-attempt drop. Per-owner FIFO and Web Lock send code is imported only on a flush. Friendship command hold blocks same-owner new operations, never discards unsent intents on exact cutover denial. No normal Appwrite Function/backend changes, no historical PWA retroactive patch, no replay/restore and **no authorization to promote to dev/main/Production**. Full canonical E2EE integration and versioned privacy/backend policies remain blocked.

## 2026-11-26 owner-private-v2 protocol source candidate

See [isolated v2 contract](E2EE_DEV_OWNER_V2_PROTOCOL.md): no Function dispatch, backend, normal RxDB sync or Production activation. Client/Function allowed routing mirrored in tests.

2026-11-26: unregistered exact-Scratch-only owner-private-v2 table schema candidate and tests; no backend mutation or default migration wiring. See E2EE_DEV_OWNER_V2_PROTOCOL.md.

## 2026-11-27 dormant owner root lifecycle session-snapshot hardening

The M1 creation, recovery, remembered-unlock and recovery-key replacement
helpers now pin the caller's owner identity, root bytes, key ID and expected
generation before their first asynchronous transport/MFA/crypto step. Incoming
remote root-generation envelopes are copied immediately; mocked or faulty
transports cannot mutate class-owned commitment state by retaining a reference.
Recovery rechecks both MFA authorization and exact remote envelope/generation
before storing a root, and refuses changes that occur while decrypting the
emergency key. The code does NOT prove the backend's authenticated CAS,
retention of old recovery secrets or trusted root generation. The real
Appwrite Function and independent installed write fence are still blocked.

## 2026-11-27 dormant remembered-root first-write-wins safety

The isolated local remembered-root IndexedDB vault now refuses same-owner
root replacement at an unchanged generation, changed key IDs and rollback.
Repeat stage of the identical owner/root/key/generation reuses the original
nonextractable wrapping key and envelope rather than silently overwriting
ciphertext. An actual authenticated decrypt of the prior local wrapper
precedes any higher-generation write; a serialized transaction rechecks the
prior stored envelope and generation for two-tab races, and post-write readback
verifies the newly wrapped root. This remains **local data-loss protection**,
not an Appwrite root-generation compare-and-swap, anti-rollback proof against
malicious browser code or a trustworthy server root authority. None of these
helpers is imported by live normal account login/sync. No backend/Preview,
dev/main or Production changes.

## 2026-11-27 generic crypto primitive asynchronous input snapshot

The source-only WebCrypto record, Diary, opaque migrated row-ID, emergency
recovery root and device-wrap primitives now pin caller-owned owner scope,
context, record envelope and 32-byte root/secret input before their first
cryptographic await. This prevents an asynchronous mutation of the account,
row ID, routing AAD, nonce header or root byte buffer from mixing different
identities within a single encrypt/decrypt operation. Unit tests mutate
context, payload, ciphertext, root/recovery arrays and account ID immediately
after invoking an unsettled encryption operation and verify that the original
AEAD data can still be opened with its originally authenticated scope.
This is no server CAS, remote key custody or full side-channel audit, and
normal Mosaic synchronization remains untouched.

## 2026-11-27 callback-safe account identity guard (dormant source)

The M1 root lifecycle, full encrypted owner rescue and M2 local rehearsal now
hold their captured owner/project identity in immutable runtime objects before
passing it into injected MFA, remote transport or future local-source adapters.
A callback cannot silently mutate the pinned account identity and direct a
later action to another owner's store. The saved encrypted media staging scope
is also frozen, and the M2 readback rehearsal clears its temporary 32-byte
root copy on success and error. Adversarial unit regressions verify attempted
callback-side owner reassignment is rejected without changing the original
owner operation. Runtime freezing is a defense against accidental or hostile
reentrant callback mutation, **not** protection against compromised same-origin
JavaScript, server-authorized cross-account writes, or an absent Appwrite
atomic root-generation fence. No module was connected to live sync or deployed.

The identical callback boundary was reviewed in the nested current-origin
rescue bridge, local row/photo capture, and saved-file v2 staging/parity
helpers. Those direct entry points now also freeze the captured owner scope
before invoking a user-supplied MFA gate or beginning asynchronous local
source reads; row/photo collection pins the 32-byte key before such calls.
No cross-tab source snapshot, remote write fence or actual server authorization
is implied by this change.

## 2026-11-27 chunked private-media AEAD immutable invocation

Chunked encrypted photo seal/open was independently audited for the same
asynchronous owner-identity race. Both operations now pin a validated 32-byte
root copy and immutable owner before WebCrypto awaits, and photo open clones
the untrusted manifest before validating it. The temporary root buffer is
zeroized on both successful and failed calls. Tests mutate caller-owned root,
owner ID and encrypted media manifest while HKDF/decrypt waits, and prove the
original multi-chunk plaintext remains bound to its original account/AAD.
This changes no Storage bucket, uploaded data, active client sync or backend.

## 2026-11-27 detached offline recovery source rows and rescue key cleanup

Owner offline row collection now deep-copies each already validated local
RxDB row as soon as it is returned, before awaiting another collection's
read. A source adapter retaining a live mutable row reference cannot rewrite
an earlier collection's captured snapshot; the final full-source readback
still rejects edits which remain after capture. A regression mutates a prior
task record during the later category scan and verifies the authenticated
saved copy still contains the initial task, not the later mutation.

Local encrypted rescue verification now checks the byte length actually read
against the File's declared size, refusing deceptive File-shaped data. The
rescue unpack and original-photo extraction paths zero their temporary root
copies in finally blocks on both success and rejection. No backend write,
E2EE activation or claim of atomic global cross-tab source snapshots.

## 2026-11-27 keyset pagination for raw RxDB tombstone rescue

The dormant raw owner storage inventory now uses an advancing `id > lastId`
Mango selector rather than numeric `skip` offsets across 75-row sorted pages.
Concurrent insertion/deletion before the previous page boundary therefore
cannot shift offsets and silently skip an existing later row. Every returned
ID must be strictly advancing, owner-scoped, and valid for the requested
physical `_deleted` state; duplicate/nonprogress/overflow fails closed.
A synthetic 78-row test deletes an already-read early row between pages and
verifies later IDs still appear; the separate full-source audit remains
necessary to reject that concurrent deletion before rescue completes. This
is not an atomic RxDB cross-tab snapshot or a history/GC restoration feature.

## 2026-11-27 historical ciphertext v1-to-v2 invocation pinning

The dormant old-owner ciphertext migration generator and its readback
verifier now independently copy the 32-byte root and deep-clone all
account/source/intent/remote-record fields before the first asynchronous
v1 decryption. A changing caller owner, historical routing value, root or
v2 readback object cannot silently switch the target account, key epoch
or authenticated plan halfway through migration. Temporary root copies
are cleared in finally blocks. Adversarial unit tests mutate all those
inputs while a migration is unsettled. The planner still has no remote
writes, old PWA writer cutoff, independently attested Appwrite CAS or
user-data migration authorization.

## 2026-11-27 legacy offline-action rescue authentication boundary

The dormant historical localStorage pending-action AEAD codec, raw queue
collector and saved-file reader now snapshot their original caller owner and
32-byte root before asynchronous encryption, key derivation, file reading or
source rereads. Reentrant account switches or caller key-buffer modification
cannot change the identity/AAD of a previously started saved queue capsule.
Raw queue callback readers also receive an immutable captured owner identity.
The recovery-file reader rejects a File-shaped object whose declared size
disagrees with the exact UTF-8 bytes returned. Transient copied roots and
plaintext byte buffers are cleared in finally blocks. Synthetic tests
mutate both the original owner and key during encrypted queue export and
readback. No old-client direct writes are altered or remotely fenced.

## 2026-11-27 owner-private v2 transient root cleanup

The dormant v2 owner-private record seal/open codec now clears its own
temporary root-key copy in finally, on success and failed validation/AEAD,
without modifying the caller's original key. Snapshot validation happens
before allocating the copy. The raw-v2 migration planner likewise clears
its scratch root copy after opaque-ID derivation, AEAD self-readback or
rejection. This is best-effort JavaScript heap hygiene, not proof of
memory erasure inside WebCrypto or an E2EE product launch.

## 2026-11-27 encrypted-photo IndexedDB failure cleanup

The dormant saved-photo queue read now closes its existing IndexedDB
connection even when owner HMAC/HKDF key import fails before the read
transaction can start. A regression injects a synthetic importKey failure
after a successful fake IndexedDB open and requires exactly one close.
Both saved-photo staging and readback clear their temporary 32-byte root
copies in finally, including file/authentication failure paths. The
original downloaded rescue File and all local pending ciphertext remain
untouched; no remote Storage upload or migration acknowledgment occurs.

## 2026-11-27 local keyring and recipient trust transient-resource cleanup

The dormant remembered-root vault now closes an opened IndexedDB handle in
finally after read/forget, even when transaction creation throws before any
request event can be installed. A fake-IDB regression rejects transaction
creation and confirms the connection closes exactly once per attempt.

The dormant manual recipient-pin read/stage code now freezes its two-field
owner scope and clears temporary owner-root byte arrays on all async success
and rejection paths. No recipient key directory, independent verification
channel, signed rotation protocol, live messaging or backend write was added.
