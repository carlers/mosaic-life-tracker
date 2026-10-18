# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 — native ARM64 Docker pull/process proof without an OCI VM.

## Boundary
- Starting from isolated unified selfhost Preview `refactor/975-unified-offline-readiness-20261019@06b45c6e994049fdd21dd849c43dadf88ca3aa9e`, after full canonical gate #39172181307 success and trusted delivery #39172343390 READY.
- Protected dev `a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, main `b952f71ecd2add3172f90104bc0e856a2648ccc9` remain unchanged. The owner cannot yet create OCI VM. No Production/Scratch access, secrets, user data or cutover.
- Task branch `chatgpt/975-native-arm64-proof-20261019` contains a narrowly scoped native GitHub hosted ARM64 smoke workflow and guide, not Appwrite application runtime changes.

## Evidence and work
- Official Appwrite 2.5.0 upstream Compose tag lists appwrite/appwrite, appwrite/postgres, openruntimes/executor, orchestrator, clickhouse, Redis, Traefik, console, browser and geo images. GitHub supports ubuntu-24.04-arm runner on public repositories.
- New `.github/workflows/selfhost-arm64-probe.yml`: branch-specific no-secret hosted `ubuntu-24.04-arm` image pulls/OS-arch verification for selected ten pinned images; one network-disabled low-privilege Appwrite ARM64 shell execution. No service launch, data writes, Docker socket mounts inside pulled containers, production functions or Appwrite credentials.
- `docs/SELF_HOSTING_ARM64_RUNNER_PROOF.md` details interpretation, exclusions, upstream references and remaining OCI VM testing; docs index links it.
- No application version impact or backend deployment. Full Compose stack, Node18/22 runtime, memory headroom and SDK proof remain unverified.

## Verification
- Pending one focused task Quality Gate, native ARM runner experimental job, then stable Preview canonical and trusted delivery as applicable. Do not claim anything from unobserved Actions.
- Native container *startup* green is not proof that the full Appwrite backend, performance or recovery will run on Oracle A1.

## Next action
- Review exact independent ARM-runner workflow result. If failures, diagnose image metadata vs actual execution vs environment/network, without weakening security. Keep issue #975 open; after focused green promote only to isolated stable Preview for full CI; no dev/main promotion or real backend change without separate owner approval.
