import { describe, expect, it } from "vitest";
import { buildConsensus } from "../consensus";
import type { JudgeVerdict, SectionFeedback } from "../types";

const EMPTY_SECTIONS = {
  requirements: { strengths: [], improvements: [] },
  core_entities: { strengths: [], improvements: [] },
  api_interface: { strengths: [], improvements: [] },
  high_level_design: { strengths: [], improvements: [] },
  deep_dives: { strengths: [], improvements: [] },
} satisfies Record<string, SectionFeedback>;

function verdict(provider: "openai" | "anthropic", assessed_level: JudgeVerdict["assessed_level"]): JudgeVerdict {
  return {
    provider,
    assessed_level,
    overall_feedback: "",
    sections: EMPTY_SECTIONS,
    prompt_tokens: 0,
    completion_tokens: 0,
  };
}

describe("buildConsensus", () => {
  it("agrees when both judges land on the same level", () => {
    const result = buildConsensus([verdict("openai", "staff_plus"), verdict("anthropic", "staff_plus")]);
    expect(result.agree).toBe(true);
    expect(result.levels).toEqual({ openai: "staff_plus", anthropic: "staff_plus" });
  });

  it("surfaces disagreement rather than silently picking one verdict", () => {
    const result = buildConsensus([verdict("openai", "principal"), verdict("anthropic", "senior")]);
    expect(result.agree).toBe(false);
    expect(result.levels.openai).toBe("principal");
    expect(result.levels.anthropic).toBe("senior");
  });

  it("agrees trivially with a single verdict", () => {
    const result = buildConsensus([verdict("openai", "senior")]);
    expect(result.agree).toBe(true);
  });
});
