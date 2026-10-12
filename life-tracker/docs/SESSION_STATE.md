# Session checkpoint

Updated: 2026-10-13
Current task: #592 trusted default-branch Preview receiver (disabled/staged).

## Verified baseline

Stable `fix/workflow-build-parity-592-20261012@26dfa9c7d978ff7bbc7ac861625e4d69c0fca861`.
Full canonical [Quality Gate #38316959947](https://github.com/carlers/mosaic-life-tracker/actions/runs/38316959947)
SUCCESS (checks/build/audit/both DOM and browser shards); ordinary
Git-triggered Vercel `dpl_974AP6Vu9TUqUMQB3wVEgTCJbxkJ` READY
with unchanged stable branch alias. Protected prebuilt manual
canary `38290165183` attempt 2 SUCCESS; CLI deployment
`dpl_9CgjZjmxMCqSqZxEkSpVspxKbB3d` READY.
No dev/main merge, Production/Appwrite or seven-budget changes.

## Active implementation

`chatgpt/592-trusted-workflow-stage-20261013`:
- Add `.github/workflows/trusted-preview-delivery.yml`
  listening to `workflow_run` for Quality Gate COMPLETED;
  GitHub executes it only when the file exists on default
  branch `main`. Staged on #592 stable Preview ONLY, not active.
- Hard-disable the earlier `preview_auto_pilot` in the editable
  Quality Gate with explicit `false &&`, independent of toggles.
  Source code/build scripts in that job can otherwise access
  unattended Vercel tokens.
- Trusted default-branch Node script checks latest exact-SHA
  canonical success, source branch HEAD, official repository,
  GitHub suite, linked Vercel project root/repo/production branch.
  Uses server-side Git-source API with exact SHA, not a local
  NPM/Vite build or checkout of untrusted candidate code.
  Bounded provider duplicate scan, READY/Preview identity
  proof, shadow first. Alias requires a separate switch and
  verified readback. All flags OFF.
- Pure security/negative regressions and runbook docs included.
  Remote hosted API path is **unproven**, do not claim delivery
  parity/alias acceptance yet.

## Next action

Run task focused CI and correct failures. Squash task to existing
#592 stable Preview only, full canonical and Git-triggered
Vercel READY. Do NOT merge to dev/main or enable new/reviewer-free
secrets or flags. Before activation, owner-approved default-branch
promotion, security review, privileged environment permission,
a controlled shadow hosted-Git API pilot, CI-red/stale-SHA checks,
and alias readback are required. The new approach uses Vercel's
normal hosted build, avoiding independent GitHub-local Vite
fingerprint mismatch. Vercel API target/project-binding behavior
is deliberately fail closed until tested. Keep #592 OPEN for
activation, size audits/policy and five-promotion pilot.
