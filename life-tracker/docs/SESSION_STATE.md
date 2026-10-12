# Session checkpoint

Updated: 2026-10-13
Current task: #592 automatic exact-SHA Preview pilot (default OFF).
Issue #592 and live GitHub/Vercel status are authoritative.

## Proven baseline

`fix/workflow-build-parity-592-20261012@61e23ac09e714f968a55b36eae965fa58870e6ac`:
canonical Quality Gate `38313859876` SUCCESS; Git Preview
`dpl_AaCKuw5BMpfhyEszbbLYjCUoJKyF` READY at stable branch alias.
Protected manual canary `38290165183` attempt 2 SUCCESS,
prebuilt CLI `dpl_9CgjZjmxMCqSqZxEkSpVspxKbB3d` READY,
same accepted prior SHA, Scratch/GIPHY/Node 24, seven budgets PASS.
A provider-readback duplicate guard is now tested and shipped.
No dev/main or Production change.

## Active isolated implementation

`chatgpt/592-preview-auto-pilot-20261013`: stage a **disabled**
`preview_auto_pilot` job alongside existing manual canary in
`.github/workflows/quality-gate.yml`. Strictly restrict to one
pilot stable branch, successful same-run exact-SHA canonical checks,
Actions repository opt-in flag `MOSAIC_AUTO_PREVIEW_ENABLED`,
**new separate** narrow branch-restricted `mosaic-preview-auto`
environment/secret `MOSAIC_PREVIEW_AUTO_VERCEL_TOKEN`.
Reuse prebuilt build, exact SHA/dedupe, Scratch and seven budgets.
Pre- and post-validate READY CLI metadata, assign and read back
**existing stable Preview alias only** with `vercel alias set`.
No automatic execution until trusted environment and opt-in exist.
Manual reviewed canary remains unchanged.

## Next action

Complete focused CI, squash to stable Preview, run full canonical
and verify Vercel Git Preview READY; do **not** enable automatic
secret-bearing deployment or disable Vercel Git delivery yet.
Owner/admin must provision unattended environment one time,
then staged alias/idempotency/CI-red/semantic parity acceptance.
The current protected manual canary is already proven; do not
ask owner to run it again. Same SHA hosted vs local JS/CSS digests
differ `13df5b4...` vs `e24cedd...`; investigate before switching.
User requirement: zero routine GitHub dispatch/approvals; explicit
authorization only for dev/main and sensitive releases.
Keep #592 OPEN for remaining rollout, build-size policy,
scheduled audits and promotion pilot.
