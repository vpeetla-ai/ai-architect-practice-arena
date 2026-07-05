import type { Rubric } from "./judge/types";

// The backend serves question/rubric content only -- no API key of any kind
// is ever sent to or handled by it. Defaults to a local dev backend; set
// NEXT_PUBLIC_API_BASE for a deployed backend.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export interface QuestionSummary {
  question_id: string;
  title: string;
  category: string;
}

export async function fetchQuestions(): Promise<QuestionSummary[]> {
  const response = await fetch(`${API_BASE}/questions`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`failed to load questions (${response.status})`);
  }
  return response.json();
}

export async function fetchRubric(questionId: string): Promise<Rubric> {
  const response = await fetch(`${API_BASE}/questions/${questionId}/rubric`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`failed to load rubric for '${questionId}' (${response.status})`);
  }
  return response.json();
}
