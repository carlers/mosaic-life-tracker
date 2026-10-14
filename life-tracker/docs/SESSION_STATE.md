# Session checkpoint

Updated: 2026-10-14
Current task: #592 CI-first stable Preview delivery.

## Verified baseline
- Protected `dev@f3d9558f` (v0.23.4) and `main@f930e304` (v0.17.4) unchanged; main bypasses empty.
- Stable `fix/592-trusted-archive-20261014@381226d0`: full Quality Gate #38501026168 SUCCESS and exact Vercel Preview dpl_9pp5t7Yc4qUzhttsViMpejRwra7p READY.
- Public Preview Scratch, GIPHY and PostHog matched Vercel values. GitHub Secrets migration PR #799 is merged and CI verified all three public browser values are masked in job logs. No Vercel write tokens are passed to untrusted CI.
- One CI app build; SHA-verified bounded 161-file PWA archive, official v3 deep links/headers and static-file smoke; no extra provider deployment.

## Active task
- Pure read-only trusted receiver gate checks trusted main checkout, exact accepted push Quality Gate, same-suite canonical acceptance, current stable branch SHA, run attempt and bounded nonexpired artifact.
- Non-secret artifact manifest tracks Scratch/Preview, Node24, GIPHY/PostHog presence and the two #784 hard limits. It cannot authorize a deploy by itself.
- Keep all main/provider configuration and write operations OFF.

## Next action
- Focused task verification; squash to stable; confirm canonical+READY.
- Build verified trusted ZIP download/byte assembly + protected main receiver; controlled red=0, green=1, retry/stale=0 deployment tests and rollback. Main-only bootstrap requires separate approval. #592 stays OPEN.
