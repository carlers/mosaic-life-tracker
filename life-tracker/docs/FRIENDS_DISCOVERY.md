# Friends discovery and sorting (#1656, #1657)

## Contract

- **Latest** is the default and uses trusted `accepted_at` for accepted friends, newest first. Legacy accepted rows lacking an acceptance timestamp appear after known acceptances and use request creation only as an approximation, never as a verified acceptance date.
- **Closest** is based only on owner-local delivered, nondeleted, non-unsent direct chat interactions in the recent 90-day window. Messages before the current verified friendship acceptance are not counted. Missing/incomplete local data falls back to Latest. No location-based ranking or closeness score is exposed.
- The setting `friendsSortMode` is owner-scoped and synced; sorting applies only to Explore's My friends list.
- A direct friend may be an intermediary for discovery only with reciprocal accepted A-B and B-C friendships and B's `allow_browse` consent and candidate C's `allow_appear` consent. Both are off by default and server-authoritative. Do not reveal hidden graph edges, totals, private data, other users' consents, or unapproved identities. Searchable profiles are not sufficient without graph consent.
- The server validates status, blocking, deletion, opt-outs, authentication and cursor binding on every discovery page. Browser state is transient; no local graph persistence or background prefetch. The `MOSAIC_SOCIAL_DISCOVERY_ENABLED` server flag defaults OFF until controlled privacy acceptance; it is currently enabled in **normal Appwrite Preview only** for owner testing, while per-user browse/appear consents remain opt-in (both default OFF).

## Source and rollout

- Original implementation: draft PR #1802 at `62c6e2b52607cc58754d204083a947d726b7cbbf`; original full CI passed but it was not released. The original `025-friends-discovery` migration collided with deployed `025-feedback-email-delivery`.
- The current integration is reconciled against `dev@8bd7c1bdff8f9237aabb0b9d2265e71afc2f6b4e` and retains **additive `030-friends-discovery`**, preserving `025-feedback-email-delivery`, `026-category-start-date`, `027-task-requests` and the other Preview/Production schemas. Do not reuse migration 030 or overwrite concurrently deployed migrations. Reverify the live `dev` SHA, schema and Feature Function before any future backend rollout.
- Normal feature target: Appwrite **Preview** `6ae94a2100014d01f5ed`, Oracle service `appwrite-preview`, Vercel project `prj_jysOLDbuO9c5rP8x6Q145DVIw0fc`. The isolated E2EE Scratch lab is not the target. Never use Production credentials, accounts, schema or deployment to unblock this feature.
- Before Preview acceptance: focused source CI, old-PWA compatibility and full canonical checks, reviewed additive Preview schema migration and readback, required private cursor signing secret, exact-source inactive Function deployment and reviewed activation, then three or more disposable account tests (A,B,C,D) including revoke/block/cursor/cross-account/offline negatives. Enable discovery only after the server privacy checks pass. No promotion to dev/main without separate owner authorization.
- The original implementation was not deployed to Appwrite; source changes or GitHub CI alone do not establish backend readiness. Retain the kill switch in the off position until the above gates are verified.

## Existing Oracle deployment route and current source

The already installed `mosaic_oracle_scratch_release` plugin tool is an
**Appwrite Preview** (`6ae94a2100014d01f5ed`) release operator despite
its old name. It has already been used for source-compatible deployment
and activation in [#2188](https://github.com/carlers/mosaic-life-tracker/pull/2188).
The source must be reconciled into the worker's exact pinned
`security/1662-e2ee-foundation-v01140-20261119` branch with successful
push Quality Gate before the operator accepts its SHA. The compatibility
source [#2214](https://github.com/carlers/mosaic-life-tracker/pull/2214)
and reconciled release [#2217](https://github.com/carlers/mosaic-life-tracker/pull/2217)
preserve the active E2EE/Diary message-action handlers; do **not** deploy
the dev-based frontend Function directory instead.

Operator sequence: verified branch/CI and old pointer → `preflight` →
`preflight_ready` → inactive `prepare` → `prepared` and HMAC receipt →
separately authorized `activate` → `active` plus independent Function
readback. All operations target normal Preview; no implicit dev/main
promotion. See [backend procedure](APPWRITE_BACKEND_WORKFLOW.md#connected-chat-preview-function-delivery--already-installed).

**Separate feature gate:** the installed worker does not configure
Function variables. `MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET` must be
a private server-side value of at least 32 characters and the
`MOSAIC_SOCIAL_DISCOVERY_ENABLED` flag must remain OFF until the
reviewed multi-account privacy scenarios pass. Neither successful
GitHub CI nor activated Function code establishes that this secret,
flag or registered Web origin is configured.

## Integration checkpoint — 2026-11-23

- Owner accepted the v0.120.2 Friends discovery Preview workflow and permission-revocation tests. Source-only `dev` integration reconciles this capability with existing task requests and newer application features, using the next available version **v0.141.0** because v0.140.0 is reserved by an independent Preview feature. See Issues #1656/#1657 and integration PR #2421 for live CI and deployment state.
- Preserve trusted Appwrite Preview `message-action` source and live privacy switches: integration of Git source does **not** authorize redeploying the older `dev` Function directory, altering Preview/Production user consents, or affecting the E2EE Scratch lab. Recheck the registered Preview origin, exact deployed Function pointer and source before any Backend deployment.
- `dev` acceptance requires the exact resolved stable Preview source tree, canonical CI, official READY deployment, and independently verified stable dev hostname; do not promote to `main` without separate approval.
