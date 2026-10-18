# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 — isolated Supabase atomic CAS security hardening and checkpointed pull contract.

## Source and approval boundary

- Base accepted Preview `refactor/supabase-candidate-mapping-20261018@5246cd61d8a0f2eb8f8f7954dad6c822c6eca725`, derived from `dev@87b3a1d027b088e55d4b6dfccb6230b7df053f68`. Source-only candidate, no version bump; v0.29.12.
- Task branch `chatgpt/supabase-atomic-cas-20261019`; intended new stable Preview `refactor/supabase-atomic-cas-20261019`. Active issue #967 stays open; optional self-host/home-cloud dual sync is separate post-1.0 #968.
- Owner authorized development of isolated Supabase migration, **not** real user/data transfer, application provider switch, Production modifications, or promotion to dev/main. Supabase `mosaic-dev` project `hcxtiifzxoaflhjgoglb` remains development-only; Appwrite untouched.

## Findings and verified scope

- Identified candidate security flaw: ordinary authenticated UPDATE allowed bypassing compare-and-set. Applied Supabase dev-only migration revoking direct UPDATE and introducing narrow per-owner atomic CAS RPC functions for tasks/categories with fixed search path and explicit authorized patch fields.
- The first RPC test caught an unavailable SQL helper `jsonb_object_length`; corrected to JSONB object equality. The committed introspected final SQL is in `supabase-poc/migrations/20261019_candidate_atomic_cas_rpc.sql`.
- Replayed synthetic rollback-only SQL `supabase-poc/tests/candidate_atomic_cas_rollback.sql`: valid CAS, no direct UPDATE, stale and cross-owner RPC rejection, invalid/empty patch, anonymous EXECUTE denied, tombstones all PASS. Parallel two-request synthetic category test showed exactly one successful CAS at a shared revision; the other returned null. Removed seeded data and counter; probe tables remain empty.
- Supabase Security Advisor reports **two warnings** for explicitly callable `SECURITY DEFINER` CAS RPCs. This is intentional in the candidate but remains an independent security review gate; do not label warnings clean.
- Pure `supabase-poc/candidatePull.ts` and unit tests check owner isolation, monotonic high-precision checkpoint pages, tombstones and fail-closed on invalid/unavailable responses. Not wired to actual RxDB or HTTP/Auth; no new dependencies.

## Next action

- Run focused source and mapping/unit verification on coherent `[verify:focused]` commit; repair failures. Squash accepted task into an isolated stable Preview, then require full canonical CI and trusted READY delivery.
- Continue #967 with disposable **real signed Auth** HTTP checks when account tooling is available, a real RxDB integration adapter, two-device offline/reconnect/CAS replay, friend/message/diary visibility ACLs, rate/size/egress forecasting and an independently recoverable cutover plan. Never claim this proof achieves those steps.
- Keep #967 open; do not promote, import personal data, modify Appwrite Production or release Mosaic 1.0 without separately approved gates.
