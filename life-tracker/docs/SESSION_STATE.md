# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #955 — Uncompleted Tasks borderless UI refinement.

## Source and authorization
- Stable Preview branch: `feature/uncompleted-tasks-955`; accepted baseline `1ffa3bda791aa2f20965c8c055a40db7f01ce95c` (v0.37.0).
- Task branch: `chatgpt/955-uncompleted-borderless-20261021` based on the accepted Preview.
- User authorized a visual refinement of the uncompleted-task list and updated Preview, but no merge to `dev`/`main` or Production changes.
- Candidate v0.37.1 (PATCH, subsequent user-testable refinement). Recheck versions before promotion.

## Scope
- Remove the surrounding section-task card border and internal row separators.
- Use airy flat rows, neutral hover/focus feedback, improved typography and metadata spacing.
- Preserve checkbox appearance/target, task semantics, grouping/counts, navigation, accessibility, theme tokens, offline ownership isolation and the trusted `/backlog?view=uncompleted` path.
- No backend, database schema, route, shared-task, or security changes. This is style-only; do not add CSS-specific automated tests.

## Status and next action
- Visual edit and version files prepared; focused CI on final task SHA, stable Preview squash/acceptance and exact-SHA Vercel deployment still require verification.
- Previously accepted Preview v0.37.0: [canonical CI #39464835455](https://github.com/carlers/mosaic-life-tracker/actions/runs/39464835455), READY Vercel deployment `dpl_4Wvyhdn3y7zS9T767Qz7Mkispmtb`.
- Manual Light/Dark/Black and mobile visual acceptance still outstanding; user has not approved `dev` promotion.
