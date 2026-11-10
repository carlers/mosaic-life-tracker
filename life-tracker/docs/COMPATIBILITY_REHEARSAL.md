# Live compatibility rehearsal — #914 Phase B

Status: **frontend-only old/new installed-PWA rehearsal owner-PASS; backend schema/Function expansion and full Phase B NOT YET PASSED**. This is
a deliberately isolated high-risk acceptance gate for independent-user 1.0,
not a routine frontend-only CI step or permission to modify Production.

## Invariants and scope

- Stable tested Production client: published
  `v0.29.1@b952f71ecd2add3172f90104bc0e856a2648ccc9`.
  Do not reinterpret the retired v0.17.4 client as compatible.
- Current published Production v0.50.3 is
  `main@8cdfdf8573ded70b37db1c4b7a49e1d86d5ace89`; its
  immutable source is separately pinned in
  `config/backend-client-compatibility.json`. The two pinned historical
  source compatibility checks pass against the additive dev backend, but
  **neither** proves live old-PWA writes/Function authorization. The old
  v0.29.1 result below remains frontend-only.
- Production `tasks` and `categories` allow table-level
  `create("users")`, unlike Scratch's empty create grants.
  Published v0.50.3 performs direct client `createRow` for both.
  **Do not copy Scratch ACLs to Production**, or enable category-destructive
  operations with direct old-client creates still unaccounted for.
  Require a reviewed coexistence/retirement and real old-writer outcome.
  `CATEGORY_DESTRUCTIVE_ENABLED` is optional/non-secret in the Function
  contract and absent/false must remain fail-closed until approved.
- Future candidate: an **explicitly approved** additive schema/Function
  change built from an exact reviewed candidate SHA; no speculative
  destructive rename, field deletion, permission widening or forced update.
- Backend: isolated local Appwrite of matching API semantics if achievable;
  otherwise book exclusive **Scratch**
  `6a96e82d000d1310b3be` at
  `https://fra.cloud.appwrite.io/v1` under
  [#526](https://github.com/carlers/mosaic-life-tracker/issues/526).
  Confirm current active Function ID, all open Preview requirements and
  Scratch parity before any change. Never clear or reset a populated
  shared Scratch project just to set up this test, and never copy
  Production users, data, secrets or media.
- Use two independent synthetic accounts and reversible rows only.
  Run old/new browsers in separate profiles/storage partitions. Record
  exact SHA, backend project, source and Function deployment IDs,
  schema revision, origin, browser, PWA install/waiting-controller state.
  Do not publish session tokens, raw data or personal records.

## Preflight — no cloud mutations

1. Verify current `config/backend-client-compatibility.json` and run
   `node scripts/check-backend-consumer-compat.mjs --all` from
   `life-tracker/`; capture failures, not just a PASS label.
2. Read the immutable shipped
   `src/db/replicationIds.ts`, `src/db/schema.ts`,
   `src/lib/syncMapping.ts` and the candidate schema/Function.
   Enumerate only tables **actually subscribed** by the old client;
   mark all unobserved new domains UNASSESSED.
3. Record the exact existing production/Scratch schema, indexes,
   row permissions, bucket file ACL model, and active READY
   `message-action` ID. Preserve old READY Function as code-rollback
   candidate; never infer that schema rollback is safe.
4. Verify the proposed test origin is registered on the chosen
   disposable backend, not Production. Snapshot disposable test state
   or use a completely isolated local backend before any migration.

## Disposable live test sequence

1. **Baseline on old code.** With the v0.29.1 pinned code, sign into
   synthetic owner A and friend B. Create a temporary task, Diary
   entry and chat message, Sync Now and verify both authorized reads.
   Record row IDs and a server-only marker to test preservation.
2. **Controlled delay.** Load the installed old PWA, verify the active
   service-worker controller/client build SHA, deliberately hold an
   old open tab and waiting update. Go offline in that tab; queue edits
   to task/Diary and one tombstone, without signing out or clearing RxDB.
3. **Expand on disposable backend.** Apply only the reviewed additive
   candidate change, verify new optional columns and new Function
   deployment READY, then (if required) activate the approved
   disposable Function. Recheck existing old permissions and
   subscriptions. An absent legacy subscription is UNASSESSED,
   not an automatic compatibility PASS.
4. **Old-client reconnect first.** Restore connectivity **without**
   activating the waiting service worker. Perform Sync Now. Read
   actual remote rows by authenticated API: the queued edits/tombstone
   converge; the new server-only field is unchanged, and no
   unknown field is echoed or overwritten. Verify no duplicates,
   timestamp regressions or unbounded retry loop.
5. **Cross-account denial.** Try a private Diary/photo and message
   reference from synthetic stranger B or a revoked friend. Revoke
   access during a queued sync; the old and new readers/writers must
   fail closed without cross-account cached content exposure.
6. **Upgrade in place.** Allow the waiting SW to activate only through
   the normal app update flow. Verify the source/build truly changes,
   old local queued rows remain durable, and both browser profiles
   converge after restart/reload/offline re-entry. Repeat with
   an interrupted Function/network response and user-triggered retry.
7. **Recovery.** Check rollback feasibility with old READY Function
   in the isolated backend where schema remains compatible. Do not
   drop columns or erase unsynced local records as a shortcut.

## Frontend-only partial live acceptance — 2026-10-16

The owner exercised a deliberately isolated **same-origin** v0.29.1→v0.29.3
Preview switch on the Scratch project without changing schema or Function code:

- The dedicated test alias first served old app source
  `eec2d3bfabb945ee91790a06213827b5028aac1a`, based on published
  v0.29.1 app code; the new deployment is
  `fix/745-send-denial-20261016@62a5d63470e46b5f44941953bfaf211aa724ccd0`.
  Vercel alias readback and an HTTP response with the embedded exact new SHA
  independently verified the same-host switch. Both JS bundles were
  inspected as Scratch-targeting, not Production.
- With the **old installed PWA still open**, the owner reported an offline
  queued task edit, private Diary edit and task deletion, then successful
  reconnect and Sync Now **before accepting the update**. A separate
  v0.29.3 browser/profile on Scratch showed the converged changes. The old
  PWA still displayed v0.29.1, with the update pending.
- The owner then reported normal Update now, v0.29.3 after reload, retained
  task/Diary/deletion state and another green Sync Now without duplicates:
  [#914 checkpoint](https://github.com/carlers/mosaic-life-tracker/issues/914#issuecomment-6226143261).

**Classification:** owner-reported browser/device acceptance, not captured
independent controller/network logs or server row-level verification. This is
a **frontend-only upgrade**. It is not evidence for changed-schema old writes,
new server-only field preservation, Function code activation/rollback, or
private/revoked cross-account negative authorization. Those high-risk Phase B
cases still require a separately reviewed *actual* additive backend candidate
and isolated disposable data. Do not mutate Scratch merely to manufacture
such a candidate or report the overall Phase B gate passed.

## Evidence / go-no-go record

| Gate | Required observable outcome | Status |
| --- | --- | --- |
| Source-only preflight | Supported exact SHAs and subscribed tables checked | NOT RUN |
| Live old read/partial update | New server field and owner unchanged | UNASSESSED — no schema change |
| Offline queued writes | Task/Diary/tombstone converge exactly once | OWNER PASS — frontend-only, cross-session check |
| Waiting service worker | Old JS genuinely reconnects before activation | OWNER PASS — version observed; controller logs not captured |
| Privacy | Old/new clients deny private/revoked cross-account reads | NOT RUN |
| Installed PWA upgrade | No data loss across normal update and restart | OWNER PASS — normal v0.29.1→v0.29.3 |
| Rollback | Safe Function-only fallback boundary documented/tested | UNASSESSED — no Function change |

Label each row PASS / FAIL / BLOCKED with exact CI/run links and
redacted diagnostics. Mock tests alone cannot graduate these rows.
On any data loss/privacy defect stop and preserve the disposable state
for diagnosis. If the shared Scratch deployment or registered origin
makes isolation impossible, leave the live gate BLOCKED; no Production
fallback. For normal application acceptance, owner's current
laptop/phone v0.29.1 installations work as reported, but that is
**not** the above old/new delayed-update exercise.

Do not publish 1.0.0 without separate explicit owner discussion and
approval; no approval here extends to protected `dev` or `main`
promotion. See [backend workflow](APPWRITE_BACKEND_WORKFLOW.md),
[Scratch Preview workflow](SCRATCH_PREVIEW_WORKFLOW.md) and
[issue #914](https://github.com/carlers/mosaic-life-tracker/issues/914).

## Category start-date activation dependency (#1912)

The category start-date Function checks are not sufficient while legacy clients can still use direct Appwrite create/update fallbacks. Older installed PWAs neither understand `started_on` nor submit the owner-local Backlogs date, and direct writes bypass the new Function checks. This is a hard activation blocker, not a warning.

Before exposing or enabling category start dates, complete the separately approved owner-write ACL cutover and rehearse old-client/offline queue recovery across two devices. Do not silently remove direct-write fallbacks or change table permissions under #1912. The category UI and schema must remain out of Preview until this dependency is verified.
