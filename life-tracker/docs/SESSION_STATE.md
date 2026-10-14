# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 trusted CI-first prebuilt writer — Vercel monorepo root-directory staging fix.

## Verified
- Protected main from owner-merged [PR #825](https://github.com/carlers/mosaic-life-tracker/pull/825): `ed9787b931c5e65fb8c53474151fd5d249f88fff`; exact [Quality Gate #38535006485](https://github.com/carlers/mosaic-life-tracker/actions/runs/38535006485) SUCCESS; Vercel Production `dpl_J6s5TRKKT3kbQAnM2EgTDuPMB1Sd` READY, app v0.17.4 unchanged. GitHub ruleset #24880070 ACTIVE, zero bypass actors; dev `f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- New canary [PR #826](https://github.com/carlers/mosaic-life-tracker/pull/826) focused #38535420477 SUCCESS, squash `fix/592-trusted-archive-20261014@003beb3acaf95fb68f717d04e293b95289600579`, [full canonical #38535580930](https://github.com/carlers/mosaic-life-tracker/actions/runs/38535580930) SUCCESS. Exact Vercel Git-provider deployment list: ZERO. Trusted Delivery [#38535815478](https://github.com/carlers/mosaic-life-tracker/actions/runs/38535815478) receiver SUCCESS, protected writer FAILED *before creation* with `The provided path “/tmp/.../life-tracker” does not exist`. CLI is now past earlier user GET 404 after eliminating --team/--scope; Vercel history for canary SHA still ZERO. No alias/Production/dev change. NEVER rerun old failed jobs.
- CLI upstream `packages/cli/src/commands/deploy/index.ts` validates the linked Vercel project's `rootDirectory=life-tracker` at `cwd/life-tracker` before upload. With local `.vercel/project.json` and no repo-level link, it reads prebuilt output from `cwd/.vercel/output`. This is *a staging-layout failure*, not a permission failure.

## Narrow main-based fix
- Create only empty `<trusted-temp-workspace>/life-tracker` after the verified CI artifact and local project.json are assembled; keep the sole static `.vercel/output` and app artifact bytes at temp root. Fail closed if the directory already exists or the trusted project/team/Preview target differs. Add filesystem regression asserting empty stub, no copy, original output unchanged, duplicate refusal.
- No app/version, build cap, routing, Vercel project settings, tokens, branch policies, aliases, Production/dev or source-execution change.

## Next
- Task focused → isolated main-based stable full canonical and Vercel READY → protected-main infrastructure PR. Requires **new** owner-approved temporary `Pull requests only` bypass for that PR, merge commit, immediate zero-bypass restore, exact main Quality Gate and Production READY. No new canary until main updates.
- Then ONE fresh CI-green canary and verify ZERO Git auto-deploy, exactly ONE verified `--prebuilt --target=preview` READY, Scratch/GIPHY/PostHog/static route+headers, dedupe and stale checks, safe rollback and generalization. #592 OPEN; manual/device checks unclaimed.
