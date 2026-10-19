# Permanent dogfood Preview (#1004)

## Purpose and branch
`feature/dogfood` is a **permanent experimental integration Preview** for routine manual user testing from an installed PWA. The `feature/` prefix is intentional: the trusted default-`main` Preview receiver and canonical Quality Gate already vet that branch class. It is a reserved exception to ordinary temporary `feature/*` branches; do not rename it to bare `dogfood` without reviewed CI/trust-path changes.

The current normal user-test flow is task branch → focused CI → temporary stable feature/fix Preview → full canonical acceptance → merge the independently verified candidate into `feature/dogfood` for convenient installed-PWA testing. An initial integration should contain only one unapproved experiment. Normal stable Previews remain mandatory for isolated testing, backend-risk and final acceptance.

## Testing, decisions and promotion
1. Preserve a **single, registered, stable Preview origin** on Scratch. The installed PWA can retain same-origin browser storage, local RxDB data and an otherwise valid account session when its static assets update. A changed origin, cleared browser data, expired/revoked session, or incompatible local schema can break this continuity. The existing explicit `Update now` service-worker flow is authoritative; do not auto-activate a waiting worker.
2. Test a feature on dogfood using a disposable Scratch user. Verify CI SHA, Vercel READY status and actual Appwrite project/endpoint and permitted Web origin, then test manual UI interactions and offline reopening. `dev` is for separately approved production-bound features, not experiments.
3. **Approve**: promote from the original accepted temporary Preview, **not** `feature/dogfood`, through the existing exact-tree preflight, user approval and `dev` CI. After approval, remove redundant dogfood-only integration if appropriate via a normal reviewed update.
4. **Reject**: use a reviewed Git revert of the specific experiment on dogfood, retain unrelated experiments, run full CI and verify the installed PWA updates to the corrected build. Never force-reset a long-lived branch or erase user data as an automatic rollback. A revert does not undo shared backend migrations or automatically convert cached local data.
5. New independent experiments should start only after the prior one is resolved during initial rollout. More parallel experiments require separately tested integration and rollback rules.

## CI-first and backend safety
- `life-tracker/vercel.json` deliberately disables Git-triggered stable feature Previews. The main-owned trusted prebuilt receiver admits only reviewed pinned Quality Gate artifacts, exact accepted branch SHA and Scratch build profile. Do **not** set `feature/dogfood` to `true` in `git.deploymentEnabled`, or bypass the trusted writer to manufacture a stable URL.
- The existing main-owned trusted prebuilt writer deliberately does **not** reassign stable aliases. Therefore the permanent installable origin and automatic alias advance are a **separate unverified delivery requirement**. Do not claim that the branch is installable just because a verified per-SHA Preview URL is READY. Any change to the protected-main receiver or alias controller requires separately approved scope, exact source/target/last-good checks and Vercel alias readback.
- A stable alias must be registered on the **Scratch** Appwrite project's Web platform before claiming authenticated PWA acceptance. Never register an unverified guessed host or switch to Production. Do not copy real Production accounts or records.
- Scratch schema and Function activations remain shared by dev and other Previews: observe issue #526's single-writer, additive-migration and old-client compatibility contract. Auth and database tests that might affect other consumers belong in an isolated disposable scenario.
- Backend outages, limits and remote authentication expiry are **not** solved by a persistent PWA. Cached data should remain usable only according to Mosaic's existing offline-account and ownership checks.
- The Vercel project may impose deployment protection. Verify that an installed PWA can fetch updates and auth APIs on its exact hostname before completing device acceptance.

## Acceptance and handoff
Keep issue #1004 open until a stable dogfood URL survives two independent accepted SHA updates, laptop/mobile installation and login, offline local read/edit/reconnect, rejected-feature rollback, Scratch-only isolation and no change to `dev`/`main`. Record actual CI/deployment IDs, accepted/refused experiment source SHAs, branch alias readbacks and unresolved device checks in the issue. Never equate source-only tests with browser, Appwrite or provider acceptance.
