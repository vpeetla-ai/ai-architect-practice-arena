from fastapi.testclient import TestClient

from practice_arena.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "practice-arena-api"}


def test_questions_endpoint_returns_all_26() -> None:
    response = client.get("/questions")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 26
    assert all("level_criteria" not in q for q in body)


def test_rubric_endpoint_returns_full_content_for_known_question() -> None:
    response = client.get("/questions/ai-system-design/01-llm-inference-serving-at-scale/rubric")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Design an LLM inference serving platform at scale"
    assert set(body["level_criteria"].keys()) == {"mid", "senior", "staff_plus", "principal"}
    assert body["core_entities_summary"]
    assert body["api_interface_summary"]
    assert body["high_level_design_summary"]
    assert body["reference_mermaid"]
    assert body["deep_dives_summary"]


def test_rubric_endpoint_404s_for_unknown_question() -> None:
    response = client.get("/questions/not-a-real-question/rubric")
    assert response.status_code == 404
