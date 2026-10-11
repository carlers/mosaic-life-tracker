# Session checkpoint

Updated: 2026-10-11
Current task: issue #526, prepare a safe default-branch Scratch Function writer. No dev/main promotion or cloud activation authorized here.

## Verified baseline
- Based on dev `b76ca6295a8409309c232b25d44fa7f63cbc6878`; v0.16.7. Feature-only code remains on the stable combined backend integration branch `refactor/scratch-backend-integration-526` at `a52ce85c592063ba8a9415ab58fb580716dd1dba` (full canonical CI green).
- Live Scratch `message-action` remained on deployment `6aca71f3ec33c9501753`; `task_shares` exists, `tasks.date` is required varchar. No backend activation or production mutation.
- Scratch Web platform quota blocks new exact Backlog/integration stable alias registrations (403). Existing `*.vercel.app` wildcard remains unchanged.

## Candidate
- Stage the already reviewed, source-SHA-gated single-writer workflow on a dev-based task branch, with authorization and secret-scope regression tests.
- Document required protected GitHub Environment, human review, Scratch-only API key, exact active deployment preflight, and Web-origin blocker.
- Version impact NONE; no frontend or backend runtime code changes in this task.

## Next action
- Request focused CI for this coherent task commit; repair any failures, then squash to dedicated stable Preview for canonical CI and Vercel readiness.
- Separate approval is required for dev/main promotion; actual workflow dispatch also requires protected Environment and scoped secret. Keep #526 and #407 open until exact Scratch Function deploy/readback and authenticated disposable-account acceptance.
