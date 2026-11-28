# E2EE owner-private v2 contract candidate — source only

Tracking: #1662 / #2084. DO NOT deploy or enable. Synthetic Scratch-project-pinned client codec and UNWIRED prospective Function validator.

The isolated e2ee_owner_v1 Function requires plaintext routing.visibility, date and reminders; the dev privacy manifest encrypts them. Old v1 must stay unchanged and readable.

V2 restricts to eight personal owner collections; no chat, recipients, sharing or public fields. Client requires private visibility where applicable. The server validates only owner/project, envelope shape and minimized routing and cannot infer a hidden visibility value.

The v2 header schemaVersion and policy are additionally authenticated by the AES-GCM additional data (ownerPolicy, ownerPolicyVersion); v1 ciphertext cannot be reinterpreted as v2. Client and server mirrored allowlists are tested against current dev fieldManifest.

No live route, schema or Appwrite mutation. Before any release: dedicated v2 authenticated Function endpoint, per-user owner-only ACL, independent root/key epoch and CAS readback, v1-v2 dual-read migration, old writer fence, owner-state gate, browser/device tests and explicit approvals. Normal sync and Production unchanged.

## Distinct v2 Scratch-only table contract (unregistered)

The candidate `appwrite-functions/message-action/e2ee-owner-v2-schema.js` exports a frozen v2 schema requiring exact isolated project `6b00671500279e901846`, a **separate** `private_owner_ciphertexts_v2` table, empty table permissions and rowSecurity true. It stores opaque row ID, collection, owner/account key epoch, version, ciphertext envelope, minimized routing and server timestamps/sequence metadata; no raw title, date, reminder, visibility, workout stats, MIME, recipient or message fields. Indexed change feeds use only owner/collection/server updated timestamp. The candidate is **not registered** in `infrastructure/mosaic-backend.mjs` or the default migrator, not provisioned and not a valid backdoor into Production. A future reviewed additive migration and actual project-scoped readback must precede Function v2 write implementation, cross-version data migration, and replay/ACL acceptance.

## 2026-11-26 prospective V2 Function server writer — OFF and UNWIRED

The separate `e2ee-owner-v2-candidate.js` now stages one typed `put` operation **against only the distinct unprovisioned v2 table**, with exact isolated Scratch Function-project pin, a *new absent/default-off* `MOSAIC_E2EE_OWNER_V2_ENABLED` flag, an independently narrow owner allowlist, completed MFA session requirement supplied as an explicit **trusted, verified function capability**, with no default authorizer and a hard 401 if absent (the isolated pilot verifier does not exist on current-dev ancestry), fixed v2 policy validator and exact `opId`/revision/generation. It verifies the existing owner-root envelope, key ID, generation and owner before every candidate write; creation uses owner-only row read permission, no client write grants, and conflicting retry/update uses owner/domain/key/epoch/revision compare-and-swap. Tests use an explicit synthetic verifier substitution and mocked database only. There is **no import in active Function dispatch, no v2 environment variable configured, no v2 table, and no backend mutation.** The server cannot independently authenticate encrypted visibility or infer account-wide sealed/migration state from record ciphertext; a dedicated owner-only fenced state machine, root-rotation concurrency control, disclosure model and exact signed release are still mandatory before wiring this candidate. No production-grade secure sync, change feed, old-client export or historical data migration is claimed.

Current-dev does NOT contain the Scratch-only `e2ee-pilot.js` verifier. The candidate explicitly rejects absent/malformed `verifySession`. A future signed Scratch Function port must supply an independently reviewed, project-pinned real account MFA/session verifier (not a synthetic stub), while all current handler tests deliberately inject synthetic verification. No real Function is wired or enabled.

## 2026-11-26 prospective read-only V2 Function GET

The unwired default-OFF v2 Function candidate additionally stages a typed read-only `get` operation requiring exact Scratch project, synthetic allowlist, explicit complete MFA verifier, caller-owned opaque row ID, collection, expected key ID and exact root generation. The candidate first confirms the registered owner root/epoch, then reads only the separate unprovisioned v2 ciphertext table. It refuses foreign rows, malformed v1/published routing, wrong policy version/epoch, damaged ciphertext, mismatched deleted/revision metadata and unexpected selector fields. The server returns only the private v2 ciphertext envelope and minimized routing; local client AEAD decrypts independently. Synthetic handler tests exercise valid client roundtrip and negative owner/root/authorization/metadata cases. The active Function does **not** dispatch this operation and the backend v2 table remains unprovisioned; no server-verified readback or real account migration is claimed.


## Prospective ACL and retry guard hardening

The unwired candidate now requires exact owner-only read grants and expected row IDs on root and ciphertext readback, validates existing row envelopes, routing, tombstones and operation-ID shape before CAS or duplicate acceptance, and refuses operation-ID reuse for different content. GET and exact duplicate recheck the root epoch after reading. This does **not** prove atomic root-generation fencing of concurrent writes or a trustworthy remote receipt; an actual transaction or equivalent reviewed serialization is mandatory before enabling the candidate. Mock-only tests cover foreign grants, wrong IDs, malformed metadata, conflicting operation IDs and a root change during GET. No Function activation or schema changes.

## Prospective operation-ID-pinned GET (default OFF)

The source-only v2 `get` selector now requires the **exact locally persisted** `expectedOpId` and rejects a record with any different server `op_id` even if the encrypted body is otherwise valid. When readback succeeds, the candidate returns `opId` and `keyGeneration` alongside ciphertext and routing. This is a server metadata comparison to support a client-side complete-byte/readback rehearsal, **not** a signed acknowledgment, transactional root-epoch fence, or permission to delete a local pending intent. The target table and Function remain absent/inactive on Scratch; there is no normal client import, network call, backend release or user-data migration.

## Post-write root-epoch detection, not a root lock

The prospective isolated v2 PUT handler now rechecks owner root key/generation after a successful create or CAS update, refusing to return success if rotation completed during the request. Handler tests inject root rotation during each mocked database write. This detects some races **after they occur**, and does not undo committed writes or serialize competing requests. It is not a sufficient E2EE release gate: actual atomic owner-root transaction/locking semantics and adversarial proof on the installed Appwrite version are still required, especially given the unresolved upstream issue appwrite/appwrite#14489. This candidate remains default-OFF, unwired and unprovisioned.

## 2026-11-27 async input snapshot in owner v2 AEAD codec

The Scratch-only, unwired owner-private v2 seal/open operations now copy
owner/account scope, root bytes, authenticated context, document and record
immediately before asynchronous WebCrypto. Caller mutation of a root byte
array, owner ID, document or routing metadata during the key-derivation await
cannot change the signed-v2 record header independently from its AEAD key
and additional-data fields. New Vitest regressions mutate all those inputs
after invoking an unresolved seal or open and verify the originally intended
document survives. The underlying server root-generation CAS, actual
writer-floor, old-PWA cutover and real Function are still not attested.

## Explicit server-side row ID authentication boundary (2026-11-27)

The prospective server schema validator **cannot** detect that a validly
formatted opaque row ID was swapped while retaining a client's existing AEAD
envelope: it does not know the root or decrypt. The client `openV2PrivateOwnerDocument`
rejects that swapped ID under authenticated additional data. The existing unit
assertion was corrected to model this trust boundary instead of claiming the
server alone authenticates opaque row identity. Before enabling real sync,
the signed Function must additionally enforce owner/key generation and
operation-ID/revision CAS and preserve server-private ACLs; this does not
replace the need for local AEAD on every readback.

## 2026-11-28 prospective encrypted owner scan page (UNWIRED)

The additional handleProspectiveOwnerV2Scan candidate adds a strictly bounded (25-row maximum) read-only Scratch-only scan of v2 encrypted owner records, using exact project/owner/MFA/key generation guards and server-side owner+collection filters. Only opaque row IDs and reviewed routing metadata leave the Function; each row must pass owner-only ACL, ciphertext envelope, collection, tombstone, revision, operation ID and timestamp validation. A caller-supplied opaque cursor must first be independently authenticated against the same owner and key epoch, and returned row IDs must be ordered without duplicates. No unexpected plaintext columns are allowed.

Every response explicitly reports complete:false. Pagination by immutable row ID is a **non-atomic snapshot rehearsal**, not a stable incremental changefeed or a confirmed full migration. New rows inserted during a scan can be missed until a restart; therefore the client must never ACK an encrypted outbound intent or mark a migration complete from this scan alone. Future activation needs installed Appwrite cursor tests, a consistent-snapshot or restartable changefeed design, true server-serialized root generation and write fencing, actual authenticated Function integration, full RxDB push/pull, authorized key possession and hosted adversarial tests. The existing active Scratch Function does not import this candidate. No backend, Preview, dev, main or Production changes were made.
