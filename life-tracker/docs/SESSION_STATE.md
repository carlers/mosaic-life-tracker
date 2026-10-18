# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 native ARM64 Node Function runtime proof without OCI VM.

## Boundary
- Based on accepted isolated `refactor/975-native-arm64-proof-20261019@5e332b3ec68ef2e3a9413295b82ab3759390757e`; previous native Appwrite image verification ten-of-ten passed in Actions #39173214388; full canonical #39173487970 and trusted delivery #39173625406 success.
- Protected dev `a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, Production main `b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged; owner has not created Oracle VM.
- No Appwrite/Scratch/Production or OCI access or credentials. Internal test/tooling, app version impact NONE.

## Work and finding
- Mosaic's source Function manifests require `node-18.0` for message-action and `node-22` for dr-backup; upstream Appwrite 2.5.0 `.env` only enables Node 22 by default.
- Isolated branch `chatgpt/975-node-runtime-arm64-20261019` adds a branch-scoped, no-secret native GitHub ARM runner proof for `openruntimes/node:v5-18.0` and `openruntimes/node:v5-22` real pulls plus synthetic Node code execution in network-disabled, read-only, 2-CPU/512-MiB containers.
- `docs/SELF_HOSTING_FUNCTION_RUNTIMES.md` explains configuration requirements, known Node 18 EOL risk and major remaining Appwrite Function/integration gates; linked from OCI runbook and docs index.

## Verification
- Pending focused task CI, native ARM64 job, stable canonical and trusted delivery. No actual hosted Appwrite service or real Function has been run.
- The unchanged Mosaic user data/permissions, SDK parity, 2-OCPU capacity and R2 DR/NAS remain unverified.

## Next action
- Review native runner and focused results, resolve relevant failures, squash into isolated stable Preview, run canonical and trusted delivery. Keep #975 open; no dev/main or Production changes without separate approval.
