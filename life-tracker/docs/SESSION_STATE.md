# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 — source-only authenticated Supabase REST pull transport contract.

## Source and boundaries

- Source base: accepted isolated stable Preview `refactor/supabase-atomic-cas-20261019@0e7e19e0ffa61acb1cd7754bdf51e6a20d8894d7`, derived from `dev@87b3a1d027b088e55d4b6dfccb6230b7df053f68`. No app version bump.
- Task branch `chatgpt/supabase-http-transport-20261019`, intended separate Preview `refactor/supabase-http-transport-20261019`. Issue #967 open; #968 optional future self-host/cloud sync.
- This change is strictly under `supabase-poc/`, `tests/unit/`, and documentation. It does not import Supabase into running app, deploy an SDK, access real accounts, modify Appwrite or Supabase schema, or promote to dev/main/Production.
- Isolated `mosaic-dev` remains the only Supabase project used in POC. Existing two callable SECURITY DEFINER RPC warnings remain unresolved; no new cloud DDL in this stage.

## Implementation and verification

- `supabase-poc/candidateHttpTransport.ts`: injected Fetch and explicitly verified session provider for HTTPS/localhost Supabase REST reads; owner, high-precision revision, limit and order filters; public publishable-key only; no browser credentials/cache; pre- and post-request session-epoch/owner checks; explicit authorization vs service failures.
- `tests/unit/supabaseCandidateHttpTransport.test.ts`: fake-session and mock-response tests for query/headers, account switching, denied access, 5xx service failure, malformed pages, untrusted endpoints/secret-key prefix, and composition with candidate checkpoint validator.
- `docs/SUPABASE_EVALUATION.md` records that the session provider must be implemented with real server-verified Supabase Auth; fake tests cannot prove signed JWTs or real HTTP. Version impact NONE.

## Next action

- Inspect diff and run coherent `[verify:focused]` task CI, then isolated stable Preview full canonical CI and trusted delivery. Repair failures without weakening gates.
- Future #967: real disposable signed-in Auth test users (current connector exposes project/database operations, not Auth create/sign-in); actual two-account PostgREST denied/allowed scenarios; CAS RPC HTTP/role audits, recoverable RxDB pull+push, Realtime, privacy for all eight domains and reversible cutover. User must separately approve Production/account migration.
- No dev/main/Production promotion or release 1.0 without explicit authorization.
