# Session checkpoint

Updated: 2026-10-03
Current task: Reduce routine GitHub Actions wall time without weakening Mosaic's stable Preview acceptance or branch safety.
Status: Workflow implementation is complete on `chatgpt/workflow-wall-time`. Ordinary AI task pushes are classification-only; explicit `[verify:focused]` / `[verify:browser]` checkpoints provide development verification; stable Preview branches own the single routine full canonical gate; exact accepted stable Preview → `dev` promotions can reuse acceptance only after PR provenance, first-parent continuity, identical-tree, and source canonical-check validation. Ambiguous promotions fall back to the full gate. The final task commit includes this checkpoint, so no post-green documentation patch is needed.
Next action: Let this exact task commit run focused verification, fix any failure, then squash it into `perf/workflow-wall-time`. The stable branch must pass its automatic full canonical gate and Vercel Preview before handoff. Promotion to `dev` remains user-controlled.
Blockers: None known.

## Results

- Preserved the `dev → stable Preview → AI task branch` hierarchy; branch creation was not the measured wall-time bottleneck.
- AI WIP pushes now use a `skip` mode (classification only). `[verify:focused]` requests the focused gate; `[verify:browser]` requests focused + browser contracts; `[verify:full]` remains an exceptional escape hatch.
- Stable Preview branches remain automatic full/canonical + Vercel Preview, so the accepted/tested tree is the same tree used for manual acceptance.
- `dev` uses a promotion verifier. It reuses stable acceptance only for a two-parent merged PR from an approved stable branch, with push-before SHA equal to first parent, merge tree equal to the stable source tree, and successful source `canonical-acceptance`. Any missing or mismatched evidence runs the full gate.
- `main` remains full verification.
- The production build job now restores the existing lockfile-keyed `node_modules` cache before falling back to `npm ci`.
- Workflow docs explicitly prohibit status-only post-green checkpoint commits and direct agents to batch remote edits.
- Added classifier, promotion-evidence, and workflow-contract unit coverage.
- Historical baseline from the holiday delivery: focused task verification was about 28 s; each full gate was about 60–64 s, and the same accepted code received full gates on the task, stable Preview, and `dev`. The new routine path targets focused → one stable full → promotion check.

## Verification

- Final task commit requests `[verify:focused]`; remote result is recorded by GitHub Actions rather than patched into this file afterward.
- Stable Preview full canonical acceptance: required after squash.
- Stable Preview Vercel deployment: required after squash.
- Promotion fast path: covered by deterministic unit tests and existing GitHub promotion evidence shape; live `dev` execution occurs only after explicit promotion.
- Manual/device acceptance: not applicable to this workflow-only change.
