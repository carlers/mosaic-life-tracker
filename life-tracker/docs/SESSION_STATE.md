# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1004 permanent experimental dogfood PWA integration.

## Boundary
- Source baseline: `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` (v0.29.12); `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` not modified.
- Reserved stable dogfood branch: `feature/dogfood`, created at the verified dev baseline; task branch: `chatgpt/1004-dogfood-workflow-20261019`.
- No frontend/runtime version, schema, auth, backend, or production promotion change. Reuse reviewed generic Preview producer and source-side Vercel Git suppression unchanged.

## Changes
- Document permanent dogfood testing, ordinary isolated Preview acceptance, per-feature rejection/revert, and accepted Preview → dev authorization boundary.
- Fail closed on direct dogfood→dev in all three promotion assessment paths with targeted regressions.
- Add dedicated linked dogfood workflow guide. Initial stable alias and installed-PWA acceptance require a live accepted deployment.

## Verification
- Pending focused task CI, stable dogfood canonical acceptance, trusted Preview READY/readback, exact Scratch origin registration and real device/PWA tests.
- Main-owned trusted Preview writer currently does not assign stable aliases; do not claim an installed permanent PWA or invent a URL before that gap is resolved safely.

## Next action
- Commit coherent task and request `[verify:focused]`, then squash only after focused green into `feature/dogfood` for canonical CI. Verify the default-main generic trusted receiver and exact Vercel READY deployment; design/gate a stable alias handoff before any installed-PWA claim.
- Record a separate explicit approval if later main-owned trust/alias infrastructure must change. Never directly promote dogfood, dev/main or modify Production.
