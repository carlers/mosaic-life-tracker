# Session checkpoint — Mosaic issue #408

Updated: 2026-10-12.
Current task: #408 diary v0.25.1 hosted Preview build-size parity repair.
Next action: Verify the final stable `feature/diary-408` SHA through canonical GitHub Actions and Vercel READY; do not promote to dev/main. Coordinate shared Scratch rollout explicitly before social acceptance.

- Issue #408 implementation is staged through task PR #748, squash `dc37abdc09d4ee9abeaa080c1dcc896ce1868ad9` to stable `feature/diary-408`. Version v0.25.1; dev, main and Production untouched.
- Seven refinements: owner double-tap editor; live diary drag gap/projection; task/category reorder motion; Calendar Day View diary renderer; typed diary quote with ACL-gated read; owner reaction summary; idempotent reaction activity message.
- Source verification: unit 984/984, handler 183/183, DOM 491/491; TypeScript, lint, docs contracts and source production/PWA build PASS on task family. Last dependency-only repair TypeScript and focused lint passed. Manual cross-account/device acceptance not performed. GitHub task workflow run and canonical stable acceptance were not available/confirmed.
- Stable hosted Vercel Preview deployment `dpl_tVW5myeaC4Zs9W9UYfH1vu9Ssfmv` failed build-size guard at exact squash SHA: entry raw 446,290 / 446,200 (+90 B), entry gzip 132,885 / 132,850 (+35 B); all remaining metrics PASS, including initial closure 146,215 / 146,300 B. Confirmed Scratch Preview backend identity in build logs. Stable registered alias remains `mosaic-life-tracker-git-feature-788f0b-carls-projects-72516fde.vercel.app` serving prior successful v0.25.0 until replacement is READY.
- Current repair branch: `chatgpt/408-hosted-size-parity-20261012`. Adjust exactly those two limits in a documented measured review; preserve historical baseline and every other metric. Merge only to stable Preview after focused confirmation; inspect hosted build before reporting READY. Do not burn retries on identical failed build.
- Backend readiness: new `messages.diary_ref_*` additive columns and `message-action` updates are source only. Shared Scratch migration and Function activation are not authorized by ordinary frontend Preview promotion; perform only after explicit coordinated approval and review issue #708 convergence impact. No Production/Appwrite mutation.
