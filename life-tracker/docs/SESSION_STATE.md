# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #914 Scratch wildcard Preview-origin guidance correction (docs-only), branch chatgpt/914-scratch-wildcard-20261016.

## Verified project status
- Protected dev `f9e01b6fc8f8913b75a9738fc978c0ed55427d98` = v0.29.1; Production main `b952f71ecd2add3172f90104bc0e856a2648ccc9` = published v0.29.1; no 1.0.0 authorization.
- #855 v0.29.2 far-date Day View fix accepted by owner ("date jumps are working"), stable `fix/855-day-view-window-20261016@10feb70b8d942593fbbd11b2ed5d6120cab35500`, canonical #38915794320 SUCCESS. Not yet protected-promoted.
- #745 v0.29.3 permanent chat-denial frontend repair stable `fix/745-send-denial-20261016@62a5d63470e46b5f44941953bfaf211aa724ccd0`: focused #38922273068 SUCCESS, canonical #38922596566 SUCCESS, trusted prebuilt #38922923635 SUCCESS, Vercel READY `dpl_3WkR2bxjnhrPkTwsY2vGXX5r6gvs`. Its assigned alias is `mosaic-life-tracker-fix745-carls-projects-72516fde.vercel.app`. It is not manually accepted or promoted.
- Owner resumed Scratch `6a96e82d000d1310b3be`, fra. Connected Appwrite read-back: project active, 17 enabled tables, Messages 25/Diary 9 AVAILABLE columns with rowSecurity, bucket fileSecurity, active READY `message-action@6ad04931c34b463de0b4`, email/password + magic-url ON and other checked auth methods OFF. No Appwrite migrations, platform deletions, or Function activation undertaken.
- Scratch has intentional Web platform wildcard `*.vercel.app`; owner confirms it covers all Mosaic one-label Vercel Preview hosts. #745's exact Preview alias matches this wildcard. A failed attempt to add a redundant seventh exact-host registration encountered plan quota; **there is no actual platform-slot blocker**. Docs were outdated about requiring exact registration. Production must not receive the wildcard.
- #745 actual two-account denial→Retry, offline/account-switch acceptance and #914 Phase B old/new PWA live compatibility rehearsal are NOT RUN. A configured wildcard does not substitute for real browser authentication/sync or service-worker evidence.

## Current change
- Documentation-only: update Scratch and backend Preview runbooks to accept either exact hosts or matching existing wildcard, explicitly restrict wildcard policy to disposable Scratch and retain live browser CORS/login verification. No runtime, version, backend or UI changes.

## Next actions
- [verify:focused] task docs check → squash into isolated `security/914-scratch-wildcard-20261016` Preview → full canonical quality gate. No protected promotion without review/approval.
- User or authorized real browser harness must perform synthetic two-account #745 test; #914 Phase B needs genuine old/new offline PWA and schema/Function rehearsal on isolated disposable backend before 1.0 readiness.
