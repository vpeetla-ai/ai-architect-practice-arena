"""Loads the build-time rubrics.json this service serves.

No API key of any kind ever reaches this module or anything it calls —
judging happens entirely client-side in the browser (see
frontend/lib/judge/), by design. This service's only job is handing out
question/rubric content.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

RUBRICS_PATH = Path(__file__).resolve().parent.parent.parent.parent / "content" / "rubrics.json"


@lru_cache(maxsize=1)
def load_rubrics() -> list[dict]:
    if not RUBRICS_PATH.exists():
        raise FileNotFoundError(
            f"{RUBRICS_PATH} not found — run scripts/build_rubrics.py first"
        )
    return json.loads(RUBRICS_PATH.read_text(encoding="utf-8"))


def list_questions() -> list[dict]:
    """Summary view — no level_criteria, so the question picker payload stays small."""
    return [
        {"question_id": r["question_id"], "title": r["title"], "category": r["category"]}
        for r in load_rubrics()
    ]


def get_rubric(question_id: str) -> dict | None:
    for rubric in load_rubrics():
        if rubric["question_id"] == question_id:
            return rubric
    return None
