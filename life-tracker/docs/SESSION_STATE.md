# Session checkpoint

Updated: 2026-09-29
Current task: Confirm mid-session unauthorized signals through `account.get()`.
Status: Implemented and focused tests pass.
Next action: remote review and canonical acceptance.
Blockers: none locally.

## Working set
- src/lib/authEvents.ts
- src/hooks/AuthProvider.tsx
- src/lib/sdk.ts
- tests/react/AuthProvider.test.tsx
- tests/unit/authEvents.test.ts
- tests/unit/sdk.test.ts
- docs/PROJECT_REFERENCE.md

## Completed substeps
- Recast unauthorized events as deduplicated session-verification requests.
- Made AuthProvider preserve cached auth until a generation-current `account.get()` confirms 401.
- Preserved Function business responses for operation-specific handling.
- Added success, confirmed-401, offline, concurrency, and stale-result regressions.
- Documented non-Account 401 confirmation semantics in §§23.4 and 23.6.

## Remaining substeps
- None locally.

## Constraints
- Only `account.get()` 401 may clear authenticated state.
- Network failures preserve cached identity and report offline connectivity.
- Resource operation errors/responses remain available to their callers and queues.

## Verification
- Focused auth event, SDK, and AuthProvider tests pass.
- Focused ESLint and diff checks pass.
