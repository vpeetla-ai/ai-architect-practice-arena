import type { JudgeAdapter, JudgeVerdict, Rubric } from "./types";
import { buildJudgePrompt } from "./prompt";

const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_API_BASE = process.env.NEXT_PUBLIC_ANTHROPIC_API_BASE ?? "https://api.anthropic.com/v1";

export const anthropicAdapter: JudgeAdapter = {
  provider: "anthropic",

  async judge(rubric: Rubric, answerText: string, apiKey: string): Promise<JudgeVerdict> {
    const { system, user } = buildJudgePrompt(rubric, answerText);

    const response = await fetch(`${ANTHROPIC_API_BASE}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Documented, official opt-in for calling the API directly from a
        // browser instead of through a backend -- see
        // https://docs.anthropic.com/en/api/client-sdks (browser support).
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Anthropic judge call failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    const textBlock = (data.content ?? []).find((block: { type: string }) => block.type === "text");
    if (!textBlock) {
      throw new Error("Anthropic judge returned no text content");
    }
    const parsed = JSON.parse(extractJson(textBlock.text));

    return {
      provider: "anthropic",
      assessed_level: parsed.assessed_level,
      met_criteria: parsed.met_criteria ?? [],
      missing_criteria: parsed.missing_criteria ?? [],
      specific_feedback: parsed.specific_feedback ?? "",
      prompt_tokens: data.usage?.input_tokens ?? 0,
      completion_tokens: data.usage?.output_tokens ?? 0,
    };
  },
};

// Anthropic's Messages API doesn't have a strict json_object response_format
// like OpenAI's; the prompt instructs the model to return only JSON, but
// this defensively strips an accidental markdown fence rather than trusting
// that instruction blindly.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : text.trim();
}
