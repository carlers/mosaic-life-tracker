# Session checkpoint

Updated: 2026-10-11
Current task: Issue #476 — approved, gated first official `v0.12.1` GitHub Release bootstrap.
Baseline: `dev` `7aa2dace282dcebb4bcc9e4c52f350691a0d479f`; production `main` `9560b12afb8c7bb9e0ffb2083bf22865a4d0445b` (both version 0.12.1).
Task branch: `chatgpt/bootstrap-v0121-release-476`; stable Preview target: `feature/bootstrap-v0121-release-476`.

## Goal

The production publisher was successfully installed and triggered by main CI (workflow run 38073666648) but correctly skipped the same-version maintenance merge. No tag or GitHub Release exists. User authorized a one-time, evidence-gated bootstrap of the original accepted production release on historical SHA `95c8b25edeba5e2730252f6d265d392949890caa` (PR #505, main canonical CI 38047640758, Vercel production READY `dpl_7fPghDwB9z2dvW7w2rCwHB8zmZCY`).

## Scope

- Add an explicitly pinned one-time bootstrap helper and branch in the existing trusted production publisher, never tag current maintenance main at `v0.12.1`.
- Require old PR, original main commit+version, first-parent production version, successful old CI and pinned Vercel commit status, main ancestry, successful current CI/Vercel status, safe tag+published Release readback.
- Freeze clear user-facing aggregate notes with the original production PR link and present-day publication timestamp; no fabricated backdated entries or Appwrite storage.
- Add unit regression cases for provenance, no-op and failure states. Workflow remains the same; version impact NONE, no frontend/Appwrite changes.

## Delivery

Task `[verify:focused]` → stable Preview squash/full canonical CI + Vercel READY. Explicit per-boundary promotion to `dev` then `main` under repo delivery rules. Once new main CI succeeds, the existing trusted `workflow_run` publisher should bootstrap exactly once; check real GitHub tag and Release API, notes and Mosaic Settings history after refresh. Do not claim actual publication until public API proves it.

## Next action

Commit coherent task and run focused check; fix any failure, promote to stable Preview, verify CI and Vercel. Continue only through authorized branch promotions, retaining issue #476 until genuine public Release readback and end-to-end UI acceptance.
