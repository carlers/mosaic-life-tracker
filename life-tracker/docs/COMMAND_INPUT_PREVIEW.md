# Natural-language command Preview (issue #1441)

**Candidate:** v0.52.0; based on current dev v0.50.3 with the validated standalone parser ported into a lazy Home sheet.

## Test manually

On the Home page, tap the **sparkle/wand icon beside Search** (not the Search icon). Enter a phrase such as:

- add go to school to errands for tomorrow
- Add learn to code to Projects next Friday
- Paki-add buy rice sa Errands bukas
- Add laundry to Home in backlog
- Add review math to School in 3 days

Tap **Review command**, check or edit title, category and date (or check **Put in Backlogs**), then tap **Create task**. Only final confirmation calls Mosaic's existing owner-local task creation hook. Backlogs tasks default to private; dated tasks preserve the existing default visibility and Add Tasks to Top preference. Dates are interpreted using the device's current local date, not the benchmark's fixed October 31, 2026 clock.

Unknown or incomplete instructions permit manual entry for *a single task*. Bulk/unsupported instructions such as Move all tasks from School to Backlogs cannot be executed or converted to creation. The sheet does not record voice, call a hosted AI model, modify categories, or run batch updates. This icon is a command launcher, not a microphone.

## Scope and verification

No RxDB/schema/Appwrite changes; no backend key or hosted API; no model weights. Chrono-node 2.10.3 loads with the command sheet rather than initial Home rendering. Existing Home search and swipe flows remain unchanged. The parser uses only the signed-in owner's current category names and verifies the category ID again at write time.

Unit regressions run 30-, 88- and 40-case synthetic fixture sets; these are **not** representative of real-user language accuracy. Tests cover review/confirmation, account switching, unsupported commands, dates, and category ownership.

**Manual checks remaining:** Android installed PWA input/date picker, physical Back gesture, offline typed creation and sync after reconnection, switching accounts with an open review, and verifying the created task appears under the intended date/category. No dev/main/Production promotion without explicit approval.
