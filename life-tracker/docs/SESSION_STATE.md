# Session checkpoint — issue #408 drag polish

Updated: 2026-10-13.
Current task: correct bottom-up task ghost and diary finger tracking without regressing accepted release settling. Base stable Preview `feature/diary-408` at `4b7959e974af0a86df5d1cd3ab42811565cbd30b`; isolated task branch `chatgpt/408-drag-feedback-polish-20261013`.
Next action: verify focused browser and build checks; fix actual failures; squash focused-green branch into Preview only; verify canonical acceptance, Scratch build, all seven size budgets and stable alias. Do not merge dev/main or close #408 before manual acceptance.

## User-reported v0.25.3 defects

1. Long-pressing a task at the bottom and moving it upward leaves an apparently duplicated / ghost task over the next category pill during drag.
2. Diary takes an initial jump and then stays still while insertion targets react beneath moving finger instead of the **card** visibly tracking finger.
3. The prior source release settling/snap animation now works well; preserve it.

## v0.25.4 approach (2026-10-13)

- Use one dnd-kit-owned `DragOverlay` for task and diary, with native `Feedback.configure({feedback: 'none', dropAnimation:null})` for those two registered source geometry proxies. This prevents a second native drag element or placeholder from painting.
- Diary source is an inert, invisible geometry proxy under the actual Day View card; the overlay renders the exact existing `DiaryDayCard` with the current entry/compact-expanded snapshot. Only the overlay tracks the touch, fully above scroll containers. Keep the original card mounted but visually hidden and out of flow, with one exact-size insertion gap. Refreshed release key avoids old-location Motion FLIP.
- Clip the hidden task source shell, keep task overlay and accepted release-remount mechanism untouched; maintain sibling transitions, optimistic persistence, target stabilization, touch hold threshold, scroll/swipe ownership and cancel semantics.
- Add browser regression for bottom-to-top task drag to assert one feedback instance/no painted source, and a real DaySlide diary fixture that verifies finger tracking on both axes, one projected gap, and restored visibility after cancellation. Browser fixture opts into an explicit preloaded diary document rather than touching backend/local user data.
- Candidate version PATCH v0.25.4; no schema/Function or dependency changes. Keep hosted size guard strict; any measured Vercel variance requires documented review, no blanket budget widening.

## Verification

Pending: focused browser checks, full canonical stable gate, Vercel Scratch READY exact SHA/all seven hosted budgets, actual phone/desktop visual acceptance. Prior v0.25.3 accepted as baseline at `4b7959e`; `dev` and `main` must remain unchanged.
