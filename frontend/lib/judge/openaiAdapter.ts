import type { JudgeAdapter, JudgeVerdict, Rubric } from "./types";
import { buildJudgePrompt } from "./prompt";

const OPENAI_MODEL = "gpt-4.1-mini";

/**
 * LIVE-VERIFIED (see docs/adr/0001): a real browser test confirmed OpenAI's
 * chat completions endpoint does not support direct browser-to-API calls --
 * the request fails with a generic CORS-blocked network error, not a
 * readable HTTP response. Routed through a minimal, stateless same-origin
 * proxy (app/api/openai-proxy/route.ts) instead: it forwards the caller-
 * supplied key in the Authorization header on every request and persists
 * nothing. Set NEXT_PUBLIC_OPENAI_API_BASE to override (e.g. back to
 * "https://api.openai.com/v1" directly, if OpenAI ever adds proper browser
 * CORS support) -- the adapter logic itself doesn't change either way.
 */
const OPENAI_API_BASE = process.env.NEXT_PUBLIC_OPENAI_API_BASE ?? "/api/openai-proxy";

export const openaiAdapter: JudgeAdapter = {
  provider: "openai",

  async judge(rubric: Rubric, answerText: string, apiKey: string): Promise<JudgeVerdict> {
    const { system, user } = buildJudgePrompt(rubric, answerText);

    const response = await fetch(OPENAI_API_BASE, {
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
