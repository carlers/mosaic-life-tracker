"""Generate the fixed, synthetic Mosaic command benchmark corpus (no user data)."""
import json
from datetime import date, timedelta
from pathlib import Path

AS_OF = date(2026, 10, 31)
CATEGORIES = ["School", "Personal", "Work", "Health", "Home", "Errands", "College", "Projects"]
OUT = Path(__file__).with_name("cases.jsonl")
rows = []

def add(text, status, title=None, category=None, when=None, group="", intent=None):
    item = {"id": f"cmd-{len(rows)+1:03d}", "input": text,
            "expected": {"status": status, "title": title, "category": category, "date": when},
            "group": group, "intent": intent or ("unsupported" if status == "unsupported" else "create_task")}
    rows.append(item)

titles = ["submit essay", "buy milk", "send the report", "exercise", "clean the kitchen",
          "pick up the package", "review calculus", "prepare slides", "finish chemistry homework",
          "book a dentist appointment", "pay electricity bill", "study physics", "call the registrar",
          "check the budget", "water the plants", "write a draft", "review the notes", "shop for groceries",
          "read two chapters", "organize my desk", "meet the adviser", "wash my clothes", "complete the lab",
          "email the instructor", "fix the presentation", "prepare dinner", "stretch", "renew my ID",
          "outline the paper", "practice programming", "take vitamins", "back up my files"]
for i, title in enumerate(titles):
    category = CATEGORIES[i % len(CATEGORIES)]
    suffix, expected_date = [
        ("today", "2026-10-31"), ("tomorrow", "2026-11-01"),
        ("on 2026-11-03", "2026-11-03"), ("in backlog", "")
    ][i % 4]
    add(f"Add {title} to {category} {suffix}", "create_task", title, category, expected_date, "canonical")
for i, title in enumerate(titles):
    category = CATEGORIES[(i+3) % len(CATEGORIES)]
    suffix, expected_date = [
        ("today", "2026-10-31"), ("tomorrow", "2026-11-01"),
        ("on 2026-12-01", "2026-12-01"), ("in backlog", "")
    ][i % 4]
    add(f"Create {title} in {category} {suffix}", "create_task", title, category, expected_date, "rephrased")
for i, title in enumerate(titles):
    category = CATEGORIES[(i+2) % len(CATEGORIES)]
    suffix, expected_date = [
        ("tomorrow", "2026-11-01"), ("today", "2026-10-31"),
        ("next Friday", "2026-11-06"), ("in backlog", "")
    ][i % 4]
    starts = [f"Need to {title} for {category} {suffix}",
              f"I gotta {title} for {category} {suffix}",
              f"Please put {title} under {category} {suffix}",
              f"Can you add {title} to my {category} list {suffix}?"]
    add(starts[i%4], "create_task", title, category, expected_date, "natural")
for i, title in enumerate(titles[:24]):
    category = CATEGORIES[i % len(CATEGORIES)]
    patterns = [f"Paki-add {title} sa {category} bukas",
                f"Lagyan mo ng task na {title} sa {category} ngayon",
                f"I need to {title} sa {category} tomorrow",
                f"Pa-add {title} sa {category} next Friday"]
    expected_dates = ["2026-11-01", "2026-10-31", "2026-11-01", "2026-11-06"]
    add(patterns[i%4], "create_task", title, category, expected_dates[i%4], "taglish")
invalid = [
    "Add homework to School on 2026-02-30", "Add call mom to Personal on 2026-13-01",
    "Add taxes to Work on 2026-11-31", "Add walk to Health on 2026-11-1",
    "Add essay to School yesterday", "Add report to Work next someday",
    "Add task to School on tomorrow-ish", "Add checkup to Health on 2026-00-01",
    "Add assignment to School", "Add assignment tomorrow", "Add call mom to Unknown tomorrow",
    "Add homework to School and Work tomorrow", "Add homework to School tomorrow and pay bills",
    "Add file taxes to Work on 2026-02-29", "Add homework to schoolish today",
    "Add homework to School on 2027-02-29", "Add homework to School soon",
    "Add homework to School in two years", "Add homework to School this Thursday maybe",
    "Add homework to School on 2026-11-01 or 2026-11-02",
    "Add text to speech to Work today", "Add move to Home to Home tomorrow",
    "Add under School today", "Add call to School next monday sometime",
]
for text in invalid:
    add(text, "needs_review", group="ambiguous")
unsupported = [
    "Delete all my tasks", "Delete the School category", "Mark everything complete",
    "Move tomorrow's tasks to Friday", "Show me my unfinished tasks", "Search my tasks for homework",
    "What is on my calendar?", "What time is it?", "How is the weather?",
    "Send a message to my friend", "Share my diary entry", "Erase my account",
    "Repeat all tasks weekly", "Make three tasks", "Cancel my reminders",
    "How many tasks are overdue?", "Update my budget", "Add income of 500 pesos",
    "Change my theme", "Read my private diary", "Send email now",
    "Hey Mosaic", "Thanks", "Tell me a joke"
]
for text in unsupported:
    add(text, "unsupported", group="unsupported")
assert len(rows) == 32*3+24+24+24, len(rows)
assert len({x['id'] for x in rows}) == len(rows)
OUT.write_text("".join(json.dumps(r, ensure_ascii=False)+"\n" for r in rows), encoding="utf-8")
print(f"Wrote {len(rows)} synthetic cases: {OUT}")
