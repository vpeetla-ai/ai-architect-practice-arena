from fastapi.testclient import TestClient

from practice_arena.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "practice-arena-api"}


def test_questions_endpoint_returns_all_49() -> None:
    response = client.get("/questions")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 62
    assert all("level_criteria" not in q for q in body)


def test_rubric_endpoint_returns_full_content_for_known_question() -> None:
    response = client.get("/questions/ai-system-design/01-llm-inference-serving-at-scale/rubric")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Design an LLM inference serving platform at scale"
    assert body["format"] == "system_design"
    assert set(body["level_criteria"].keys()) == {"mid", "senior", "staff_plus", "principal"}
    assert body["core_entities_summary"]
    assert body["api_interface_summary"]
    assert body["data_flow_summary"]
    assert body["high_level_design_summary"]
    assert body["reference_mermaid"]
    assert body["deep_dives_summary"]


def test_rubric_endpoint_returns_behavioral_shape() -> None:
    response = client.get("/questions/behavioral/01-staffing-reduction-10-to-2/rubric")
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "behavioral"
    assert body["generic_prompt"]
    assert body["situation_summary"]
    assert body["task_summary"]
    assert body["action_summary"]
    assert body["result_summary"]
    assert body["follow_up_question"]
    assert body["follow_up_model_answer"]
    assert set(body["level_criteria"].keys()) == {"mid", "senior", "staff_plus", "principal"}


def test_rubric_endpoint_returns_tradeoff_shape() -> None:
    response = client.get("/questions/scalability-governance-tradeoffs/01-cost-vs-latency-vs-safety/rubric")
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "tradeoff"
    assert body["generic_prompt"]
    assert body["framework_summary"]
    assert body["supporting_evidence_summary"]
    assert set(body["level_criteria"].keys()) == {"mid", "senior", "staff_plus", "principal"}


def test_rubric_endpoint_404s_for_unknown_question() -> None:
    response = client.get("/questions/not-a-real-question/rubric")
    assert response.status_code == 404
