# Friends discovery and sorting (#1656, #1657)

## Contract

- **Latest** is the default and uses trusted `accepted_at` for accepted friends, newest first. Legacy accepted rows lacking an acceptance timestamp appear after known acceptances and use request creation only as an approximation, never as a verified acceptance date.
- **Closest** is based only on owner-local delivered, nondeleted, non-unsent direct chat interactions in the recent 90-day window. Messages before the current verified friendship acceptance are not counted. Missing/incomplete local data falls back to Latest. No location-based ranking or closeness score is exposed.
- The setting `friendsSortMode` is owner-scoped and synced; sorting applies only to Explore's My friends list.
- A direct friend may be an intermediary for discovery only with reciprocal accepted A-B and B-C friendships and B's `allow_browse` consent and candidate C's `allow_appear` consent. Both are off by default and server-authoritative. Do not reveal hidden graph edges, totals, private data, other users' consents, or unapproved identities. Searchable profiles are not sufficient without graph consent.
- The server validates status, blocking, deletion, opt-outs, authentication and cursor binding on every discovery page. Browser state is transient; no local graph persistence or background prefetch. The `MOSAIC_SOCIAL_DISCOVERY_ENABLED` server flag stays false until the privacy acceptance gates pass.

## Source and rollout

- Original implementation: draft PR #1802 at `62c6e2b52607cc58754d204083a947d726b7cbbf`; original full CI passed but it was not released. The original `025-friends-discovery` migration collided with deployed `025-feedback-email-delivery`.
- Current reconciliation is against `dev@6e406a5733a71e3f339fb6a4168e8f425f463d6f` and uses **additive `030-friends-discovery`**, preserving `025-feedback-email-delivery` and unrelated Preview/Production schemas. Migration 026 is reserved by category start-date task #1912; 027–029 are reserved by the isolated E2EE workstream. Keep friends discovery at 030 and recheck all concurrent migrations before activation.
- Normal feature target: Appwrite **Preview** `6ae94a2100014d01f5ed`, Oracle service `appwrite-preview`, Vercel project `prj_jysOLDbuO9c5rP8x6Q145DVIw0fc`. The isolated E2EE Scratch lab is not the target. Never use Production credentials, accounts, schema or deployment to unblock this feature.
- Before Preview acceptance: focused source CI, old-PWA compatibility and full canonical checks, reviewed additive Preview schema migration and readback, required private cursor signing secret, exact-source inactive Function deployment and reviewed activation, then three or more disposable account tests (A,B,C,D) including revoke/block/cursor/cross-account/offline negatives. Enable discovery only after the server privacy checks pass. No promotion to dev/main without separate owner authorization.
- The original implementation was not deployed to Appwrite; source changes or GitHub CI alone do not establish backend readiness. Retain the kill switch in the off position until the above gates are verified.
