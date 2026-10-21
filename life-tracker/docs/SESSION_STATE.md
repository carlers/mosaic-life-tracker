# Session checkpoint

Updated: 2026-10-21 UTC
Current scope: issue #956 — keyboard shortcut guide, preference and scoped Home actions; v0.35.6 Preview candidate.

## Authority and baseline
- User accepted keyboard navigation v0.35.5 and approved further shortcut expansion: H/Shift+H, /, S by page, T/D views, shortcut guide, setting in Preferences. Add V Calendar and B Backlogs as complementary Home actions.
- Stable Preview branch `feature/dayview-keyboard-956-20261020@dffe87f6466179fa7193cd35626c01281ad2c6d7`, v0.35.5, full canonical 39461332092 SUCCESS, trusted delivery 39461691694 SUCCESS with exact-SHA Vercel READY.
- At task start dev `7b7c3a2f6944e5a855a81a9c81f14382a064307c`; main `c938c825370f8270b46f19119b06a1f74d35842b`. Task branch `chatgpt/956-shortcut-guide-preference-20261021` from stable Preview; no dev/main authorization.
- Continued accepted keyboard feature, so PATCH v0.35.6 rather than new minor version; no database/schema changes.

## Implemented
- `Shift+H` from any primary/detail page returns Home; plain `H` on Home opens existing hamburger menu. Avoid conflict through shift guard. `S` on Home opens existing Sync Status sheet (not auto manual-sync), while `S` on Me activates Settings and `S` inside Day View focuses Select (previous behavior). `/` retained for Home task search; `F` existing friend focus, `G` grid focus; `B` opens Home Backlogs. `T` Todo, `D` Diary, `V` Calendar through same asynchronous ViewSwitcher action on selected owner/friend pane.
- Single-key preference `keyboardShortcutsEnabled` in Preferences → Navigation, default true, account-synced via existing settings hook. Context gate encompasses new and existing single-character accelerators including E/A/C/M, F, S, H, B, T/D/V, /, G, N, and ?; ordinary arrows, Tab, Enter and Space continue to work when off.
- Shared provider inside authenticated AppDataShell houses router shortcuts and global `?` keyboard guide, opens lazily, with a Preferences row to open the guide even when accelerators are disabled. Guide grouped by Anywhere/Home/Day View/Me. Day View's original ? and N guard honors setting while its existing help button stays accessible.
- Continue respecting editors, IME, modifiers, repeats, modal/menu/hidden/inert surfaces, and active person ownership. Keep Shift+Enter task actions and PageUp/PageDown calendar periods. No new settings schema or backend side effect.

## Verification / handoff
- Task scope includes React components/hooks, generated COMPONENT_INDEX for guide sheet, focused DOM tests for routing Shift+H, active views, preference and guide.
- First focused run 39533818696 failed only the React Fast Refresh lint rule: provider file exported both its component and hook/context. Moved context/hook into a separate non-component module and adjusted consumers, retaining the provider's single component export. Reverify focused before Preview squash.
- Submit a coherent [verify:focused] task repair commit. Fix failures on task branch; after focused SUCCESS squash to stable Preview; perform one canonical full gate and trusted exact-SHA Vercel READY. User device/visual/AT acceptance remains manual and unperformed.
- Keep issue #956 open; never promote to dev, main, or Production without user approval.
