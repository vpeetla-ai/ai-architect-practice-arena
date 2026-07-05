from practice_arena.questions import get_rubric, list_questions, load_rubrics

EXPECTED_QUESTION_COUNT = 26  # Phase 2: all of ai-system-design/, general-system-design/, cloud-architecture/


def test_load_rubrics_parses_the_real_launch_slice() -> None:
    rubrics = load_rubrics()
    assert len(rubrics) == EXPECTED_QUESTION_COUNT


def test_every_rubric_has_all_four_levels() -> None:
    for rubric in load_rubrics():
        assert set(rubric["level_criteria"].keys()) == {"mid", "senior", "staff_plus", "principal"}
        for level, text in rubric["level_criteria"].items():
            assert text.strip(), f"{rubric['question_id']}: empty criteria text for level '{level}'"


def test_every_rubric_has_the_new_sectioned_fields() -> None:
    for rubric in load_rubrics():
        assert rubric["core_entities_summary"].strip(), f"{rubric['question_id']}: empty core_entities_summary"
        assert rubric["api_interface_summary"].strip(), f"{rubric['question_id']}: empty api_interface_summary"
        assert rubric["high_level_design_summary"].strip(), f"{rubric['question_id']}: empty high_level_design_summary"
        assert rubric["reference_mermaid"], f"{rubric['question_id']}: no mermaid diagram extracted"
        assert rubric["deep_dives_summary"].strip(), f"{rubric['question_id']}: empty deep_dives_summary"
        assert "Deep dive " in rubric["deep_dives_summary"], f"{rubric['question_id']}: deep_dives_summary missing headings"


def test_list_questions_omits_level_criteria() -> None:
    for question in list_questions():
        assert "level_criteria" not in question
        assert {"question_id", "title", "category"} <= question.keys()


def test_get_rubric_returns_none_for_unknown_id() -> None:
    assert get_rubric("not-a-real-question") is None


def test_get_rubric_returns_full_content_for_known_id() -> None:
    rubric = get_rubric("ai-system-design/01-llm-inference-serving-at-scale")
    assert rubric is not None
    assert rubric["title"] == "Design an LLM inference serving platform at scale"
    assert rubric["requirements_summary"]
