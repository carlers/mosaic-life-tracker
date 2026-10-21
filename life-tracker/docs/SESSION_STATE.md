# Session checkpoint

Updated: 2026-10-21 UTC
Current task: integrate keyboard navigation and shortcut preferences (issue #956) into current dev, with Home shortcut changed to plain H.

## Authority and baseline
- User approved: "make home page just h not shift h then merge to dev." Plain H now returns Home from other protected pages; on Home, Shift+H opens the hamburger. Previously published keyboard Preview v0.35.6 is READY: `feature/dayview-keyboard-956-20261020@5b2965083bb97cb12afbd83d1994e6c2fdf4c5e8`, canonical CI 39534317656 SUCCESS, trusted delivery 39534534824 SUCCESS.
- At integration start dev had advanced to `65a68821865e16d4b580fde0afce282cb2eebc51` (v0.38.0, Uncompleted Tasks + Timeline/cross-day drag + standardized dropdowns), diverging from v0.35.6 keyboard Preview. Main at earlier check `c938c825370f8270b46f19119b06a1f74d35842b`. Direct merge is not safe: version regression and conflicting Day View changes. No main/Production approval.
- Integration task branch `chatgpt/956-keyboard-dev-integrated-20261021` and stable integrated Preview `feature/keyboard-dev-integrated-956-20261021` both start from exact dev 65a6882. New user-facing feature relative to dev v0.38.0 => Preview v0.39.0 (new MINOR, retains accepted keyboard behavior).

## Scope and merge strategy
- Layer all nine previously accepted keyboard commits / 49 changed paths onto latest dev with granular source patch integration. Preserve existing dev Timeline sorting, Day View selection layout, cross-day task drag, Uncompleted Tasks and account shortcuts, standard MosaicSelect dropdowns, sync isolation and page behavior.
- H route shortcut is unmodified `h`; `Shift+H` opens Home hamburger (never ambiguously navigates). Keyboard shortcut guide and targeted route/Home tests reflect these bindings. Keep existing Home S (Sync Status, manual trigger inside), Me S (Settings), Day View S (Select), F friends, G calendar, T/D/V views, B Backlogs, / search, E/A/C/M routes and original task keyboard behavior.
- Account-synced default-on `keyboardShortcutsEnabled` controls single-key accelerators including ?/N while preserving normal keyboard accessibility. Shared provider scoped to authenticated app; no new backend/schema changes.
- Day View integration uses latest dev as base and applies all feature-specific keyboard hunks except conflicting import/toolbar blocks, which are adapted into latest Timeline toolbar with a keyboard-help button and panel. Restore source-generated component inventory with new shortcut components. Update version in package.json, lockfile and src/lib/appVersion.ts.

## Verification and next action
- Commit all integration changes plus this checkpoint to task branch with `[verify:focused]` and validate. Fix focused failures without weakening checks.
- After focused SUCCESS squash PR into stable `feature/keyboard-dev-integrated-956-20261021`, confirm full canonical CI and trusted exact-SHA READY Preview, then create stable Preview → dev promotion PR. Confirm latest dev SHA and automatic exact-tree promotion eligibility; if dev advances, recompute integrated Preview, revalidate rather than merge with conflicts/version regression.
- User explicitly authorized dev only; never merge to main/Production. Manual device/AT theme acceptance remains unperformed. Issue #956 stays open.
