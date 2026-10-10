# Session checkpoint

Updated: 2026-10-10
Current task: Implement #476, in-app production release history.
Baseline: `dev` `6ebb6ad78d27ce92d58df557ced5553ed5f59e2d` (v0.11.0); `main` `131a8289feee2af392b18fa675222ac8e76ef258` (v0.6.2).
Task branch: `chatgpt/release-history`; stable Preview: `feature/release-history`; proposed version: **0.12.0**.

## Scope
- Lazy route `/settings/releases` from About & updates, normal detail-route Back/swipe behavior.
- Public GitHub Releases fetch on demand, stable published tags only, bounded safe model/cache, offline and failure/empty states. No Appwrite or production backend mutation.
- Preserve Version/build diagnostics and Check for Updates. Use semantic theme roles.
- Tests for sorting/filtering/cache/failures, settings navigation and page states.
- Add publication checklist to `docs/VERSIONING.md`. Public GitHub Releases and tag refs were empty when inspected; **do not create speculative historical release notes**.

## Verification and delivery
- Single scoped task commit with `[verify:focused]`; focused green before squash to stable Preview.
- Require exact stable Preview SHA full canonical CI and Vercel READY. Check bundle budgets; separate real-device/theme/Back acceptance remains manual if not performed.
- User approval for this implementation does **not** authorize Preview → dev or dev → main. Production tag/release publication requires verified main CI and deployment; connector release-write is not available in this environment.
- Keep #476 open until production delivery and release-publication acceptance are complete.
