# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 — server-verified Supabase Auth token boundary for isolated REST candidate.

## Boundaries
- Base isolated accepted `refactor/supabase-http-transport-20261019@f88c4d4fdc72a36db8286e6a9271b1e953bb2a77` (PR #974; focused, canonical and trusted delivery passed). Source-only, no app version impact.
- Project `mosaic-dev` still ACTIVE_HEALTHY; connector Security Advisor shows two outstanding WARNs for authenticated-executable SECURITY DEFINER CAS RPCs, no real Auth users or schema changes made.
- Protected dev `a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and Production main `b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged by this experiment. OCI #975 capacity watch develops separately.

## Scoped change
- Task `chatgpt/967-verified-auth-transport-20261019`: add `supabase-poc/candidateVerifiedAuth.ts` implementing the pending `CandidateSessionProvider`. It calls Supabase Auth GET /auth/v1/user with a supplied in-memory access token; relies on server-returned signed-in UUID, never local JWT decoding. Validates HTTPS/publishable key, denies insecure/secret URLs, enforces pre/post account epoch and token equality; fail-closed offline/errors/expired session.
- Unit tests `tests/unit/supabaseCandidateVerifiedAuth.test.ts` use mocked Auth/REST requests, wrong-account switches and token rotation; no actual signed HTTP executed, no keys copied to repo. Docs `SUPABASE_EVALUATION.md` clarifies the gate.

## Next action
- Coherent task [verify:focused] CI; then squash to isolated stable Preview and await full canonical gate/trusted READY. If CI fails, fix scope without weakening checks. Update issue #967 resume checkpoint.
- Later: real disposable Auth accounts and signed JWT HTTP RLS tests, CAS RPC independent security review, actual offline RxDB pull+push and all-domain privacy, storage/functions/DR and reversible provider migration. Keep Supabase and Oracle POCs isolated from user's independent UI changes on dev.
