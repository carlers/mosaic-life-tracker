# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 isolated candidate Supabase RPC atomic compare-and-set write transport.

## Boundary
- Forked from verified isolated `refactor/967-verified-auth-transport-20261019@54fea0b4d91f05be5eed485996ab2c0d92617937`; Auth provider mock tests, focused #39179778943 and canonical #39179935812 succeeded, trusted #39180113890 READY.
- Protected dev `a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and Production main `b952f71ecd2add3172f90104bc0e856a2648ccc9` not changed. No source import into runtime, real users, Supabase schema change, SDK switch or version bump.
- `mosaic-dev` isolated Supabase remains ACTIVE_HEALTHY and two Security Advisor WARNs remain for intentionally callable SECURITY DEFINER CAS RPCs. Actual source functions inspected: explicit auth.uid owner, fixed search_path, field allowlist, expected revision. Independent signed HTTP security review still required.

## Work
- Add `supabase-poc/candidateCasTransport.ts`: POST only allowlisted CAS task/category RPC, signed-in owner from verified session, strict positive precision-safe revision, validated patch and resulting owner/id/new revision/tombstone; a NULL server response is conflict, no automatic retry or false acknowledgment.
- Additional regression tests `tests/unit/supabaseCandidateCasTransport.test.ts` for stale writes, foreign replies, >2^53 seq, patch injection, session switch and no hidden retry.
- Tighten source-only `candidateHttpTransport.ts` to compare token as well as epoch before and after a GET; add matching regression.
- Update `docs/SUPABASE_EVALUATION.md`. App behaviour/source version impact NONE. OCI #975 capacity watcher is separate stable branch; user's independent UI work on dev remains untouched.

## Next action
- Run task [verify:focused], squash into isolated stable Preview, then canonical Quality Gate and trusted delivery. If there are failures, repair without weakening security or verification.
- Later: genuine signed-in disposable Supabase Auth tests, REST CAS/owner RLS attacks, insert/idempotent replays, RxDB push+pull/conflict handling and queued changes, all eight domains/media/Functions, cost/DR, user identity continuity and reversible cutover. No provider/dev/main/Production promotion without distinct approval. Keep #967 open.
