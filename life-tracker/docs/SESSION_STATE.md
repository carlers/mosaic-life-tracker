# Session checkpoint

Updated: 2026-10-08
Current task: Implement user-testable Preview version increments and expandable full commit messages in Settings.
Branch: `chatgpt/semantic-versioning` from `dev`; stable Preview: `feature/semantic-versioning`.
Objective: A feature receives 0.4.0 in its first user-testable Preview, subsequent accepted refinements increment PATCH, and identical accepted version carries to dev and main. Merge titles/bodies explain shipped behavior instead of generic promotion mechanics.
Constraints: Keep exact-tree Preview -> dev promotion reuse, no release to dev/main without explicit instruction, preserve PWA/build metadata and existing design, avoid per-internal-commit bumps.
Implementation: Add agent protocol in VERSIONING/AI_WORKFLOW/DELIVERY/AGENTS; synchronized version CLI + contracts gate and regressions; set this feature's Preview to 0.4.0; full commit message disclosure with DOM regression; remove hard-coded version assertions.
Next action: Run focused task check, squash into stable Preview, verify canonical acceptance and Vercel READY, then provide link for user acceptance.
Blockers: None known at implementation start.
