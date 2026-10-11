# Session checkpoint

Updated: 2026-10-11
Current task: finish v0.17.2 Backlogs promotion cleanup. User approved promotion to dev, **not main**.

## Verified
- Settings forward swipe PR #580 merged to dev (v0.17.0) and survived the Backlogs merge; device gesture acceptance is pending.
- Backlogs issue #407: private date-free category Day View at `/backlog`, Home/Me navigation, calendar ↔ Backlogs moves preserving task ID, task search and no sharing/Alerts for unscheduled tasks. Original PR #581 is obsolete/conflicted.
- Replacement Backlogs stable Preview `feature/backlog-dev-407` SHA `a4a3d292`: focused CI 38119798653 SUCCESS; full canonical CI 38119851398 SUCCESS; Vercel Preview READY.
- Promotion PR #588 merged Backlogs to dev `383b2fa553b16209357ea035614ffeb20aed3f8f`; exact dev and accepted Preview trees match. Dev promotion CI 38120002742 SUCCESS.
- Dev Vercel deployment `dpl_2T6Ms2Rp9jREyoHjxqv96HT9DS6W` failed only size caps. All TypeScript, Vite and PWA steps passed, and Preview/backend target stayed Scratch.
- Measured dev Vercel: entry raw 443770; gzip 132026; initial gzip 144984; Home gzip 362523; assets raw 2406651; assets gzip 744003; precache 2491866 bytes. Retain all entry/initial/Home limits. Narrow aggregate caps: raw 2407000; gzip 744350; precache 2492250 (349/347/384 B headroom).
- Budget-only task PR #589 focused CI 38120135059 SUCCESS, squash merged to stable `fix/backlog-dev-vercel-budget-407` SHA `e8a313a`. Vercel Preview READY; build and DOM jobs passed. Full CI 38120188624 found only an oversized handoff packet: 3221 estimated tokens vs maximum 3000 in `documentationContracts.test.ts`. This checkpoint is condensed to repair it. No runtime or version change.

## Remaining
- Require focused CI for this checkpoint-only repair, squash into the same stable fix Preview, then require its new full canonical CI and exact-SHA Vercel READY.
- Promote the accepted fix Preview to dev, validate exact merged tree, dev CI and Vercel READY. Then close superseded PR #581 (do not merge its stale code). Keep issue #407 open until main release.
- Scratch Appwrite `message-action` live Function currently has a ready newer deployment **not verified as active or matching the combined code**; do not claim backend parity. Authenticated multi-device, direct-route and iOS/Android gestures remain manual/unverified. Production/main untouched.

## Next action
Finish the checkpoint repair via focused task → stable Preview canonical/Vercel → approved dev promotion. Inspect any failure before promoting; close PR #581 only after dev deployment is READY.
