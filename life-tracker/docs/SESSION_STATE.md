# Session checkpoint

Updated: 2026-10-08
Current task: Implement user-testable Preview version increments and expandable full commit messages in Settings.
Branch: `chatgpt/semantic-versioning` from `dev`; stable Preview: `feature/semantic-versioning`.
Objective: A feature receives 0.4.0 in its first user-testable Preview, subsequent accepted refinements increment PATCH, and identical accepted version carries to dev and main. Merge titles/bodies explain shipped behavior instead of generic promotion mechanics.
Constraints: Keep exact-tree Preview -> dev promotion reuse, no release to dev/main without explicit instruction, preserve PWA/build metadata and existing design, avoid per-internal-commit bumps.
Implementation: Add agent protocol in VERSIONING/AI_WORKFLOW/DELIVERY/AGENTS; synchronized version CLI + contracts gate and regressions; set this feature's Preview to 0.4.0; full commit message disclosure with DOM regression; remove hard-coded version assertions.
Next action: Re-accept the measured Vercel size repair through focused -> stable Preview full CI, verify Vercel READY, then provide the preview link.
Previous stable Preview v0.4.0 Vercel deployment 505ae580 failed only the production-size guard: 2,324,082 B precache exceeds the accepted 2,323,600 B ceiling by 482 B. Remove decorative ChevronDown markup in favor of the built-in native details indicator, preserving the expandable full message. No version bump is spent on failed Preview candidates.
