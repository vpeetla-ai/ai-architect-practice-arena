"""Parse ai-architect-interview-playbook entries into structured rubrics.json.

This is a build-time script, not a runtime dependency — the practice arena reads
the generated rubrics.json, never the playbook's markdown directly at request
time. Rerun this whenever the pinned playbook commit is bumped (see
PLAYBOOK_COMMIT below); CI fails the build if any question in QUESTION_SLICE
fails to parse, so a rubric gap is never silently shipped.

Phase 1 scope: only ai-system-design/, general-system-design/, and
cloud-architecture/ entries are supported — they share one rubric shape (an
explicit "## What's expected at each level" section naming Mid/Senior/Staff+/
Principal behavior). behavioral/ and scalability-governance-tradeoffs/ use a
genuinely different answer shape (STAR narrative; framework-plus-worked-example)
that needs its own, differently-designed judge rubric — deferred to Phase 2
rather than force-fit into this parser.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

PLAYBOOK_ROOT = Path(__file__).resolve().parent.parent / "content" / "playbook"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "content" / "rubrics.json"

# The Phase 1 launch slice — 10 questions spanning the 3 folders that share
# the Mid/Senior/Staff+/Principal rubric shape. See docs/adr/0002 for why
# these 10 specifically.
QUESTION_SLICE: list[str] = [
    "ai-system-design/01-llm-inference-serving-at-scale.md",
    "ai-system-design/02-rag-platform-at-scale.md",
    "ai-system-design/03-agent-tool-use-orchestration-platform.md",
    "ai-system-design/10-ai-agent-sandboxing-and-code-execution-security.md",
    "ai-system-design/13-durable-long-running-agent-execution.md",
    "general-system-design/02-realtime-chat-messaging-at-scale.md",
    "general-system-design/04-distributed-job-scheduler-task-queue.md",
    "cloud-architecture/04-network-architecture-for-distributed-training.md",
    "cloud-architecture/05-security-and-compliance-architecture-for-ai-systems.md",
    "cloud-architecture/06-container-orchestration-and-cost-optimization-at-scale.md",
]

_LEVEL_KEYS = {
    "mid-level": "mid",
    "senior": "senior",
    "staff+": "staff_plus",
    "principal": "principal",
}


@dataclass(frozen=True)
class Rubric:
    question_id: str
    title: str
    category: str
    requirements_summary: str
    level_criteria: dict[str, str]
    related_deep_dives: list[str]


class RubricParseError(ValueError):
    """A question's markdown didn't match the expected shape — never silently
    skip; the build must fail loudly so a gap is caught before shipping."""


def _extract_section(body: str, heading: str) -> str | None:
    pattern = rf"^## {re.escape(heading)}\s*\n(.*?)(?=^## |\Z)"
    match = re.search(pattern, body, re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else None


def _parse_level_criteria(level_section: str) -> dict[str, str]:
    criteria: dict[str, str] = {}
    # Each level is a top-level "- **Label:** text..." bullet; the text can
    # itself span multiple wrapped lines (each continuation indented, not
    # starting with "- **"), so we split on the bullet marker itself.
    bullets = re.split(r"\n(?=- \*\*)", level_section.strip())
    for bullet in bullets:
        match = re.match(r"- \*\*(.+?):\*\*\s*(.*)", bullet, re.DOTALL)
        if not match:
            continue
        label = match.group(1).strip().lower()
        key = _LEVEL_KEYS.get(label)
        if key is None:
            continue
        text = " ".join(line.strip() for line in match.group(2).strip().splitlines())
        criteria[key] = text
    missing = set(_LEVEL_KEYS.values()) - set(criteria)
    if missing:
        raise RubricParseError(f"missing level(s) {sorted(missing)} in level-criteria section")
    return criteria


def _extract_related_links(body: str) -> list[str]:
    related = _extract_section(body, "Related")
    if not related:
        return []
    return re.findall(r"\[([^\]]+)\]\(([^)]+)\)", related)  # (label, href) pairs kept as label only downstream


def parse_entry(relative_path: str) -> Rubric:
    full_path = PLAYBOOK_ROOT / relative_path
    if not full_path.exists():
        raise RubricParseError(f"{relative_path} not found under {PLAYBOOK_ROOT}")

    text = full_path.read_text(encoding="utf-8")
    title_match = re.match(r"^#\s+(.+)$", text, re.MULTILINE)
    if not title_match:
        raise RubricParseError(f"{relative_path}: no H1 title found")
    title = title_match.group(1).strip()

    requirements = _extract_section(text, "Requirements")
    if requirements is None:
        raise RubricParseError(f"{relative_path}: no '## Requirements' section found")

    level_section = _extract_section(text, "What's expected at each level")
    if level_section is None:
        raise RubricParseError(f"{relative_path}: no '## What's expected at each level' section found")
    level_criteria = _parse_level_criteria(level_section)

    related_pairs = _extract_related_links(text)
    related_labels = [label for label, _href in related_pairs]

    category = relative_path.split("/", 1)[0]
    question_id = Path(relative_path).stem  # e.g. "01-llm-inference-serving-at-scale"

    return Rubric(
        question_id=f"{category}/{question_id}",
        title=title,
        category=category,
        requirements_summary=requirements.strip(),
        level_criteria=level_criteria,
        related_deep_dives=related_labels,
    )


def build() -> list[Rubric]:
    rubrics: list[Rubric] = []
    errors: list[str] = []
    for relative_path in QUESTION_SLICE:
        try:
            rubrics.append(parse_entry(relative_path))
        except RubricParseError as exc:
            errors.append(str(exc))
    if errors:
        raise RubricParseError("rubric build failed for one or more questions:\n" + "\n".join(errors))
    return rubrics


def main() -> int:
    try:
        rubrics = build()
    except RubricParseError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    OUTPUT_PATH.write_text(
        json.dumps([asdict(r) for r in rubrics], indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"OK: parsed {len(rubrics)} questions -> {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
