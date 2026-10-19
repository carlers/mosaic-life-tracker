# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 explicit one-shot refresh for conflicts parked in isolated Supabase RxDB candidate.

## Accepted base / authority
- Accepted isolated stable Preview `refactor/967-conflict-retry-gate-20261019@8c18f7496a068183b5e230556fd7fe05134d587b` via PR #1003, canonical Quality Gate #39208378291 SUCCESS, real-signed local browser lab #39208378331 SUCCESS, trusted CI-first Preview #39208590274 SUCCESS.
- Issue #967 OPEN. Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged. Hosted `mosaic-dev` 0 Auth users/0 candidate tasks/0 categories; 2 unresolved `authenticated_security_definer_function_executable` WARNs.
- Task `chatgpt/967-conflict-review-refresh-20261019` branched at exact accepted source. Version impact NONE; no shipped Mosaic app backend, real users, hosted schema/Auth, Appwrite, Production, dev/main or 1.0 changes.

## Scope
- Add source-only `candidateRxdbPilot.refreshPendingConflict(documentId)`: explicit owner-verified one-shot read of local pending draft and remote master while the native push is parked. No automatic timer, polling loop, duplicate checkpoint or remote write. Unknown review/collection fails before Auth/network calls.
- If current local draft still matches the rejected push and owner-scoped remote content now matches, clear review and wake native RxDB pending push; it rechecks remote before acknowledging. If remote differs, refresh the review snapshot/revision without waking. If local changed, fail closed `local-changed` and preserve original pending push; if owner/session switched or review was superseded mid-operation, fail closed without leaking review. Missing remote remains pending.
- Unit tests for external convergence, new remote revisions, unchanged/missing masters, owner switch, changed local draft and unknown review. Extend disposable signed local Supabase/Auth/CAS Chromium test with second conflict, explicit unchanged one-shot refresh, independent server CAS convergence, then explicit clear without an extra server CAS revision. Signed lab workflow branch family scoped to this task/stable Preview.
- Update Supabase evaluation with behavior and limitations. No React conflict UI or hosted provider activation.

## Verification
- Task SHA `81863a8cbaaa239a86c13da4c09ba1d06b1a019a`: focused/both browsers PASS (#39212908427), signed browser #39212908455 FAIL for correctly detected `local-changed` during a second scenario. Repair `d28ea1d153e6878958d4be3e0f426997f43b4b40` awaited the prior RxDB checkpoint; focused PASS, regular browser 1/2 passed and unrelated long-press sample-count flake was rerun unchanged (#39213485470). Signed browser #39213485590 reached convergence but correctly returned `updated` rather than `converged`: fixture independently wrote the same name but a **different `updated_at`**, so full canonical document equality rightly prevented premature acknowledgement. Second repair uses exact local timestamp on independent CAS and adds unit regression against name-only equality. Final task [verify:browser] and signed lab PENDING; do not weaken semantic compare. On green, squash only into fresh isolated `refactor/967-conflict-review-refresh-20261019`, require canonical full gate, exact-source signed browser lab, trusted Preview READY, then add precise resume evidence on #967. Do not substitute mock results for real signed provider proof.

## Next action
- Inspect task CI for types/browser failures, batch repairs without weakening fail-closed behavior. Complete isolated stable Preview delivery only after green.
- Later: future review UI, changed-local reconciliation policy/optional keep-both backup, multi-device and owner-switch stress, hosted real JWT/RLS and privileged function security review, other six data domains, social/media/Auth/DR/budget and reversible cutover. Keep #967 OPEN; no dev/main/Production or 1.0 promotion without separate explicit approval.
