# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #955 — Uncompleted Tasks owner-only overview, Preview trust-route repair.

## Boundary
- Original task base: `dev@613903cd01b8857f16d4f75fa02e84b1d39e6263` (v0.36.3).
- Stable Preview branch: `feature/uncompleted-tasks-955`; prior nonaccepted candidate `081dec937eb8bb191183ed91325243482deffce5`.
- Working task branch: `chatgpt/955-trusted-route-compat-20261021`.
- User authorized implementation and Preview, not dev/main promotion, Production edits, or main-only routing pin rotation.
- v0.37.0 (MINOR), three synchronized version files. No backend/schema/migration change.

## Implementation
- Add the owner-only uncompleted-task aggregation with grouped overdue/today/upcoming/undated dates, existing checkbox operation, original-task focus, and Home/Me menu navigation.
- Because the protected-main trusted Preview receiver pins the exact legacy 15-route Vercel config/hash, use the existing trusted `/backlog?view=uncompleted` SPA path rather than change its Vercel rewrite/security contract. Render the new view separately via the Backlog route, without changing `/backlog` itself.
- Received shared tasks are not included; preserve owner isolation and Backlogs behavior.

## Verification
- Original task focused CI SUCCESS on `2a263a6ff3c0f3dd204b9e2e4de61166e20c0737`.
- First stable full CI `39462453965` failed on expanded-route preview security allowlist and route registry assertions.
- Focused repair CI `39462960181` passed on `951f0afb6bc2814723dddbc6171ecc09b623b601`.
- Second stable full CI `39463302137` rejected new routing evidence against 15-route trusted static-output contract. This is a deliberate gate, not permission to modify Production.
- New route-compatible candidate, tests, exact-SHA full CI and Vercel Preview are not yet accepted. Manual Scratch/device testing outstanding.

## Next action
- Verify route-compatible task branch focused CI; then squash through a PR into stable `feature/uncompleted-tasks-955`.
- Confirm exact-SHA canonical CI, Vercel READY and the direct query URL. Keep dev/main untouched until explicit promotion approval.
