# Dormant current-origin raw owner to v2 encrypted plan

Tracking: app #1662 / #2084. SOURCE ONLY; no server, IndexedDB or local-queue writes. This is not a usable old-client migration feature.

The prospective prepareScratchRawOwnerToV2 function accepts an already authenticated current-origin RxDB raw row (including internal _rev, _meta.lwt, _attachments and _deleted) plus the exact isolated Scratch project/owner, local unlocked 32-byte root, registered key ID and an externally verified expected root generation. It rejects malformed, unclassified, non-JSON and cross-owner values. The only four RxDB internal fields are excluded from the v2 server envelope, but preserved separately by the existing encrypted local rescue bundle.

For exactly the eight private owner v2 collections, the helper derives the root-HMAC opaque stable destination ID, wraps all classified private values in AES-GCM ciphertext under the v2 policy, returns a new random revision and operation ID, then decrypts to check semantic equality. A physical RxDB _deleted:true row overrides a possibly stale app isDeleted:false flag and becomes an encrypted v2 tombstone. This protects against reappearance of a locally deleted row when a future migration occurs. Public/social records and v1 records are not silently reinterpreted as owner-v2 data.

The returned plan is ephemeral. Before any future network PUT, a caller MUST atomically stage the exact plan in the HMAC-protected IndexedDB migration intent store and use that unchanged intent for retries. Re-running the helper deliberately creates different revisions and operation IDs; it is not a durable retry API. No server root epoch, CAS, first-write receipt, migration account state, current RxDB replication checkpoint or old historical PWA completeness has been verified. Existing physical tombstones already purged by RxDB cleanup are unrecoverable by this scan alone.

Actual v2 table provisioning, Function dispatch/MFA, atomic account root-generation/write fence, live owner-only ACL, dual read, signed release and full integrated multi-device UAT remain separate required gates. Normal Preview/dev/main/Production untouched.
