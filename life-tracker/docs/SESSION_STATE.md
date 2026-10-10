# Session checkpoint

Updated: 2026-10-10
Task: issue #406 shared-task UX refinement; **approved implementation in progress** on a task branch from stable Preview \`feature/shared-tasks\` at \`a2ea2f92880fd56a511d83c448e45fb2d6c11211\`. Dev/main remain unapproved for this feature; Production unchanged.

## Source of truth / current baseline
- Issue #406 latest UX plan: https://github.com/carlers/mosaic-life-tracker/issues/406#issuecomment-6099329226
- Owner/participant base functionality is on Preview version 0.14.0, user confirmed initial invite → accept → completion flow on Scratch.
- Preview full canonical Actions run 38053286955 succeeded and exact SHA Vercel deployment dpl_HWi692uxjcjDwQWDpJ1KhfNsCWYG was READY.
- Scratch Function message-action \`6aa8057f002a4c306fdd\`, active rebuilt deployment \`6aca35aa368c0817cf93\` showed live:true; the original 0.14.0 authenticated advanced acceptance and strict CLI readiness remain incomplete.

## Current UX revision (proposed Preview 0.14.1)
- Persistent actionable task invitations in Alerts (not Explore), with pending badge; ordinary friend-completion Alerts retention/grouping/push remains unchanged.
- Accepted collaborator projections shown in recipient Month/Week Calendar and Todo indicators; Day View remains a separate virtual group; owner task never cloned.
- Owner canonical task subtitle includes active friend names or count and optional pending invite count; owner Calendar task blocks get shared glyph.
- Two account-synced display preferences. Recipient task management allows leaving, while private memo, images and category never leave owner storage.
- Refreshed remote projections on foreground/visibility returns with bounded request coalescing, no polling.

## Checks / next step
- Sandbox completed focused TypeScript, contracts, ESLint (only nonblocking prior lint warnings) and new pure unit test. Build initially exceeded the guarded limits by 2,732 B Home closure gzip, 4,500 B raw app assets, 731 B app-assets gzip and 4,581 B precache; documented narrow size allowances were made for the user-approved feature, not a blanket guard bypass. Rerun measured build and CI after this adjustment.
- Review diffs, tests and any discovered integration regressions. Commit task on \`chatgpt/**\`, request focused CI, squash to **stable Preview only after green**; run full canonical CI and exact SHA Vercel. Do not mark physical device/browser acceptance as completed without proof.
- If appwrite backend source/schema stays unchanged, don't redeploy Function gratuitously; verify Scratch compatibility before acceptance. No dev/main promotion without approval.
