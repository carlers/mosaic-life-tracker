# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 signed local Supabase CAS adversarial authorization denial matrix.

## Accepted source and approvals
- Latest accepted isolated stable Preview: `refactor/967-conflict-review-refresh-20261019@a76fd9da8a36a8565964d873a6428935c4bc0787`, from PR #1005. Exact SHA full canonical #39214533727 SUCCESS; real signed local Supabase JWT/PostgREST/Chromium RxDB lab #39214533726 SUCCESS, 1 passed with cleanup; trusted CI-first Preview #39214730975 SUCCESS with prebuilt READY for the accepted SHA. Latest issue #967 acceptance comment #6262124584; issue remains OPEN.
- Task `chatgpt/967-signed-rpc-denial-matrix-20261019` branches from accepted SHA. Version impact NONE. No Mosaic app runtime imports or provider activation; no Appwrite, hosted Supabase schema/Auth/users, dev/main, Production, or release modifications.
- Two hosted `authenticated_security_definer_function_executable` security-advisor WARNs are still open, not suppressed. RPCs are deliberately authenticated-callable SECURITY DEFINER; direct table UPDATE/DELETE privilege is revoked and authorization must be proven by Auth principal + row ownership + revision.

## Task scope
- Extend the existing real disposable local Supabase signed-browser lab with an **adversarial second test**: two independent real JWT users, owner category and task rows, cross-user guessed-row CAS update attempts with correct revision, anonymous CAS, forbidden owner/id patch injection, non-object/empty patches, stale replay after authorized CAS, direct PATCH/DELETE denial even for the owner, cross-owner SELECT and forged INSERT owner rejection. Assert both owner rows remain intact. Do not weaken RLS or grant privileged shortcuts.
- Add isolated task/stable branch family to dedicated signed lab CI. Document empirical coverage and advisor warning limitations in `SUPABASE_EVALUATION.md`. One runner and synthetic users only; no hosted signed-user verification, formal security audit, physical multi-device or real user data.

## Verification
- Task final commit [verify:focused] pending. Dedicated signed real Auth lab must pass BOTH Chromium/RxDB and adversarial RPC cases, plus regular focused tasks. After green, squash only to a fresh isolated stable Preview, run full canonical Quality Gate, exact SHA signed lab and trusted CI-first READY. No claims before running.

## Next action
- Review focused checks + signed lab results, repair tests or any true access-control failure **without weakening policies**, then accept via isolated stable branch only. Record exact SHA and evidence in open #967.
- Continue hosted signed-user security signoff, identity migration, other six domains, media/DR/cost and reversible cutover. No dev/main/Production or 1.0 promotion without separate explicit approval.
