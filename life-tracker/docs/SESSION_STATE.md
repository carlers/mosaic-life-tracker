# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1384 Me/Settings information architecture and search. Task branch: `chatgpt/1384-settings-information-architecture-v0440-20261027`.

## Objective and authorized scope
Owner approved implementation of #1384, including Account, Preferences categories, Notifications, Data & Sync, About Mosaic, local settings search and Me navigation. **Me must not change visually:** no new hover surfaces, borders, overlays, or cues; tapping existing avatar/name and counts opens Account or Explore. Legacy Coming Soon rows retired except Announcements. Preserve all existing settings storage/ownership and account erasure/clear-local confirmation flows. Frontend-only, new Preview candidate version 0.44.0, no dev/main/Production promotion permission.

## Working changes
- Based on dev `5cdd830dd904bd096bd1b84ae6688e47e9b1b864`. Shared settings route group and navigable subsections in `src/pages/SettingsPage.tsx`, categorized preferences preserving controlled row handlers in `src/pages/PreferencesPage.tsx`, local search registry/deep-link focus in `src/lib/settingsSearch.ts`, data-setting labels on rows.
- New protected Settings and Preferences category paths map to existing lazy module owners in `src/lib/protectedRoutes.ts` and `src/App.tsx`; profile Back parent updated.
- Me avatar/name and existing count blocks have semantic click handlers only; Explore target focuses existing friends section. No styled visual embellishments.
- Version files: package.json, package-lock.json, src/lib/appVersion.ts.

## Verification and next action
- This checkpoint is part of a proposed coherent task tree; **focused CI, typecheck, browser/device acceptance and Preview deployment are not yet proven**. Verify exact SHA and focused Quality Gate, repair any failures before stable-Preview merge; complete canonical/size and trusted Scratch Preview, then request separately approved dev promotion. Preserve #1386 prepared-route work and test screen swiping/back from Me, Settings, all Preferences categories and search, plus account destructive sheets on a disposable Scratch account.
- No backend/schema/user-data/cloud or protected branch changes in this task. Keep issue #1384 open until accepted.
