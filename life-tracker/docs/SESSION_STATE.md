# Session checkpoint

Updated: 2026-10-09
Current issue: #434 — default-first architecture / client SDK safety boundaries
Branch: `chatgpt/default-first-boundaries`, from `dev` `d1b80db986d4b191bc7a8c857f3800cd63339146`
Target stable Preview: `refactor/default-first-boundaries`

## Objective and scope

- Finish an evidence-based audit of policy-vs-default gaps across client SDK, account async, backend configuration, CI and form actions (recorded in issue #434).
- First implementation batch is non-user-visible: remove unused remote `guardedTablesDB.upsertRow`/`deleteRow` from browser API, broaden direct Appwrite unsafe-service/namespace lint guards, protect with meaningful regression tests.
- Preserve local RxDB `upsert`, social outbox legacy action `kind: 'upsertRow'`, server Function hard deletes, and safe Appwrite Query/Role/Permission helpers.
- Do not refactor sync/account lifecycle, migrate schema, change production Appwrite, UI behavior, theme, gesture or product version. Impact NONE; keep v0.6.1 unchanged.

## Verification and next action

- #409 accepted v0.6.1 Preview `3e1af34a` promoted by PR #433 to dev `d1b80db9`; promotion CI `37897274044` SUCCESS and exact dev Vercel READY.
- Source audit: `sdk.ts` exports remote PUT and hard delete, despite documented restrictions, with no observed feature call sites. ESLint named-service restriction misses `Client`, `Databases`, `Users` and wildcard namespace imports. Existing `accountWorkScope`, backend manifest/readiness and dev provenance gates already provide strong defaults; defer speculative refactors.
- Implementation and tests prepared; no verification run yet.
- Next action: focused CI, fix failures if any, squash into stable Preview, require full canonical CI and exact-SHA Vercel READY, update #434; seek separate Preview → dev approval.

## Manual / backend boundaries

- No manual/device testing claimed; no Scratch/production Appwrite mutation, schema or Function deployment is required for this frontend-only API/lint change.
