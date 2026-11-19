# E2EE account root stage — source-only proof, 2026-11-20

This tranche builds the M1 account-root enrollment/recovery/rotation **interface**
on the accepted v0.114.0 security Preview lineage. It does not activate
encryption for normal Mosaic data. The generic lifecycle depends on an injected
fully-authenticated Appwrite/MFA gate and backend atomic create, read and
compare-and-swap replace; it never assumes these exist solely because a
TypeScript transport interface compiles.

Acceptance tests cover two-device initialization races, lost server readback,
local persistence failures, distinct account context, recovery without prior
IndexedDB, stale generation, collision, authenticated-session rejection, and
recovery-key replacement CAS. The user must save and locally verify a newly
generated 256-bit recovery secret before the root can become active. The
initial root is not silently replaced after a conflicting enrollment.

**Non-goals and explicit caveats:** No root key material is sent to Appwrite.
Only an encrypted root envelope and nonsecret metadata reach the server.
A nonextractable browser key is still usable by same-origin JavaScript.
A key wrapping change is not compromised-root/content-key rotation.
A server which can rewrite every record and all independent checkpoints
may evade rollback detection on a newly restored device. The emergency-key
display is in app JavaScript memory until the user completes onboarding;
no UI implementation may log or persist it in a query string.

Owner approval for Stage 1 does not authorize Preview→dev or Production.
Do not wire this module into normal Appwrite replication until verified live
Scratch root transport, full ciphertext-only server writer permissions,
resumable data migration and safety tests exist.

**Synthetic Function source continuation:** Only exact Scratch and MFA/owner allowlisted `e2ee_diary_pilot` handler adds `rotate_recovery`: server CAS on owner-row, generation and key ID; idempotent lost replies, stale and cross-owner rejection. The existing recovery wrapper table's `generation` field is used. `read_root` now returns a monotonically increasing generation (the old pilot page ignores the extra field). No live deployment or Production access occurred. This pilot's v1 root-domain wrapper is **not** interchangeable with the new generic v1 private-payload root-domain wrapper; do not wire them to the same account until a reviewed namespace/version migration exists.
