# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #956 Stage 3 keyboard navigation shortcuts, Preview v0.35.5 candidate.

## Authority, baseline and status
- User accepted v0.35.4 calendar keyboard month-snap fix and explicitly said "working, keep going." Latest stable Preview before task: `feature/dayview-keyboard-956-20261020@0f6dee895cc3a8408d268991960966c0b9f98938`, exact-SHA READY Vercel, canonical Quality Gate 39458942658 SUCCESS, trusted Preview Delivery 39459220325 SUCCESS.
- Current `dev@79e2d69855c880d654de2b6d46307112fba9c970`, `main@c938c825370f8270b46f19119b06a1f74d35842b` at task start. Work must not promote automatically. Working branch `chatgpt/956-keyboard-navigation-shortcuts-20261021`, based on exact stable Preview commit.
- v0.35.5 is a PATCH revision to accepted v0.35 keyboard feature (no unrelated release/main bump).

## Implemented scope
- Protected authenticated Mosaic shell owns E→Explore (/explore), A→Alerts (/notifications), C→Chat (/messages), M→Me (/account), using React Router and shared single-key guard. Disabled during unauthenticated/database startup, focused text input/contenteditable/combobox, IME/modifiers/repeats, open modal dialog/menu/listbox, inert/hidden content. No browser/system modifier hijacking.
- Home F focuses the selected person pill in friend carousel, without switching calendars. From focused pill, ArrowLeft/Right/Home/End move focus only; Enter/Space keep existing native button activation; selected person is single Tab stop. Home search and friend preferences/modal ownership preserved.
- Day View S focuses the active day or Backlog Select button, without toggling it. Handles normal sheet and inline/backlog Day View, but not while editing tasks, dragging/reordering, keyboard help, or nested locked action sheets; does not capture keys from outside its mounted scope.
- Explicitly preserve Shift+Enter for task actions and PageUp/PageDown for calendar periods; do not overload Shift+Enter for month/friend switching.
- No backend/schema or unrelated UI changes; add short help entry in Day View and DOM regression tests. User preference for disabling all shortcuts remains potential follow-up, not part of this revision.

## Verification and handoff
- Task branch contains source + shared guard, tests for route navigation guards, person focus/selection and S. Request [verify:focused] once coherent task commit is staged.
- After focused green, squash into stable keyboard Preview, run full canonical + browser-contract CI, trusted exact-SHA Vercel READY; user to test physical keyboard, screen reader and mobile/WebKit separately.
- No dev/main/Production promotion, no automatic closure #956; follow-on improvements such as globally discoverable help and optional shortcut preference can be a separate iteration if user wants.
