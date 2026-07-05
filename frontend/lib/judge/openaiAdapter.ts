import type { JudgeAdapter, JudgeVerdict, Rubric, SectionedAnswer } from "./types";
import { buildJudgePrompt } from "./prompt";
import { normalizeLevel, normalizeOverallFeedback, normalizeSections } from "./parseVerdict";

const OPENAI_MODEL = "gpt-4.1-mini";

/**
 * LIVE-VERIFIED (see docs/adr/0001): a real browser test confirmed OpenAI's
 * chat completions endpoint does not support direct browser-to-API calls --
 * the request fails with a generic CORS-blocked network error, not a
 * readable HTTP response. Routed through a minimal, stateless same-origin
 * proxy (app/api/openai-proxy/route.ts) in the browser instead: it forwards
 * the caller-supplied key in the Authorization header on every request and
 * persists nothing.
 *
 * CORS is a browser-enforced restriction only -- it doesn't apply to a
 * Node.js `fetch()` call (e.g. scripts/runCalibration.ts), and a relative
 * URL like "/api/openai-proxy" has no origin to resolve against outside a
 * browser, so it throws "Failed to parse URL" if used there (caught by
 * actually running the calibration script for real, not assumed). The
 * default below picks the right base for whichever context is running:
 * same-origin proxy in the browser, OpenAI's real endpoint directly
 * everywhere else. NEXT_PUBLIC_OPENAI_API_BASE still overrides either way.
 */
const isBrowser = typeof window !== "undefined";
const OPENAI_API_BASE =
  process.env.NEXT_PUBLIC_OPENAI_API_BASE ??
  (isBrowser ? "/api/openai-proxy" : "https://api.openai.com/v1/chat/completions");

async function callOpenAI(
  system: string,
  user: string,
  imageUrl: string | undefined,
  apiKey: string,
): Promise<Response> {
  const userContent = imageUrl
    ? [
        { type: "text", text: user },
        { type: "image_url", image_url: { url: imageUrl } },
      ]
    : user;

  return fetch(OPENAI_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
}

export const openaiAdapter: JudgeAdapter = {
  provider: "openai",

  async judge(rubric: Rubric, answer: SectionedAnswer, apiKey: string): Promise<JudgeVerdict> {
    const { system, user } = buildJudgePrompt(rubric, answer);
    const imageUrl = answer.high_level_design_image_url;

    // Graceful degradation: if an image was provided, try including it as a
    // real vision input first; if that call fails for any reason (provider
    // rejects the format, the image isn't fetchable, etc.), retry text-only
    // rather than failing the whole grading call over one optional field.
    let response = await callOpenAI(system, user, imageUrl, apiKey);
    let imageUsed = Boolean(imageUrl);
    if (imageUrl && !response.ok) {
      response = await callOpenAI(system, user, undefined, apiKey);
      imageUsed = false;
    }

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
      assessed_level: normalizeLevel(parsed),
      overall_feedback: normalizeOverallFeedback(parsed),
      sections: normalizeSections(parsed),
      image_used_as_vision_input: imageUrl ? imageUsed : undefined,
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
    };
  },
};
