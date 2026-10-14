# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 — stage the live-proven six-member CI-first static artifact producer for normal development, without dev promotion.

## Verified live and rollback boundary
- Owner-merged infrastructure-only main PR #844 at `a7d4c431eef6902f1d2d35271b6b8e41f8e9228e`; full main Quality Gate #38569807748 SUCCESS; Production Vercel `dpl_CNVEygWZfQzHc45vzTopdNrx3CPL` READY, app v0.17.4, zero main ruleset bypass actors.
- Existing `dev@f3d9558feca499e53c310c5a37be2794717bccf6` unchanged. Third stable ordinary feature `feature/592-generic-optin-trial-20261014@25d6d0a5a7686886043cd1a995701b5f4ff42c32` succeeded full exact-SHA Quality Gate #38570924020, main-delivered static CLI Preview `dpl_5ZhkmKjZiLSLFHUNmUQMUQcSVQcz` READY with zero Git Previews and aliases; same-SHA retry #38574363518 reused without POST.
- Owner disabled generic rollout; Quality Gate #38570924020 attempt 4 SUCCESS and default-main trusted delivery #38575847861 skipped BOTH read-only receiver and protected writer. Provider retained original READY Preview, no additional deployment. Official issue checkpoint: https://github.com/carlers/mosaic-life-tracker/issues/592#issuecomment-6170060463.

## This task's exact source scope
- Prepare normal dev-base pipeline parity from the previously accepted second feature pilot's six-member static archive producer and its regression tests, preview route/public-profile scripts and pinned `@vercel/routing-utils` dependency.
- Copy previously accepted Quality Gate definition with reviewed Git blob `5f64f715551f0c311a60d823367d849dfb369bba`, preserving canonical build/DOM/browser gates.
- Preserve exact original dev `life-tracker/vercel.json`, no branch opt-out, Vercel project/routing/provider setting modification, app runtime/feature/version/backend or budgets. Restore normal dev `workflowDocs.test.ts` branch policy test; retain isolated notification fixture-clock regression fix.
- Quiet task `chatgpt/592-dev-ci-producer-20261014`: full check with `[verify:full]` permitted to exercise canonical CI without any Vercel Git Preview or Trusted main delivery; **do not merge this task directly into dev**. Stage a separate reviewed stable Preview source and require explicit user approval before ANY dev promotion.
- Rollout flag remains OFF. Do not change Vercel, GitHub repository variables, provider secrets, main/dev, device registration, production release or aliases.

## Quiet full gate diagnostic and repair
- Initial unprivileged full task gate #38576545287: checks, dependency audit, both DOM/browser shards succeeded, but six-member build-artifact evidence rejected `chatgpt/**` as an untrusted source after Vite/PWA/size budgets already passed. Canonical failed, provider deployments zero.
- Add narrow candidate-side read-only diagnostic branch source handling only for `deploymentAuthorized:false` evidence. Main's separately protected receiver still rejects quiet task branches before provider use; source-branch opt-in and six-file Quality Gate workflow SHA remain pinned. Add negative spoofing and invalid-branch tests. No modification to workflow, provider, app or main trust policy.

## Quiet task accepted and rollout staging
- Quiet task `chatgpt/592-dev-ci-producer-20261014@4d9c3c80bacb833f10b21686202ceaca6b5e51f8`: full [Quality Gate #38577395653](https://github.com/carlers/mosaic-life-tracker/actions/runs/38577395653) SUCCESS including producer archive, routing/static verification, dependency, both DOM/browser shards and canonical. No provider deployment. Prior #38576545287 red only on quiet diagnostic source-identity guard; narrowly repaired without changing reviewed CI workflow blob.
- Prepare `fix/592-dev-ci-producer-rollout-20261014` as the single dev-parented stable staging candidate. It intentionally restores unmodified dev Git-auto `vercel.json`; while generic rollout is intentionally OFF, **one** ordinary Git Preview may be created before canonical completion. This is transitional verification only. Do not change the provider project, repository variable, source rules, aliases, main/dev or Production. Confirm exact stable full canonical and Vercel Preview READY before any PR to dev.
- This is infrastructure/test tooling only, app runtime and v0.17.4 unchanged. The accepted six-member source producer plus non-deployable quiet source diagnostics are included; protected main does NOT start accepting quiet branches.

## Next action
- Validate stable full exact-SHA canonical plus the one expected Git Preview READY and hosted route/header evidence; investigate any provider/quota failures. Review promotion preflight from accepted stable source, then obtain explicit owner instruction before creating/merging stable Preview→`dev`. No main release, backend writes, provider aliases, rollout switch restore, or production changes. Issue #592 OPEN; authenticated Scratch/phone acceptance still separate.
