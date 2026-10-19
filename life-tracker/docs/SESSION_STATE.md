# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1047 — readable commit titles for CI-first Vercel Previews.

## Boundary
- Base is protected `dev@682303946c00b14ee3ac3fc3e33b2dc541a39a86` (v0.29.15); `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged.
- Working branch `chatgpt/ci-first-preview-titles-integrated-20261020`, superseding prior proof-only `chatgpt/ci-first-preview-commit-titles-20261020@3e479401611dc1a55c4b57c4eb92067bc9a4fad6`.
- Infrastructure-only, version impact NONE. No Production/app/alias/provider changes. Protected-main deployment writer needs separate approval.

## Changes
- GitHub exact-SHA commit title, branch, author and repo are validated and attached as bounded Vercel CLI Git metadata alongside the unchanged `mosaicPrebuilt*` identity markers.
- Provider READY metadata is verified. Existing artifact trust, allowed Preview project, deterministic deployment ID and no-alias guarantees remain.
- Collision detector distinguishes the recognized CLI prebuilt from independently deployed Git/unknown records even when Vercel omits list `source`.
- Added unit tests for malformed/spoofed metadata, CLI scope and collisions; documented main-owned writer handoff in `docs/DELIVERY.md`.

## Verification
- Earlier exact feature tree at `3e479401611dc1a55c4b57c4eb92067bc9a4fad6` passed focused Quality Gate #39296042413. This branch replays identical task source blobs atop newer dev, preserving unrelated v0.29.15 changes.
- Awaiting new exact-SHA focused CI, stable Preview full canonical CI and trusted delivery. Actual Vercel title display cannot be established until the updated writer is separately approved into protected main and runs for a new Preview.

## Next action
- Verify focused CI and repair; squash into stable Preview; verify exact SHA canonical acceptance / READY. Prepare a minimal main-only infrastructure PR (never promote full dev) and await explicit owner approval to merge to protected main. Verify a new CI-first Preview dashboard title after activation.
