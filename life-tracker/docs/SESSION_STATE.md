# Session checkpoint

Updated: 2026-10-22 Asia/Manila.
Current task: Recover the exact accepted v0.42.1 large-screen layout promotion on `dev` after a Vercel-only one-byte size failure.

## Accepted source and promotion
- Owner approved v0.42.1 Calendar, Todo and Diary resizable Day panels, mode switches and layout controls on dev; issue #404 intentionally remains OPEN for future Chats, Settings, Friend View, Explore, Alerts and reusable Bottom Sheet large-screen expansion.
- Preview `feature/404-todo-diary-panel-v042-20261022@85136936103e4315ae60d62a8e5f011333120ee3`, canonical #39712657340 SUCCESS (attempt 4) and trusted #39716565534 SUCCESS, Vercel READY `dpl_HUvUSRtC29a8woML1R8o7A86muWN`.
- Promotion PR #1220 merged to `dev@f75c332bfa68ae6fad0e7de4241bb3bd5cf867cb`; dev tree `e082bde29fd369b3853aca55bb271235d7a098c0` identical to accepted Preview; dev Quality Gate #39719002560 provenance/canonical PASS, first-parent prior dev correct. Main `c938c825370f8270b46f19119b06a1f74d35842b` unchanged.
- Vercel Git-first dev `dpl_5STwkmXiaFDdVeR4CiX62qQ7oUUV` ERROR despite passing CI: Home closure gzip 381001 B vs blocking 381000 B (1 B), Node 24.22.1. Accepted CI builds Node 22.23.3. Do not change build budget, relax gates or mutate Production/global Vercel project settings.

## Scoped repair
- Task `chatgpt/404-vercel-node22-20261022` and isolated stable Preview `fix/404-vercel-node22-20261022` both branch from accepted dev `f75c332b...`.
- Pin `life-tracker/package.json` and lockfile root `engines.node=22.x`, matching existing CI Node 22. Vercel docs confirm package engines overrides shared Project Settings 24.x without modifying the global project. No app behavior or semver change; stays 0.42.1.
- Verify task focused checks, squash into fix Preview, check full exact-source canonical including security audit, trusted Preview READY; then promote only the reviewed identical repair tree into dev under user's current approval, confirm dev CI and Vercel READY. If any gate fails, diagnose without bypassing.
- Scratch Appwrite already has 6 web platforms and cannot register a new immutable Preview hostname (403 plan quota). Authenticated manual device testing on the immutable Preview is unverified; backend is unchanged. Do not remove/replace platforms without explicit review.
- Issue #1221 created for **planning only**: first-category creation CTA directly in empty owner Day View, no code authorization; no category feature code should be written as part of this repair.
- Issue #404 stays OPEN. Do not promote to main/Production or release version 1.0.
