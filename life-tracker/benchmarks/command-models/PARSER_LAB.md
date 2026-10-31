# Command parser follow-up — grammar versus optional Chrono (#1441)

Isolated research only. Does not modify Mosaic production dependencies, startup or PWA precache. The original Python rule baseline and frozen 168-command synthetic fixture are unchanged. The new JavaScript grammar recognizes English/Taglish command prefixes, exact category slots and conservative dates. Optional Chrono 2.10.3 parses tightly anchored month/day and days-from-now phrases; it does not extract titles or categories.

Run from this directory on Node 22 and Python 3.11:

    python3 make_dataset.py
    node --test parser-lab.test.mjs
    python3 benchmark.py --adapter rules --limit 0 --output results/original-rules-168.json
    node parser-lab.mjs --output results/grammar-168.json
    node parser-lab.mjs --input parser-lab-holdout.jsonl --output results/grammar-holdout.json
    npm install --no-save --no-package-lock --ignore-scripts chrono-node@2.10.3
    node parser-lab.mjs --chrono --output results/chrono-168.json
    node parser-lab.mjs --chrono --input parser-lab-holdout.jsonl --output results/chrono-holdout.json

Separate 30-case challenge data covers dates and phrasings not included in the frozen 168. The revised grammar was tuned on the known 168, so a high score there is **not generalization evidence**. The initial holdout score was 16/30 exact with one unsafe create. Zero unsafe on the known corpus is not a safety proof; ambiguous legitimate titles can be rejected conservatively. Actual user categories, multiword/duplicate categories, Android PWA/Whisper and real task-creation flows remain untested. This experiment is not a user-visible app feature or production readiness certificate.


## Additional regression corpus — 88 independent prompts (2026-11-01)

The separate parser-lab-regression.jsonl contains 88 new synthetic commands:
28 preposition/category-word task titles, 14 date phrases, 26 ambiguous/quantity-based
requests, and 20 bulk or read-only intents not yet supported by the single-task engine.
It is not mixed into the original 168-case training/tuning fixture or earlier 30-case
holdout. The experiment scores exact label/title/category/date agreement and counts
all proposed wrong task creations as unsafe_create. Category names are case-insensitive;
Backlogs means unscheduled tasks, not an ordinary target category. Test clock is fixed at
2026-10-31 local midday so dates can be compared deterministically.

Run from this folder:

    node --test parser-lab-regression.test.mjs
    node parser-lab.mjs --input parser-lab-regression.jsonl --output results/regression-grammar.json
    node parser-lab.mjs --chrono --input parser-lab-regression.jsonl --output results/regression-chrono.json

**Measured in Vercel Sandbox Node v24:** baseline grammar 50/88 exact, 6 wrong actionable
interpretations; grammar+Chrono 57/88 exact, same six. Date interpretations rose
from 7/14 to 14/14, while preposition-bearing title cases remained 7/28 correct.
The six unsafe cases are synthetic quantity/batch requests starting with Add/Create.
This is a diagnostic research benchmark, not a shipping acceptance test; do not adjust
expected answers to make the score pass. Model and inference research remain isolated
from app dependencies, and actual user/device performance was not measured.


## Conservative title + bulk-intent hardening (2026-11-01)

This is **research only**, with zero changes to the Mosaic PWA, browser bundle,
RxDB or backend. The grammar keeps prepositions and category words inside
titles, selects a final complete category clause, tolerates the anchored
connector "for tomorrow", and classifies explicit global edit/query commands
as unsupported rather than treating them as a task. Counts such as "15 tasks"
are instead sent for review. Bare media conversion phrases such as "text to
speech" remain review-only. No command is executed by this parser.

The benchmark now also accepts a **caller-supplied category-name array**
for tests of multiword names, case-insensitivity, duplicate names and
regex metacharacters. This is not proof of ownership-aware category
resolution in the production app: a real command handler must obtain
the current user's live category IDs and reject duplicate display names.

The original 168-case corpus, the 30-case holdout and 88-case regression
fixture are **unchanged**. A new 40-case author-generated synthetic challenge
was created separately and evaluated after the initial hardening logic
was written (20 creates, 12 review, 8 unsupported). It must not be
described as independently human-sourced or as real-world accuracy evidence.

**Measured in isolated Vercel Sandbox, Node v24 with Chrono 2.10.3:**
168/168 original, 30/30 historical holdout, 88/88 regression and
40/40 new challenge exact; 0 incorrect actionable creates in all four sets.
The first three sets had already influenced parser improvements, and the
new set is still synthetic with familiar command grammar; **100% does not
establish generalization**. Without Chrono: 168/168, 23/30 and 81/88 exact,
all with zero incorrect actionable creates. Chrono remains a benchmark-only
dependency. Real speech transcription, incomplete account synchronization,
arbitrary multiword owner categories, actual Android memory/startup, and
cross-user privacy were not verified here.

To reproduce, from this folder (install Chrono only in the isolated
benchmark directory):

    python3 make_dataset.py
    npm install --no-save --no-package-lock --ignore-scripts chrono-node@2.10.3
    node --test parser-lab.test.mjs parser-lab-regression.test.mjs parser-lab-hardening.test.mjs
    node parser-lab.mjs --chrono --input parser-lab-fresh-challenge.jsonl --output results/fresh-hardening.json

**Shipping gate remains closed**: the parser is not integrated into the app,
no writes are triggered, and truly unseen human-authored commands plus target
device testing are still required. Bulk task manipulation remains a separate
review/confirmation/undo milestone, not an executable grammar action.
