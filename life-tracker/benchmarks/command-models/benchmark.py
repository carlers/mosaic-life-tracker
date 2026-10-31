#!/usr/bin/env python3
"""Standalone, privacy-safe Mosaic command benchmark. No application imports or writes."""
from __future__ import annotations

import argparse
import json
import math
import os
import platform
import random
import re
import resource
import statistics
import sys
import time
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
AS_OF = date(2026, 10, 31)
CATEGORIES = ("School", "Personal", "Work", "Health", "Home", "Errands", "College", "Projects")
MODEL_IDS = {
    "model2vec": "minishlab/potion-base-2M",
    "minilm": "sentence-transformers/all-MiniLM-L6-v2",
    "smollm": "HuggingFaceTB/SmolLM2-135M-Instruct",
}
# Embedding models are NOT slot extractors. They only gate intent; identical rules
# still extract fields, allowing honest end-to-end comparisons.
CREATE_EXAMPLES = (
    "Add a task to my list tomorrow", "Create a reminder to do homework",
    "Put an errand on my todo list", "I need to finish an assignment tomorrow",
    "Please make a new task", "Gotta finish some work", "Paki-add ng task sa list",
)
NOT_CREATE_EXAMPLES = (
    "Delete a task", "Mark all tasks complete", "Show my upcoming tasks",
    "Search for overdue homework", "Move my assignments to another date",
    "Update my budget", "Send a message", "What's on my calendar",
)


def canonical_title(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def check_day(text: str) -> str | None:
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            return None
        return date.fromisoformat(text).isoformat()
    except ValueError:
        return None


def parse_date(text: str) -> str | None:
    value = text.strip().lower()
    if value == "today":
        return AS_OF.isoformat()
    if value == "tomorrow":
        return (AS_OF + timedelta(days=1)).isoformat()
    if value == "in backlog":
        return ""
    if value.startswith("on "):
        return check_day(value[3:])
    weekdays = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
    if value.startswith("next ") and value[5:] in weekdays:
        day = weekdays.index(value[5:])
        n = (day - AS_OF.weekday()) % 7
        return (AS_OF + timedelta(days=n or 7)).isoformat()
    return None


def rule_predict(utterance: str) -> dict:
    text = utterance.strip().rstrip(".!?").strip()
    # This intentionally narrow baseline does not pretend to be Chrono.
    if not re.match(r"^(?:add|create|put|schedule)\s+", text, re.I):
        if re.search(r"\b(?:add|create|need to|gotta|task)\b", text, re.I):
            return {"status": "needs_review", "title": None, "category": None, "date": None}
        return {"status": "unsupported", "title": None, "category": None, "date": None}
    body = re.sub(r"^(?:add|create|put|schedule)\s+", "", text, flags=re.I)
    # Match only complete owned category names, not substrings. Full-string
    # pattern forbids extra commands after the date.
    candidates = []
    for category in CATEGORIES:
        cat = re.escape(category)
        found = re.fullmatch(
            rf"(?P<title>.+)\s+(?:to|in)\s+{cat}\s+(?P<when>today|tomorrow|in backlog|on \d{{4}}-\d{{2}}-\d{{2}}|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))",
            body, re.I,
        )
        if found:
            when = parse_date(found.group("when"))
            title = found.group("title").strip()
            if when is not None and title:
                candidates.append({"status": "create_task", "title": title, "category": category, "date": when})
    return candidates[0] if len(candidates) == 1 else {
        "status": "needs_review", "title": None, "category": None, "date": None,
    }


def safe_validate(raw: dict) -> dict:
    empty = {"status": "needs_review", "title": None, "category": None, "date": None}
    if not isinstance(raw, dict):
        return empty
    status = raw.get("status")
    if status == "unsupported":
        return {**empty, "status": "unsupported"}
    if status != "create_task":
        return empty
    title, category, day = raw.get("title"), raw.get("category"), raw.get("date")
    if not isinstance(title, str) or not title.strip() or len(title) > 300:
        return empty
    if not isinstance(category, str) or not isinstance(day, str):
        return empty
    exact_category = next((x for x in CATEGORIES if x.casefold() == category.strip().casefold()), None)
    if exact_category is None or (day != "" and check_day(day) != day):
        return empty
    return {"status": status, "title": title.strip(), "category": exact_category, "date": day}


class Rules:
    model_id = None
    def predict(self, input_text):
        return rule_predict(input_text)


class Semantic:
    def __init__(self, name):
        self.model_id = MODEL_IDS[name]
        if name == "model2vec":
            from model2vec import StaticModel
            self.model = StaticModel.from_pretrained(self.model_id)
        else:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_id, device="cpu")
        import numpy as np
        refs = np.asarray(self.model.encode(list(CREATE_EXAMPLES + NOT_CREATE_EXAMPLES)), dtype=float)
        self.references = refs / np.maximum(np.linalg.norm(refs, axis=1, keepdims=True), 1e-12)
        self.n_create = len(CREATE_EXAMPLES)

    def predict(self, input_text):
        import numpy as np
        raw = np.asarray(self.model.encode([input_text])[0], dtype=float)
        unit = raw / max(float(np.linalg.norm(raw)), 1e-12)
        scores = self.references @ unit
        yes, no = max(scores[:self.n_create]), max(scores[self.n_create:])
        # This intentionally conservative gate does not create missing slots.
        if no - yes > 0.06:
            return {"status": "unsupported", "title": None, "category": None, "date": None}
        return rule_predict(input_text)


class SmolLM:
    model_id = MODEL_IDS["smollm"]
    def __init__(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        torch.set_num_threads(2)
        self.torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
        self.model = AutoModelForCausalLM.from_pretrained(self.model_id).eval().to("cpu")

    def predict(self, input_text):
        prompt = (
            "You extract one Mosaic task command into JSON only. Do not infer omitted fields. "
            "Today is 2026-10-31 (Saturday). All dates use that local calendar date. "
            "Allowed categories exactly: " + ", ".join(CATEGORIES) + ". "
            "Allowed statuses: create_task, needs_review, unsupported. "
            "Unsupported for delete, edit, batch, queries, non-task requests. "
            "If a category, date or title is missing or unclear, output needs_review. "
            "Use YYYY-MM-DD for dates, empty string for backlog. "
            'JSON keys: status, title, category, date. No explanatory text.\nCommand: ' + input_text
        )
        messages = [{"role": "user", "content": prompt}]
        inp = self.tokenizer.apply_chat_template(messages, add_generation_prompt=True,
                                                  return_tensors="pt", tokenize=True)
        with self.torch.inference_mode():
            ids = self.model.generate(inp, do_sample=False, max_new_tokens=100,
                                      pad_token_id=self.tokenizer.eos_token_id)
        result = self.tokenizer.decode(ids[0][inp.shape[-1]:], skip_special_tokens=True)
        # Parse a single bounded JSON object. Do not execute model-generated text.
        match = re.search(r"\{[^{}]{0,1000}\}", result)
        if not match:
            return safe_validate({})
        try:
            return safe_validate(json.loads(match.group(0)))
        except (ValueError, TypeError):
            return safe_validate({})


def read_cases(path: Path) -> list[dict]:
    cases = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len({x["id"] for x in cases}) != len(cases):
        raise ValueError("Duplicate case IDs")
    for case in cases:
        if case["expected"]["status"] not in ("create_task", "needs_review", "unsupported"):
            raise ValueError("Unknown label")
        if case["intent"] not in ("create_task", "unsupported"):
            raise ValueError("Unknown intended action")
        if case["expected"]["status"] == "create_task" and safe_validate(case["expected"]) != case["expected"]:
            raise ValueError(f"Invalid reference answer: {case['id']}")
    return cases


def stratified_sample(cases, limit):
    if not limit or limit >= len(cases):
        return cases
    rng = random.Random(1441)
    groups = {}
    for case in cases:
        groups.setdefault(case["group"], []).append(case)
    for values in groups.values():
        rng.shuffle(values)
    result = []
    while len(result) < limit:
        made_progress = False
        for group in sorted(groups):
            if len(result) >= limit:
                break
            if groups[group]:
                result.append(groups[group].pop())
                made_progress = True
        if not made_progress:
            break
    return sorted(result, key=lambda x: x["id"])


def percentile(values, pct):
    if not values:
        return None
    samples = sorted(values)
    return round(samples[min(len(samples)-1, math.ceil(len(samples)*pct)-1)], 3)


def byte_size(directory: Path):
    return sum(f.stat().st_size for f in directory.rglob("*") if f.is_file()) if directory.exists() else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--adapter", choices=("rules", *MODEL_IDS), default="rules")
    parser.add_argument("--cases", type=Path, default=HERE / "cases.jsonl")
    parser.add_argument("--limit", type=int, default=48, help="0 runs entire stratified corpus")
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--allow-download", action="store_true", help="Explicitly allow model fetch over network")
    parser.add_argument("--cache-dir", type=Path, default=HERE / ".model-cache")
    parser.add_argument("--output", type=Path, default=None)
    a = parser.parse_args()
    if a.limit < 0 or a.repeat < 1:
        parser.error("--limit must be >= 0 and --repeat >= 1")
    if a.adapter != "rules":
        a.cache_dir = a.cache_dir.resolve() / a.adapter
        a.cache_dir.mkdir(parents=True, exist_ok=True)
        # Must set before model libraries import their Hugging Face clients.
        os.environ["HF_HOME"] = str(a.cache_dir)
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        if not a.allow_download:
            os.environ["HF_HUB_OFFLINE"] = "1"
            os.environ["TRANSFORMERS_OFFLINE"] = "1"
    cases = stratified_sample(read_cases(a.cases), a.limit)
    setup_start = time.perf_counter()
    engine = Rules() if a.adapter == "rules" else SmolLM() if a.adapter == "smollm" else Semantic(a.adapter)
    setup_ms = round((time.perf_counter()-setup_start)*1000, 3)
    measurements, lines = [], []
    for case in cases:
        outputs = []
        for _ in range(a.repeat):
            start = time.perf_counter()
            pred = safe_validate(engine.predict(case["input"]))
            measurements.append((time.perf_counter()-start)*1000)
            outputs.append(pred)
        got = outputs[0]
        expected = case["expected"]
        exact = (got["status"] == expected["status"] and
                 (got["status"] != "create_task" or
                  (canonical_title(got["title"]) == canonical_title(expected["title"]) and
                   got["category"] == expected["category"] and got["date"] == expected["date"])))
        intent_correct = ((got["status"] != "unsupported") == (case["intent"] == "create_task"))
        unsafe = got["status"] == "create_task" and not exact
        lines.append({"id": case["id"], "group": case["group"], "input": case["input"],
                      "expected": expected, "predicted": got, "exact": exact,
                      "intent_correct": intent_correct, "unsafe_create": unsafe,
                      "stable": len({json.dumps(x, sort_keys=True) for x in outputs}) == 1})
    metrics = {
        "count": len(lines),
        "exact_count": sum(x["exact"] for x in lines),
        "exact_rate": round(sum(x["exact"] for x in lines)/len(lines), 4),
        "intent_accuracy": round(sum(x["intent_correct"] for x in lines)/len(lines), 4),
        "unsafe_create_count": sum(x["unsafe_create"] for x in lines),
        "unstable_count": sum(not x["stable"] for x in lines),
        "by_group": {name: {"count": sum(x["group"] == name for x in lines),
                             "exact": sum(x["group"] == name and x["exact"] for x in lines)}
                     for name in sorted({x["group"] for x in lines})},
        "latency_ms": {"p50": percentile(measurements, .5), "p95": percentile(measurements, .95)},
    }
    details = {"schema": 1, "adapter": a.adapter, "model_id": getattr(engine, "model_id", None),
               "fixture": str(a.cases.name), "as_of_local_day": AS_OF.isoformat(),
               "selected_ids": [c["id"] for c in cases], "repeats": a.repeat,
               "model_cache_bytes": byte_size(a.cache_dir) if a.adapter != "rules" else 0,
               "setup_ms": setup_ms, "peak_process_rss_kib_linux": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss if sys.platform == "linux" else None,
               "platform": platform.platform(), "python": platform.python_version(),
               "metrics": metrics, "cases": lines}
    print(json.dumps({k: v for k, v in details.items() if k != "cases"}, indent=2))
    if a.output:
        a.output.parent.mkdir(parents=True, exist_ok=True)
        a.output.write_text(json.dumps(details, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
        print("MOSAIC_COMMAND_BENCHMARK_REPORT=" + str(a.output.resolve()))
    # Benchmark quality is reported, never confused with pipeline correctness.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
