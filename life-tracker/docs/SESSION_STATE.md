# Session checkpoint

Updated: 2026-10-11
Current task: Mosaic issue #592 — approved Batch B/C workflow improvements, isolated Preview only.

## Verified baseline
- User explicitly accepted Batch A manual Preview testing. Source stable `feature/workflow-batch-a-592` SHA `64782bda2df4223f5d939fce5e92b11f756342e1`, canonical 38124598875 SUCCESS.
- Same-SHA GIPHY-on Vercel `dpl_7kQcdSp6HxMjxVv1N2WCi7nk4mzV` READY, Scratch Appwrite, size budgets PASS; generic Preview GIPHY scope in place.
- Last verified dev `f65d348c2f537b4d8c1063096e6856a9ee3d629f`; main `614cd1dccbd01bf70493874496559720b320151a`. Do not infer promotion from issue approval.
- #520 task PR focused CI 38073043249 SUCCESS; squash staged to `feature/branch-hygiene` SHA `9dc682a650280693026fe36b2e8ebb5f75fdfd17`, pending fresh full/Preview proof. This is not dev/main.
- #557 Scratch workflow PR still open/conflicted on dev; backend activation remains separately approved/guarded. Branch protection admin capability unverified.

## Current implementation
- On `chatgpt/workflow-bc-preflight-592`, built from the accepted Batch A SHA: add pure fail-closed dev preflight with tests; CLI reads GitHub/Vercel and merge-tree with no PR or merge side effect; scope the publisher workflow_run to main while preserving dispatch/scheduled recovery; update docs. App version NONE, budgets unchanged.
- B0 global session-checkpoint relaxation deferred pending actual new-chat recovery parity; no production/backend mutation. C0 branch protection administration requires explicit settings review; C1 stays with #526/#557.

## Focused documentation-contract repair

- Batch B1 adds explicit focused documentation-contract unit verification for Markdown changes; regression covers the selector and #520's previously missed checkpoint failure class. No app version/budget/backend/UI changes.
- Existing #592 preflight/publisher stable Preview is separate; check its canonical CI and Vercel before asserting acceptance.

## Next action
Run focused task checks, repair failures, squash accepted task into a separate stable Preview, verify full canonical CI and Vercel READY. Independently verify #520 stable Preview canonical/Vercel. No dev/main promotion without user instruction.
