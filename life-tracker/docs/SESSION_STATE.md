# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #953 — simplify customizable accents to a single palette color with component placement toggles.

## Authorization and sources
- Owner requested this redesign after v0.34.0 Preview: one account accent, per-component on/off, extend to actual UI text such as date headers, weekday headers, Settings text.
- Base: accepted stable Preview `feature/ui-custom-colors-953-20261020@5e03730a55aba82acd05992ba78013a6b07edf8b` (v0.34.0) and current `dev@27c4725e382c8f57b6302c382fc4ece7f30d05b2`.
- Task branch `chatgpt/953-single-accent-scope-20261020`; target same stable Preview for PATCH `v0.34.1`. Do not promote to dev/main without explicit approval.

## Implementation
- Remove per-component palette pickers; one existing App accent picker plus grouped placement switches.
- Enable/disable UI roles through existing per-role synced settings keys `uiColor:<role>` storing boolean. Legacy cache and rows with `default`/`app`/curated color values safely migrate at read time. No extra backend schema.
- Default enabled for formerly global-accent icons, labels and controls; other roles initially disabled. Explicit off restores original emerald classes rather than following the global accent.
- New text roles: Calendar month/date header, Day View date, weekday headers/day numbers, main Settings/Preferences headings, row labels/descriptions. Preserve semantic category/task, holiday defaults, destructive text, selected day text contrast.
- Continue CSS-scoped variables and existing color/contrast normalization; no per-cell React prop churn. Tests updated for one-accent semantics, legacy migration, account cache isolation, and switch behavior.

## Verification / next
- Publish one coherent task commit with [verify:focused], repair any failures, squash via PR to stable Preview, then canonical Quality Gate + exact READY Vercel with Scratch identity. Separate physical-device, auth origin and cross-device/manual testing outstanding.
- No backend, Production, dev/main or release 1.0 authorization.
