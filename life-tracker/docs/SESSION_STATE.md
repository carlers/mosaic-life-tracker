# Session checkpoint

Updated: 2026-10-19 UTC
Current task: Reduce documentation-only CI friction for Mosaic handoff checkpoints and token estimates.

## Boundary
- Base is protected `dev@87b3a1d027b088e55d4b6dfccb6230b7df053f68` (v0.29.12); Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged.
- Scoped task branch: `chatgpt/doc-contract-advisories-20261019`. No app runtime, schema, auth, sync, provider, deployment, or version change.
- Keep AGENTS.md and AI_WORKFLOW.md instructions unchanged. Continue writing clear next actions and aiming for a concise handoff; this changes enforcement of two incidental shape/size checks only.

## Changes
- `scripts/lib/create-handoff.mjs`: missing next-action heading becomes a returned advisory, accepting common equivalent headings. Required Updated and Current task/work markers still fail closed.
- `scripts/create-handoff.mjs`: surface advisory on stderr without blocking handoff generation; retain strict GitHub exact-SHA and path safety checks.
- `tests/unit/documentationContracts.test.ts`: 3,000 estimated-token handoff target becomes an advisory, preserving proof that the complete agent instructions and session checkpoint are included.
- `tests/unit/createHandoff.test.ts`: coverage for alternate headings, missing-step advisories, and continued required-context failures.

## Verification
- Pending task focused CI, canonical stable Preview gate and trusted delivery; no local test-run or CI acceptance has yet been asserted.
- Existing unrelated performance, security and Supabase/Oracle backend workstreams remain separate.

## Next action
- Commit coherent task with `[verify:focused]`; repair relevant failing tests if necessary. After focused green, squash into a separate stable Preview branch for canonical CI and trusted delivery. Do not promote to dev/main without explicit approval.
