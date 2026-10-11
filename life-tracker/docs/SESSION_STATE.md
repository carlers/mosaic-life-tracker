# Session checkpoint

Updated: 2026-10-12
Current task: Issue #645 Phase 2 D1/D2 repository source discovery pilot; user authorized task branch and stable Preview, not dev/main merge.

## Scope and exact base
- Base: dev@deb497fa032e7e95842f1e79f3a77b45bf3f369e; source-only documentation/tooling changes, no app version bump.
- Task: chatgpt/repo-discovery-645; stable Preview: refactor/repo-discovery-645.
- Existing Phase 1 version-only focused selector remains accepted separately on refactor/focused-version-stamps-645; do not pull it into this branch implicitly.
- Preserve Scratch/Production separation, Preview canonical gate and explicit promotion approvals. The global checkpoint on dev previously referred to Bucket List #405; its completed dev promotion is live Git truth.

## Work
- D1: docs/REPO_MAP.md is a concise optional user-intent-to-source starting hint; docs/README.md links it.
- D2: docs/COMPONENT_INDEX.md indexes all eligible component/page TS modules plus App and protectedRoutes, grouped by source folder. scripts/lib/repo-component-index.mjs and scripts/generate-repo-index.mjs implement offline --write/--check; existing contracts reject stale inventory. Tests cover current completeness, determinism, additions/moves/deletions and Markdown path escaping.
- No runtime behavior, app styles, Appwrite configuration, dependency additions or CI-gate weakening.

## Next action
- Confirm this task commit focused CI green, review exact PR diff, squash through task PR into stable refactor/repo-discovery-645, then verify full canonical acceptance and exact-SHA Vercel READY. Post evidence to issue #645; leave dev/main untouched. D3 isolated cold-chat discovery measurement remains separate and pending.
