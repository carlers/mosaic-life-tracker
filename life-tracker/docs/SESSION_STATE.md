# Session checkpoint

Updated: 2026-10-09
Current task: #434 — form-action lifecycle safeguards
Branch: `chatgpt/default-first-form-actions`, from promoted `dev` `39b7db1fbac25c5f5858e35441940a78923564f0`
Target stable Preview: `fix/default-first-form-actions`

## Objective and scope

- Prevent double-dispatched profile and category writes even when two clicks fire before React re-renders.
- On storage/write rejection, show existing semantic SheetErrorBanner feedback, release pending state, retain unsaved fields/confirmation, and allow retry. Retain appearance, interactions, account/sync architecture and current app backend.
- Reuse one tiny `useSheetSaveAction` state/ref guard in profile name, description and category manager rather than a universal cancellation/action framework. Reset its generation on reopening to ignore old completions.
- Category persistence previously swallowed insert/update errors; only CategoryManagerSheet calls these mutation functions, so rethrow failures to permit the sheet's existing retry experience. Reorder queues remain out of scope.
- User-visible failure/retry behavior: **PATCH** Preview candidate `v0.6.2` (from dev v0.6.1), stamped consistently in package.json, lockfile and appVersion.ts before acceptance.

## Completed evidence

- Prior #434 Preview promotion: PR #439 merged, dev SHA `39b7db1f`; promotion-check and canonical-acceptance SUCCESS, exact-SHA Vercel READY.
- Test-first branch commit `16f9091c5ff7b9ffcd2aa28a5be8d1a4844ae040`: focused [run 37906490489](https://github.com/carlers/mosaic-life-tracker/actions/runs/37906490489) **RED** with two independently reproduced duplicate profile save calls when clicking twice in a single React batch.
- Added tests cover name and description reject/error/preserve/retry/single-flight; stale completion after reopen; category create/update/delete reject/retry and rapid create; category data-layer propagation of insertion, deletion and unauthenticated failures.
- Initial implementation focused [run 37907036060](https://github.com/carlers/mosaic-life-tracker/actions/runs/37907036060) passed **1,270/1,271 tests**; the sole failure was a **test-fixture issue** (initially-open name form had no draft, making Save correctly disabled). Corrected the fixture to type a draft before firing Save, with no product-code change.
- Scope does not include profile username/password/email update flows (already have richer local handling), category reorder recovery, broader sync or Appwrite backend operations.

## Verification and delivery

Next action: run focused CI on the coherent task SHA; investigate and repair any failures; squash task into stable Preview, require full exact-SHA canonical acceptance and Vercel READY, update issue #434 and hand off the Preview. Do not promote to dev/main without separate explicit authorization. No manual/device or live cloud acceptance is claimed for this frontend-only work.

## Preview size-gate repair

- Original focused implementation [37907330478](https://github.com/carlers/mosaic-life-tracker/actions/runs/37907330478) passed.
- Stable Preview PR #440 squash SHA `d9df80ea05ee194d238de84eac1e0d74e72a3d5b`; canonical CI [37907466164](https://github.com/carlers/mosaic-life-tracker/actions/runs/37907466164) passed checks, both DOM and browser shards and dependency audit, but its build failed **only** the aggregate raw/gzip/precache size limits; Vercel deployment `dpl_E7JN9QyxLMyy5tYp33tMhdD4QXS2` was ERROR for the same reason.
- Cross-checked Vercel v0.6.1 5f1d4c8e vs v0.6.2 d9df80ea size metrics: +1,721 B raw, +847 B gzip, +2,041 B unique PWA precache; independent GitHub build confirms near-identical deltas. Entry/initial/Home all pass. No extra dependency was added.
- Repair branch: `chatgpt/default-first-form-actions-size-repair` from rejected stable `d9df80ea`; document one narrowly reviewed product-size exception in PROJECT_REFERENCE §24.14, adjust only the aggregate three limits (raw 2,296,600; gzip 706,900; precache 2,379,100) leaving about 1 KB provider headroom; preserve baseline, entry/startup/Home ceilings and enforcement. Update pinned size-budget unit expectations.
- **Next action:** task focused CI, squash repair into stable `fix/default-first-form-actions` Preview, require canonical full checks plus exact-SHA Vercel READY, then append delivery to #434. No `dev`/main form-phase promotion until separate user authorization; no manual/device/login or cloud-write acceptance claimed.
