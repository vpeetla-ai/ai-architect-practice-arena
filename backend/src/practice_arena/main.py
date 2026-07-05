"""FastAPI — serves question/rubric content only.

Judging (the OpenAI/Anthropic calls, using the user's own key) happens
entirely client-side in the browser — see frontend/lib/judge/. This
service exists purely so the frontend doesn't need to bundle and ship
content/rubrics.json directly; it never receives, stores, or forwards any
provider API key.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from practice_arena.questions import get_rubric, list_questions

app = FastAPI(title="Practice Arena API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "practice-arena-api"}


@app.get("/questions")
def questions() -> list[dict]:
    return list_questions()


@app.get("/questions/{question_id:path}/rubric")
def rubric(question_id: str) -> dict:
    result = get_rubric(question_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"no rubric found for '{question_id}'")
    return result
