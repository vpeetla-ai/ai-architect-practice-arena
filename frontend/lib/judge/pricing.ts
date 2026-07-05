export interface ModelRate {
  promptPerMillion: number;
  completionPerMillion: number;
}

/**
 * Ported from agent-finops's pricing.py (this org's one canonical pricing
 * source: src/agent_finops/pricing.py) and extended with an Anthropic rate,
 * which that service has never needed since it only meters OpenAI/Gemini
 * traffic today. Sourced from each provider's public pricing pages at time
 * of writing -- update here when rates change, same discipline as the
 * source file. This is a client-side cost *estimate* shown to the user for
 * their own BYOK spend -- there is no shared budget to enforce, so unlike
 * agent-finops this never calls a live metering service.
 */
export const RATES: Record<string, ModelRate> = {
  "gpt-4.1-mini": { promptPerMillion: 0.4, completionPerMillion: 1.6 },
  "gpt-4o-mini": { promptPerMillion: 0.15, completionPerMillion: 0.6 },
  "claude-sonnet-4-5": { promptPerMillion: 3.0, completionPerMillion: 15.0 },
};

// Applied when a model isn't in RATES -- a real, non-zero estimate, not a
// silent $0, so an unrecognized model never masquerades as free.
export const FALLBACK_RATE: ModelRate = { promptPerMillion: 1.0, completionPerMillion: 3.0 };

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  if (promptTokens < 0 || completionTokens < 0) {
    throw new Error("token counts must be non-negative");
  }
  const rate = RATES[model] ?? FALLBACK_RATE;
  const cost = (promptTokens * rate.promptPerMillion + completionTokens * rate.completionPerMillion) / 1_000_000;
  return Math.round(cost * 1e8) / 1e8;
}
