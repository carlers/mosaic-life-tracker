# Isolated E2EE owner-root epoch unique-claim candidate — NOT installed

Tracking [#2083](https://github.com/carlers/mosaic-life-tracker/issues/2083) and [#2087](https://github.com/carlers/mosaic-life-tracker/issues/2087).

**Status on 2026-11-27:** source-only, disabled, unregistered and NOT imported by an active Function. No Appwrite mutation. There is no installed atomic root-generation CAS, secure device approval, E2EE user launch or old-client plaintext writer floor.

## Why it exists

[Appwrite issue #14489](https://github.com/appwrite/appwrite/issues/14489) reports that Appwrite 2.5.0/PostgreSQL with multiple API nodes can let competing staged read/update claim transactions both report commit success due to time-based conflict checks missing concurrent changes before visibility. The reporter observed **zero two-winner cases in 180 rounds** when a unique deterministic-ID claim row was created *in the same transaction* as the competing update. This is an upstream-reporter experiment, not proof about the installed Mosaic backend. [Appwrite TablesDB transactions](https://appwrite.io/docs/products/databases/tablesdb/transactions) document staging a row CREATE with transactionId; generic documentation does not prove installed transaction isolation.

## Unwired source artifacts

- The server-side pure planner in appwrite-functions/message-action/e2ee-root-epoch-claim-candidate.js computes an Appwrite-safe 35-character claim ID from a SHA-256 hash over a domain-separated canonical tuple: exact Scratch project ID 6b00671500279e901846, owner ID and **expected previous generation**. The unique ID must not depend on the request operation ID, new key ID, nonce, wall clock or encrypted root envelope, so competing proposed changes for the same epoch cannot choose disjoint claims. This helper performs no writes, network calls or authorization.
- e2ee-root-epoch-claim-schema.js describes an **unregistered and disabled** table owner_root_epoch_claims_v2 with empty table permissions, row security, owner/previous generation index and server-computed SHA-256 hashes of the wrapped envelope before/after. No migrator or active Function imports it. The row IDs and metadata are not signing keys, relay approvals or proof of encryption.
- The handler unit suite tests deterministic same-owner/epoch claim collision despite different proposal key IDs/op IDs, different owner and epoch separation, exact Scratch project refusal of Preview/Production, malformed request rejection, key-length bound and disabled schema.

## Mandatory backend implementation and release checks

1. The future privileged worker must authenticate the actual account and completed MFA on the installed Oracle Appwrite server. It must independently read and authenticate the existing root envelope, key ID and generation; never trust user-provided claim IDs or hashes.
2. One *real, reviewed backend transaction* must atomically stage **CREATE of the unique owner-generation claim row AND UPDATE of the authenticated root envelope/generation**. Commit both or neither; conflicting attempts at a shared previous epoch must not both win. A client Web Lock, local Map test, create before/after transaction, unprotected Actions job, or post-write root read is not a substitute.
3. Ambiguous commit timeout, duplicate claim, interruption and retry require server-authoritative claim/root readback against exact operation ID, envelope digest and expected/next generation. Never mint a fresh claim ID to evade uniqueness. Do not delete claim rows without an independently reviewed durable retention and disaster-recovery policy.
4. Every old installed PWA, Function, Storage, MCP, batch import, direct TablesDB update, recovery restore and backup path must be fenced from bypassing the server-controlled owner key-generation and plaintext-write floor. Unique claims only protect participating writers.
5. Independently verify the exact installed Appwrite version, Postgres adapter, transaction API support, schema/ACL, node topology, source/host attestations and MFA. Run adversarial synthetic two-device and 2-API-node concurrent requests with delayed/padded 20–90-operation transactions, lost response, duplicate, stale/foreign owner, wrong key/generation, failed staging and rollback. Prove one winner and no orphan claim or root. Repeat the upstream reproduction and the proposed candidate in the actual isolated environment before any activation.
6. The private Oracle protected CI, additive schema approval, signed Function release, installed old-writer closure and owner security/UAT remain mandatory. No Preview/dev/main/Production promotion without separate specific authorization.

**No claim of backend correctness** follows from this pure candidate, schema proposal, synthetic unit tests or upstream report. This is source groundwork for an eventual secure implementation, not a functioning root transaction.
