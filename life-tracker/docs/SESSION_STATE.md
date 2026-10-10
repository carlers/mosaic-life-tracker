# Session checkpoint

Updated: 2026-10-10
Current task: Reconcile and promote release-history issue #476 to `dev` (user explicitly approved).
Baseline: live `dev` `4eb8cb39b078d20989d1325a97207b6e6d4fa1c9` (v0.11.3); original accepted release-history Preview `feature/release-history` `896beed48bb5606bb802af277b378ceb9475221e` (v0.12.0); `main` unchanged at `131a8289feee2af392b18fa675222ac8e76ef258`.
Integration task branch: `chatgpt/release-history-dev-integration`. Stable Preview: `feature/release-history-dev-integration`. Combined candidate **v0.12.1**: v0.12.0 was already published as a user-testable Preview; a different combined release tree must not reuse its version.

## Scope and conflicts
- Preserve ALL independent v0.11.3 navigation, chat jitter, task-input and single-display-name fixes on `dev`.
- Layer the accepted #476 lazy Settings → Release history route, GitHub published-production Releases model, bounded public offline cache, retry/loading/empty UI, unit+DOM+route regressions and release-publication checklist onto the latest dev tree.
- Keep Settings build diagnostics and separate PWA update action unchanged; retain standard protected-route parent/back and gestures including current navigation motion defaults.
- Appwrite data and schema are unaffected. Official Preview/dev use Scratch, main remains Production.
- Current `dev` build-size ceilings are newer/larger than the original release-history Preview. Do not replace them with the older ceilings; measure the **combined** production asset growth before adjusting any limits. Preserve historical baseline and entry/startup/Home ceilings.

## Verification
- Because combined source likely has under 1 KiB aggregate/headroom, use **one explicit full task diagnostic** to measure build growth before the stable Preview gate. Repair only observed failures, then request `[verify:focused]` on final coherent task branch commit.
- Squash focused-green task into stable integration Preview; require exact SHA canonical full CI and Vercel READY on new combined tree. Then merge the accepted stable Preview via PR into `dev` under this user's existing explicit authorization. Verify resulting dev SHA, version, CI, deployment.
- Manual authenticated phone/Android Back/swipe, Light/Dark/Black, offline cache and exact-origin Scratch preview remain separate checks and cannot be claimed as passed without evidence. Scratch Appwrite rejects additional exact Web platform registrations due to Free-plan platform quota; dev has an existing registered alias.
- Production `main` stays unchanged. GitHub public Releases/tag list is still empty; creating production GitHub Releases is not part of this authorization, and #476 remains open until actual main release.

## Next action
Finish combined source/tree, run measured task CI, repair and reverify, then stable Preview CI/Vercel, and authorized `dev` PR promotion.
