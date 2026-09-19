# Session state

Updated: 2026-09-19
Current task: Migrate project guidance from the DeepSeek web workflow to the Codex VS Code workflow
Status: complete; committed after automated verification
Roadmap pointer: `PLAN.md` — Phase 3.1 Bundle audit
Next action: Plan Phase 3.1 without changing runtime code.
Blockers: none

## Decisions in force

- Open `life-tracker/` as the VS Code workspace and treat it as the project root for
  Codex, commands, and documentation. The parent Git repository remains unchanged.
- `AGENTS.md` is the sole active project instruction file. Detailed contracts live in
  `docs/PROJECT_REFERENCE.md`.
- Use GPT-5.6 Sol for routine implementation and GPT-6 Astra for architecture, broad
  audits, unclear debugging, and high-risk sync/auth work. Recommendations are advisory.
- Codex completes one agreed batch autonomously and stops before another batch, commit,
  push, deployment, publication, or unapproved remote change.
- Keep the repomix/dump/apply toolchain as an optional legacy fallback.

## Deferred

- Image-cache LRU cap (OFF-6) → Phase 3.4.
- PWA update prompt, `beforeinstallprompt`, and Profile sharing → Phase 3.5 or later.
- Full WCAG AA audit, calendar-grid semantics, and keyboard day navigation (A11Y-33)
  → Phase 4.

## Verification

- Documentation-only migration passed link/reference scanning, instruction-size and
  structure checks, roadmap consistency review, `git diff --check`, diff review, and lint.
- Historical baseline from 2026-09-18: 390 tests passed. This migration does not claim
  a new runtime test result.

## Unfinished changes

- None known.
