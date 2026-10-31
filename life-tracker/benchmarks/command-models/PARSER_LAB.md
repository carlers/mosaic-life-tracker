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
