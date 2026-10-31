# Mosaic command interpretation benchmark — issue #1441

Research harness only: **no production imports, no changes to the app, task store, sync, PWA or user data**. Synthetic fixture, fixed reference date (`2026-10-31`, local calendar), synthetic owned categories. No microphone recordings, API keys, paid inference, or telemetry. The first task-command implementation is separate from this benchmark.

## Compare the same task

- `rules`: a **deliberately narrow Python grammar baseline**, not Chrono or Mosaic's final parser. Zero external dependencies or weights.
- `model2vec`: [Potion Base 2M](https://huggingface.co/minishlab/potion-base-2M) sentence embeddings. Compares a short positive/negative intent-prototype set, then the **same exact rule slot extractor**. Cannot extract missing task fields by itself.
- `minilm`: [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) sentence embeddings. The same intent prototypes, thresholds, and rule-based slot extraction as Potion.
- `smollm`: [SmolLM2-135M-Instruct](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct) text generation, explicit deterministic JSON prompt and application-level validation. Uses unquantized CPU PyTorch for this **research runner**, not the published ONNX Q4F16 browser artifact. Its measured weight footprint and speed cannot be substituted for quantized browser numbers.

**Outputs are not equivalent without qualification:** embeddings cannot create full structured tasks without additional extraction. Compare `exact_rate` (full validated action), `intent_accuracy` (intent gate only), `unsafe_create_count`, and `by_group` together; do not rank candidates solely by intent accuracy. Models are **not fine-tuned** on the corpus, so this evaluates out-of-box potential, not optimized final accuracy. Neither experiment grants a model access to Mosaic's domain hooks.

Run `python make_dataset.py` first to generate the fixed (uncommitted) JSONL fixture; its deterministic source is versioned. The 168 synthetic cases comprise 32 canonical, 32 rephrased, 32 natural, 24 Taglish, 24 ambiguous, 24 unsupported. A deterministic balanced sample of 48 selects **8 from each group** for expensive model comparisons. The reference categories and day are deliberately frozen. Slang, ambiguous titles, unsupported edits/deletes and relative-date boundaries are intentionally challenging. Some fixture labels have subjective ambiguity: review individual per-case errors before using scores to choose a product.

## Run

From `life-tracker/benchmarks/command-models`:

```bash
python3 make_dataset.py
python3 -m unittest -v test_benchmark
python3 benchmark.py --adapter rules --limit 0 --output results/rules-full.json
python3 benchmark.py --adapter rules --limit 48 --output results/rules-48.json
```

Optional hosted inference requires deliberate model downloads (no Mosaic runtime dependency):

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install 'model2vec>=0.5,<1'
python benchmark.py --adapter model2vec --limit 48 --allow-download --output results/model2vec-48.json
# In a separate environment for CPU MiniLM:
# python -m pip install --index-url https://download.pytorch.org/whl/cpu 'torch==2.6.0'
# python -m pip install 'sentence-transformers>=4,<6'
# python benchmark.py --adapter minilm --limit 48 --allow-download --output results/minilm-48.json
# SmolLM2: same CPU torch wheel + 'transformers>=4.49,<5'
# python benchmark.py --adapter smollm --limit 48 --allow-download --output results/smollm-48.json
```

Without `--allow-download`, model candidates run **offline only** and fail if uncached. Weights stay in an ignored per-adapter `.model-cache/` folder or explicitly specified `--cache-dir`. Use `--limit 0` to run the full corpus; use `--repeat 3` for warm-run variation. CPU-only memory is reported as Linux peak process RSS (includes Python runtime, not just model RAM). Download byte totals represent on-disk model cache, *not* complete Python package, ONNX browser bundle, or actual PWA traffic. Startup includes model load and network fetch if permitted. Per-case processing times exclude setup; first inference warmup is included in `p50/p95` distribution.

GitHub Actions: the isolated [issue-1441-command-model-benchmark.yml](../../../.github/workflows/issue-1441-command-model-benchmark.yml) workflow generates the fixed dataset and runs on the dedicated `chatgpt/1441-command-model-benchmark-20261031` task branch push. Matrix candidates use no repository secrets and upload JSON + `pip freeze` artifacts. Remote model downloads require GitHub runner reachability; a failed download is **not an accuracy result**. This workflow is purposefully not triggered by `dev`, `main` or stable Preview. No hosted model benchmark is considered verified until an actual completed run and artifacts are inspected.

## Pass/fail decision for choosing smallest candidate

Consider a candidate viable only after verifying **zero unintended creation** (the product also always requires human confirmation), acceptably low explicit abstention and field error on independently reviewed cases, and acceptable on-device Android PWA memory/storage/startup. Benchmark measurements from Actions on Linux CPU are preliminary only; validate actual browser implementations, quantized formats, privacy, cache eviction, cold installation, and speech latency before selecting a production library. **No model is required** if a strengthened grammar/Chrono-style parser meets these targets.

Change the fixture only by reviewing labels, regenerating with `python make_dataset.py`, and keeping each candidate on the same resulting version. These commands never call Mosaic's live Appwrite or RxDB paths.
