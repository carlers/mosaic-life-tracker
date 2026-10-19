# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1047 — CI-first Vercel Preview commit titles, metadata-only.

## Boundary
- Source base: protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` (v0.29.12). Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged.
- Task branch `chatgpt/ci-first-preview-commit-titles-20261020`; **version impact NONE**. Separate accepted stable Preview and protected-main approval required.
- Preserve current trusted CI-first artifact verification, idempotency, no Git-triggered rebuilds, and no Production/alias/provider configuration edits.

## Changes
- Protected writer derives Git display metadata from its existing authenticated exact-SHA GitHub commit GET and passes conventional `githubCommitMessage`/`githubCommitSha`/`githubCommitRef`/repo/author keys to `vercel deploy --prebuilt --meta`.
- Metadata is strictly bounded and checked against the accepted Preview plan; Vercel READY readback must reflect the intended values.
- Duplicate detection now distinguishes our recognized CLI deployment with Git *presentation* fields from a real Git deployment or any unknown same-SHA/ref upload when the listing omits a source.
- Regression coverage expanded for trusted source, title handling, CLI flags, identity checks, safe collisions and preserved writer isolation.
- Deployment workflow policy clarified in `docs/DELIVERY.md`.

## Verification
- New task SHA requests `[verify:focused]`; inspect exact-run result and repair if needed. Canonical stable Preview and trusted artifact delivery must pass before any separate protected-main approval request.
- Static tests cannot prove the Vercel dashboard uses supplied Git metadata. A new deployment using the updated protected-main writer is required for definitive UI acceptance.
- No Production release, protected-main change, version bump or provider mutation performed by this task commit.

## Next action
- Verify focused CI, squash to isolated stable Preview, verify canonical and trusted delivery. Prepare the smallest protected-main infrastructure-only promotion **only after explicit separate approval**, preserving the entire Production app tree. Verify the first subsequent CI-first Preview dashboard title; keep issue #1047 open until provider acceptance.
