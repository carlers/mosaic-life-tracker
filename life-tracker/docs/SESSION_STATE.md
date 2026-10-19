# Session checkpoint

Updated: 2026-10-20 UTC
Current task: Integrate owner-approved #1033 Select-mode completion guard onto latest dev.

## Boundary
- Source owner-approved stable Preview: `fix/select-mode-checkbox-1033-20261020@096b48a17e156f99ab85591345ed043d13c6621b` (v0.29.14). Canonical CI #39290228245 SUCCESS; trusted delivery #39290494053 READY; owner acceptance and explicit dev promotion approval recorded.
- Protected dev baseline: `ec1cb4db12fed5d23a8cb3ae6d1c5c923370e201` (v0.31.2), which already contains category manager reverse and inline editing, plus sticky weekday Calendar headers. Do not overwrite these newer changes.
- Integration task branch: `chatgpt/1033-checkbox-current-dev-20261020`. Stable integrated Preview: `fix/1033-checkbox-current-dev-20261020`, v0.31.3 (avoids version regression).
- Scope: Frontend task selection fix, its DOM tests, reference contract and synchronized version; no backend/schema/security/provider change, no main/Production authorization.

## Changes
- Apply exactly the accepted Select-mode completion guard to the current dev `TaskItem.tsx`: completion control is aria-disabled and inert, nested keydown stays isolated; row/title selection unaffected.
- Apply accepted `TaskItemGestures.test.tsx` regression: completed and incomplete tasks in select mode cannot toggle completion or accidental selection; ordinary toggle restored outside select mode.
- Update `PROJECT_REFERENCE.md` §2 selection completion contract on current dev; preserve unrelated sections.
- Version three source-of-truth files consistently from 0.31.2 to 0.31.3.

## Verification
- Prior accepted source verified: focused CI #39289771779, canonical #39290228245, trusted Delivery #39290494053 SUCCESS (old baseline only).
- This integrated tree is **not yet verified**. Requires task focused CI, stable Preview full canonical gate and trusted delivery; verify live dev head, exact tree and version before promotion.

## Next action
- Create coherent `[verify:focused]` task commit, squash to integrated stable Preview only after green, verify canonical acceptance and trusted delivery, then create and merge a two-parent promotion PR into dev on the current first-parent baseline with exact-tree/CI evidence. Never promote to main or Production.
