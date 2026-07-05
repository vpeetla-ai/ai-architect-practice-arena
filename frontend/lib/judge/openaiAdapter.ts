import type { JudgeAdapter, JudgeVerdict, Rubric } from "./types";
import { buildJudgePrompt } from "./prompt";

const OPENAI_MODEL = "gpt-4.1-mini";

/**
 * NEEDS LIVE VERIFICATION: OpenAI's chat completions endpoint has
 * historically not sent CORS headers permitting direct browser-based
 * fetch() calls. If a real browser test (see docs/adr/0001) confirms this
 * is still blocked, swap OPENAI_API_BASE below to point at a minimal,
 * stateless same-origin proxy (a Vercel Edge Function that forwards the
 * request with the caller-supplied key in the Authorization header,
 * per-call, logging and persisting nothing) instead of api.openai.com
 * directly -- the adapter logic itself doesn't change, only the base URL.
 */
const OPENAI_API_BASE = process.env.NEXT_PUBLIC_OPENAI_API_BASE ?? "https://api.openai.com/v1";

export const openaiAdapter: JudgeAdapter = {
  provider: "openai",

  async judge(rubric: Rubric, answerText: string, apiKey: string): Promise<JudgeVerdict> {
    const { system, user } = buildJudgePrompt(rubric, answerText);

    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI judge call failed (${response.status}): ${detail}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI judge returned no content");
    }
    const parsed = JSON.parse(content);

    return {
      provider: "openai",
      assessed_level: parsed.assessed_level,
      met_criteria: parsed.met_criteria ?? [],
      missing_criteria: parsed.missing_criteria ?? [],
      specific_feedback: parsed.specific_feedback ?? "",
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
    };
  },
};
