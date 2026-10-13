# Session checkpoint

Updated: 2026-10-14
Current task: #592 CI-before-provider-deploy acceptance artifact pipeline.

## Verified

- #784 guarded-size policy is accepted on protected dev
  eaab6d9e175f3dac4cc5cf581ea6e5ec70706925:
  full stable Quality Gate #38429241292 SUCCESS; dev promotion
  #38429928093 canonical SUCCESS; exact dev Vercel READY.
  Two initial/Home hard ceilings (154500/381000 B), all seven
  measured, PWA correctness remains mandatory.
- #592 default-main receiver is still reuse-only shadow.
  Security PR #783 was squash merged into stable
  fix/trusted-preview-uid-592-20261013@dfd9b9a3b6bf0aa2a7b702ad75763782032a6508,
  full canonical #38431094731 SUCCESS, Vercel
  dpl_AwvwiV34UR4NNCYv2aMwdaY7CAMB READY.
  Dependent main PR #781 remains DRAFT: protected main preflight
  correctly blocks direct non-dev source absent an explicit new
  owner-reviewed infrastructure exception.
- Main remains 0e39e7315e18e6750843780432dd42d22f940367
  and app v0.17.4; do not ship dev features as infrastructure.

## Current task-branch implementation

From dev, chatgpt/592-prebuilt-evidence-20261014 adds
non-deployable byte-level evidence from the existing successful
CI build job: exact SHA/ref, seven metrics, per-file SHA-256,
JS/CSS fingerprint and tarball, short Actions retention.
No second build, provider POST, credential use or aliases.
Separate immutable-test verification rejects source/path/profile
tampering. This slice is NOT deployable until exact Scratch/GIPHY
effective profile and Vercel Build Output/rewrites parity are proven.
The default-main trusted receiver must verify full canonical
acceptance separately; a green build subjob is not authorization.

## Next action

Finish focused tests and quality-gate verification of artifact
capture, then deliver stable Preview under standard workflow
and inspect attached artifact manifest/readback. Do not blindly
deploy the artifact or alter Vercel Git automatic deployments.
Progress separate default-main artifact receiver and quota-safe
negative CI canary after protected owner authorization. #592
remains OPEN; #784 remains open pending default-main scheduled
audit activation, perhaps bundled with a separately approved
main-only infrastructure commit.
