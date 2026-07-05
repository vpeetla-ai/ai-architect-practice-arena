import { describe, expect, it } from "vitest";
import { estimateCostUsd, FALLBACK_RATE, RATES } from "../pricing";

describe("estimateCostUsd", () => {
  it("matches the real rate table for a known model", () => {
    // gpt-4.1-mini: $0.40/M prompt, $1.60/M completion (same figures as
    // agent-finops's pricing.py, the org's canonical source).
    const cost = estimateCostUsd("gpt-4.1-mini", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.4 + 1.6, 6);
  });

  it("applies the non-zero fallback rate for an unrecognized model, never a silent $0", () => {
    const cost = estimateCostUsd("some-future-model-not-in-the-table", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(FALLBACK_RATE.promptPerMillion + FALLBACK_RATE.completionPerMillion, 6);
    expect(cost).toBeGreaterThan(0);
  });

  it("rejects negative token counts", () => {
    expect(() => estimateCostUsd("gpt-4.1-mini", -1, 0)).toThrow();
  });

  it("includes a real Anthropic rate, since agent-finops's own table never needed one", () => {
    expect(RATES["claude-sonnet-4-5"]).toBeDefined();
    expect(RATES["claude-sonnet-4-5"].promptPerMillion).toBeGreaterThan(0);
  });
});
