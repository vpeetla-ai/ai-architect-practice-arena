"""Parse ai-architect-interview-playbook entries into structured rubrics.json.

This is a build-time script, not a runtime dependency — the practice arena reads
the generated rubrics.json, never the playbook's markdown directly at request
time. Rerun this whenever the pinned playbook commit is bumped (see
PLAYBOOK_COMMIT below); CI fails the build if any question in QUESTION_SLICE
fails to parse, so a rubric gap is never silently shipped.

Phase 3+ scope: all playbook folders are supported, including Staff+ coding
and interview-craft entries (parsed with the tradeoff rubric shape so the
existing Practice Arena grader can discover them without a fourth UI format).

Formats:

- **system_design** (`ai-system-design/`, `general-system-design/`,
  `cloud-architecture/`, 26 entries): the hellointerview-style shape —
  Requirements, Core entities, API/interface, High-level design, numbered
  Deep dive sections, and a level-criteria section.
- **behavioral** (`behavioral/`, 5 entries): STAR write-ups of Venkat's own
  real cases. Not re-answerable literally, so each entry now also has a
  generic, reusable "question, as it might actually be asked" section a
  practicing user answers with their own experience — the real
  Situation/Task/Action/Result stay as judge-reference/illustrative content.
- **tradeoff** (`scalability-governance-tradeoffs/`, `coding/`,
  `staff-plus-interview-craft/`): reasoning frameworks and Staff+ coding/craft
  guides that share "The question, as it might actually be asked" and
  "The framework" headings. Middle content between framework and level
  criteria is extracted positionally via `_extract_between()`.
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

PLAYBOOK_ROOT = Path(__file__).resolve().parent.parent / "content" / "playbook"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "content" / "rubrics.json"

QUESTION_SLICE: list[str] = [
    "ai-system-design/01-llm-inference-serving-at-scale.md",
    "ai-system-design/02-rag-platform-at-scale.md",
    "ai-system-design/03-agent-tool-use-orchestration-platform.md",
    "ai-system-design/04-feature-store-finetuning-data-pipeline.md",
    "ai-system-design/05-content-moderation-safety-system.md",
    "ai-system-design/06-multimodal-search-recommendation-system.md",
    "ai-system-design/07-llm-evaluation-observability-platform.md",
    "ai-system-design/08-finetuning-rlhf-training-pipeline-at-scale.md",
    "ai-system-design/09-multi-tenant-ai-platform-architecture.md",
    "ai-system-design/10-ai-agent-sandboxing-and-code-execution-security.md",
    "ai-system-design/11-on-device-edge-ai-inference-architecture.md",
    "ai-system-design/12-training-data-provenance-and-ip-risk-architecture.md",
    "ai-system-design/13-durable-long-running-agent-execution.md",
    "cloud-architecture/01-gpu-capacity-planning-and-procurement.md",
    "cloud-architecture/02-multi-region-strategy-training-vs-serving.md",
    "cloud-architecture/03-disaster-recovery-for-model-serving.md",
    "cloud-architecture/04-network-architecture-for-distributed-training.md",
    "cloud-architecture/05-security-and-compliance-architecture-for-ai-systems.md",
    "cloud-architecture/06-container-orchestration-and-cost-optimization-at-scale.md",
    "general-system-design/01-distributed-rate-limiter.md",
    "general-system-design/02-realtime-chat-messaging-at-scale.md",
    "general-system-design/03-news-feed-ranking-system.md",
    "general-system-design/04-distributed-job-scheduler-task-queue.md",
    "general-system-design/05-distributed-unique-id-generator.md",
    "general-system-design/06-collaborative-document-editing.md",
    "general-system-design/07-distributed-cache-cdn-layer.md",
    "behavioral/01-staffing-reduction-10-to-2.md",
    "behavioral/02-finops-audit-and-fix.md",
    "behavioral/03-org-wide-security-hardening.md",
    "behavioral/04-payments-and-edi-modernization.md",
    "behavioral/05-leading-a-0-to-1-ai-product-build.md",
    "scalability-governance-tradeoffs/01-cost-vs-latency-vs-safety.md",
    "scalability-governance-tradeoffs/02-build-vs-buy-shared-services.md",
    "scalability-governance-tradeoffs/03-centralize-vs-federate-governance.md",
    "scalability-governance-tradeoffs/04-build-vs-train-vs-finetune-foundation-model-strategy.md",
    "coding/00-staff-plus-coding-bar.md",
    "coding/01-lru-cache-with-concurrency.md",
    "coding/02-rate-limiter-token-bucket.md",
    "coding/03-time-based-kv-store.md",
    "coding/04-concurrent-bounded-queue.md",
    "coding/05-top-k-frequent-stream.md",
    "coding/06-merge-k-sorted-iterators.md",
    "coding/07-graph-clone-and-cycle-safe.md",
    "coding/08-debug-broken-cache-eviction.md",
    "coding/09-design-inmemory-pubsub.md",
    "coding/10-prefix-sum-subarray-patterns.md",
    "staff-plus-interview-craft/01-what-staff-plus-actually-signals.md",
    "staff-plus-interview-craft/02-questions-you-should-ask.md",
    "staff-plus-interview-craft/03-what-not-to-waste-time-on.md",
]

_CATEGORY_FORMATS: dict[str, str] = {
    "ai-system-design": "system_design",
    "general-system-design": "system_design",
    "cloud-architecture": "system_design",
    "behavioral": "behavioral",
    "scalability-governance-tradeoffs": "tradeoff",
    "coding": "tradeoff",
    "staff-plus-interview-craft": "tradeoff",
}

_LEVEL_KEYS = {
    "mid-level": "mid",
    "senior": "senior",
    "staff+": "staff_plus",
    "principal": "principal",
}


@dataclass(frozen=True)
class SystemDesignRubric:
    question_id: str
    title: str
    category: str
    format: Literal["system_design"]
    requirements_summary: str
    core_entities_summary: str
    api_interface_summary: str
    high_level_design_summary: str
    reference_mermaid: str | None
    deep_dives_summary: str
    level_criteria: dict[str, str]
    related_deep_dives: list[str]


@dataclass(frozen=True)
class BehavioralRubric:
    question_id: str
    title: str
    category: str
    format: Literal["behavioral"]
    generic_prompt: str
    situation_summary: str
    task_summary: str
    action_summary: str
    result_summary: str
    follow_up_question: str
    follow_up_model_answer: str
    level_criteria: dict[str, str]
    related_deep_dives: list[str]


@dataclass(frozen=True)
class TradeoffRubric:
    question_id: str
    title: str
    category: str
    format: Literal["tradeoff"]
    generic_prompt: str
    framework_summary: str
    supporting_evidence_summary: str
    level_criteria: dict[str, str]
    related_deep_dives: list[str]


Rubric = SystemDesignRubric | BehavioralRubric | TradeoffRubric


class RubricParseError(ValueError):
    """A question's markdown didn't match the expected shape — never silently
    skip; the build must fail loudly so a gap is caught before shipping."""


def _extract_section(body: str, heading: str) -> str | None:
    pattern = rf"^## {re.escape(heading)}\s*\n(.*?)(?=^## |\Z)"
    match = re.search(pattern, body, re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else None


def _iter_headings(body: str) -> list[tuple[str, str]]:
    """Returns (heading, content) pairs for every top-level '## ' section, in
    document order — the positional building block `_extract_between()` uses."""
    pattern = r"^## (.+?)\s*\n(.*?)(?=^## |\Z)"
    return re.findall(pattern, body, re.MULTILINE | re.DOTALL)


def _extract_between(body: str, after_heading: str, before_heading: str) -> str:
    """Concatenates every '## ...' section strictly between two known anchor
    headings, preserving each section's own heading text. Used for the
    trade-offs category's middle content, which has no shared heading text
    across entries (unlike '## Deep dive N: ...', there's no prefix pattern to
    match) -- the extraction rule is positional, not pattern-matched."""
    headings = _iter_headings(body)
    names = [h for h, _ in headings]
    if after_heading not in names:
        raise RubricParseError(f"heading '## {after_heading}' not found")
    if before_heading not in names:
        raise RubricParseError(f"heading '## {before_heading}' not found")
    start = names.index(after_heading) + 1
    end = names.index(before_heading)
    if start >= end:
        raise RubricParseError(f"no sections found between '## {after_heading}' and '## {before_heading}'")
    middle = headings[start:end]
    return "\n\n".join(f"## {heading}\n{content.strip()}" for heading, content in middle)


def _split_follow_up(section_body: str, relative_path: str) -> tuple[str, str]:
    """The follow-up section is '**"<question>"** <model answer prose>' --
    split the bolded, quoted question from the prose that answers it."""
    match = re.match(r'\*\*"(.+?)"\*\*\s*(.*)', section_body.strip(), re.DOTALL)
    if not match:
        raise RubricParseError(
            f"{relative_path}: follow-up section doesn't match the expected "
            '\'**"<question>"** <answer>\' shape'
        )
    return match.group(1).strip(), match.group(2).strip()


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


def _extract_deep_dives(body: str) -> str:
    """Concatenates every "## Deep dive N: <title>" section's body — the
    heading count (2-4) and exact title vary per entry, so this matches the
    numbered-heading *pattern*, not a fixed string."""
    pattern = r"^## (Deep dive \d+:.*?)\s*\n(.*?)(?=^## |\Z)"
    matches = re.findall(pattern, body, re.MULTILINE | re.DOTALL)
    if not matches:
        raise RubricParseError("no '## Deep dive N: ...' sections found")
    return "\n\n".join(f"{heading}\n{text.strip()}" for heading, text in matches)


def _extract_mermaid(section_body: str) -> str | None:
    match = re.search(r"```mermaid\s*\n(.*?)```", section_body, re.DOTALL)
    return match.group(1).strip() if match else None


def _read_entry(relative_path: str) -> tuple[str, str, str, str]:
    """Returns (raw text, title, category, question_id) -- the boilerplate
    shared by all three format-specific parsers below."""
    full_path = PLAYBOOK_ROOT / relative_path
    if not full_path.exists():
        raise RubricParseError(f"{relative_path} not found under {PLAYBOOK_ROOT}")

    text = full_path.read_text(encoding="utf-8")
    title_match = re.match(r"^#\s+(.+)$", text, re.MULTILINE)
    if not title_match:
        raise RubricParseError(f"{relative_path}: no H1 title found")
    title = title_match.group(1).strip()

    category = relative_path.split("/", 1)[0]
    question_id = f"{category}/{Path(relative_path).stem}"
    return text, title, category, question_id


def _parse_system_design_entry(relative_path: str) -> SystemDesignRubric:
    text, title, category, question_id = _read_entry(relative_path)

    requirements = _extract_section(text, "Requirements")
    if requirements is None:
        raise RubricParseError(f"{relative_path}: no '## Requirements' section found")

    core_entities = _extract_section(text, "Core entities")
    if core_entities is None:
        raise RubricParseError(f"{relative_path}: no '## Core entities' section found")

    api_interface = _extract_section(text, "API / interface")
    if api_interface is None:
        raise RubricParseError(f"{relative_path}: no '## API / interface' section found")

    high_level_design = _extract_section(text, "High-level design")
    if high_level_design is None:
        raise RubricParseError(f"{relative_path}: no '## High-level design' section found")
    reference_mermaid = _extract_mermaid(high_level_design)

    try:
        deep_dives = _extract_deep_dives(text)
    except RubricParseError as exc:
        raise RubricParseError(f"{relative_path}: {exc}") from exc

    level_section = _extract_section(text, "What's expected at each level")
    if level_section is None:
        raise RubricParseError(f"{relative_path}: no '## What's expected at each level' section found")
    level_criteria = _parse_level_criteria(level_section)

    related_pairs = _extract_related_links(text)
    related_labels = [label for label, _href in related_pairs]

    return SystemDesignRubric(
        question_id=question_id,
        title=title,
        category=category,
        format="system_design",
        requirements_summary=requirements.strip(),
        core_entities_summary=core_entities.strip(),
        api_interface_summary=api_interface.strip(),
        high_level_design_summary=high_level_design.strip(),
        reference_mermaid=reference_mermaid,
        deep_dives_summary=deep_dives,
        level_criteria=level_criteria,
        related_deep_dives=related_labels,
    )


def _parse_behavioral_entry(relative_path: str) -> BehavioralRubric:
    text, title, category, question_id = _read_entry(relative_path)

    generic_prompt = _extract_section(text, "The question, as it might actually be asked")
    if generic_prompt is None:
        raise RubricParseError(
            f"{relative_path}: no '## The question, as it might actually be asked' section found"
        )

    situation = _extract_section(text, "Situation")
    if situation is None:
        raise RubricParseError(f"{relative_path}: no '## Situation' section found")

    task = _extract_section(text, "Task")
    if task is None:
        raise RubricParseError(f"{relative_path}: no '## Task' section found")

    action = _extract_section(text, "Action")
    if action is None:
        raise RubricParseError(f"{relative_path}: no '## Action' section found")

    result = _extract_section(text, "Result")
    if result is None:
        raise RubricParseError(f"{relative_path}: no '## Result' section found")

    follow_up_section = _extract_section(text, "The follow-up question you should expect")
    if follow_up_section is None:
        raise RubricParseError(
            f"{relative_path}: no '## The follow-up question you should expect' section found"
        )
    follow_up_question, follow_up_model_answer = _split_follow_up(follow_up_section, relative_path)

    level_section = _extract_section(text, "What's expected at each level")
    if level_section is None:
        raise RubricParseError(f"{relative_path}: no '## What's expected at each level' section found")
    level_criteria = _parse_level_criteria(level_section)

    related_pairs = _extract_related_links(text)
    related_labels = [label for label, _href in related_pairs]

    return BehavioralRubric(
        question_id=question_id,
        title=title,
        category=category,
        format="behavioral",
        generic_prompt=generic_prompt.strip(),
        situation_summary=situation.strip(),
        task_summary=task.strip(),
        action_summary=action.strip(),
        result_summary=result.strip(),
        follow_up_question=follow_up_question,
        follow_up_model_answer=follow_up_model_answer,
        level_criteria=level_criteria,
        related_deep_dives=related_labels,
    )


def _parse_tradeoff_entry(relative_path: str) -> TradeoffRubric:
    text, title, category, question_id = _read_entry(relative_path)

    generic_prompt = _extract_section(text, "The question, as it might actually be asked")
    if generic_prompt is None:
        raise RubricParseError(
            f"{relative_path}: no '## The question, as it might actually be asked' section found"
        )

    framework = _extract_section(text, "The framework")
    if framework is None:
        raise RubricParseError(f"{relative_path}: no '## The framework' section found")

    try:
        supporting_evidence = _extract_between(text, "The framework", "What's expected at each level")
    except RubricParseError as exc:
        raise RubricParseError(f"{relative_path}: {exc}") from exc

    level_section = _extract_section(text, "What's expected at each level")
    if level_section is None:
        raise RubricParseError(f"{relative_path}: no '## What's expected at each level' section found")
    level_criteria = _parse_level_criteria(level_section)

    related_pairs = _extract_related_links(text)
    related_labels = [label for label, _href in related_pairs]

    return TradeoffRubric(
        question_id=question_id,
        title=title,
        category=category,
        format="tradeoff",
        generic_prompt=generic_prompt.strip(),
        framework_summary=framework.strip(),
        supporting_evidence_summary=supporting_evidence,
        level_criteria=level_criteria,
        related_deep_dives=related_labels,
    )


def parse_entry(relative_path: str) -> Rubric:
    category = relative_path.split("/", 1)[0]
    entry_format = _CATEGORY_FORMATS.get(category)
    if entry_format == "system_design":
        return _parse_system_design_entry(relative_path)
    if entry_format == "behavioral":
        return _parse_behavioral_entry(relative_path)
    if entry_format == "tradeoff":
        return _parse_tradeoff_entry(relative_path)
    raise RubricParseError(f"{relative_path}: unknown category '{category}'")


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
