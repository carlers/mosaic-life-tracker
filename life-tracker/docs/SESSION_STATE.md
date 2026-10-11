# Session checkpoint

Updated: 2026-10-11
Current task: complete user-approved v0.17.0 Settings history-return integration deployment on dev. No main promotion.

## Verified
- Settings and granular release-history combined Preview `feature/settings-forward-integration` at `cfaf89dcf61636820289fe418f30b3b2b368b5b5`: full canonical run 38118593714 SUCCESS; Vercel `dpl_B9CNKb7G6257t65LWpqVdNHb5rQq` READY using Scratch. All seven size budgets passed (entry gzip 131696/131752).
- User-approved promotion PR #580 merged to dev `5c8b1efda131ed7cd1315a9e41f9115ec03e7665` (v0.17.0). Dev CI 38118734273 SUCCESS. Source and merged dev tree both `5e456b21b2633b7cf83d27fe4130994fd1067944`; dev first parent was previous dev `6a097ada3bf729d55fa959e7d03da551fea51930`.
- Exact dev Vercel `dpl_HkFmS81yqaE91YKwHBe83ZZnvqY7` builds against Scratch and compiles/PWA checks, but dev-specific output is 2,050 B larger raw/precache than byte-identical accepted Preview. Raw 2401354 vs limit 2401300 (+54); precache 2485705 vs 2485700 (+5). Other five limits including entry, initial/Home and aggregate gzip pass.

## Repair
- Budget-only: raise aggregate app raw cap to 2401450 (96 B headroom) and precache cap to 2485800 (95 B headroom) and update the exact regression expectations. Keep entry, initial, Home and aggregate gzip caps unchanged; no UI, Appwrite or app version changes.
- Task branch `chatgpt/settings-forward-dev-size` targets stable Preview `fix/settings-forward-dev-size`, both based on failed-deploy dev SHA `5c8b1ef`.

## Next action
- Require task focused CI success, squash to stable fix Preview and verify exact canonical/READY Scratch Vercel; then user-authorized budget correction PR to dev.
- Verify dev CI and live Scratch Vercel READY for the final commit; do not touch main. Device-specific iOS/Android gesture, Android Back with sheets and Escape-as-Back remain manual acceptance.
