import type { JudgeAdapter, JudgeVerdict, Rubric, SectionedAnswer } from "./types";
import { buildJudgePrompt } from "./prompt";
import { normalizeLevel, normalizeOverallFeedback, normalizeSections } from "./parseVerdict";

const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_API_BASE = process.env.NEXT_PUBLIC_ANTHROPIC_API_BASE ?? "https://api.anthropic.com/v1";

async function callAnthropic(
  system: string,
  user: string,
  imageUrl: string | undefined,
  apiKey: string,
): Promise<Response> {
  const userContent = imageUrl
    ? [
        { type: "text", text: user },
        // NEEDS LIVE VERIFICATION (see docs/adr/0002): Anthropic's messages
        // API has historically required base64-encoded image sources; a
        // plain url-type source may or may not be accepted depending on
        // model/API version. If this call fails, callAnthropic is retried
        // without the image below -- text-only grading still succeeds.
        { type: "image", source: { type: "url", url: imageUrl } },
      ]
    : user;

  return fetch(`${ANTHROPIC_API_BASE}/messages`, {
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
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
}

export const anthropicAdapter: JudgeAdapter = {
  provider: "anthropic",

  async judge(rubric: Rubric, answer: SectionedAnswer, apiKey: string): Promise<JudgeVerdict> {
    const { system, user } = buildJudgePrompt(rubric, answer);
    const imageUrl = answer.high_level_design_image_url;

    let response = await callAnthropic(system, user, imageUrl, apiKey);
    let imageUsed = Boolean(imageUrl);
    if (imageUrl && !response.ok) {
      response = await callAnthropic(system, user, undefined, apiKey);
      imageUsed = false;
    }

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
      assessed_level: normalizeLevel(parsed),
      overall_feedback: normalizeOverallFeedback(parsed),
      sections: normalizeSections(parsed),
      image_used_as_vision_input: imageUrl ? imageUsed : undefined,
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
