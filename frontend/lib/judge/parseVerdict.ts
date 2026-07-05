import type { Level, SectionFeedback, SectionKey } from "./types";

const SECTION_KEYS: SectionKey[] = ["requirements", "core_entities", "api_interface", "high_level_design", "deep_dives"];

/**
 * Normalizes a judge's raw parsed JSON into a safe, complete shape --
 * defends against a model omitting a section, returning a string instead
 * of an array, or otherwise not matching the requested schema exactly,
 * rather than letting a malformed response crash the results UI.
 */
export function normalizeSections(raw: unknown): Record<SectionKey, SectionFeedback> {
  const rawSections = (raw as { sections?: Record<string, unknown> } | undefined)?.sections ?? {};
  const result = {} as Record<SectionKey, SectionFeedback>;
  for (const key of SECTION_KEYS) {
    const section = rawSections[key] as Partial<SectionFeedback> | undefined;
    result[key] = {
      strengths: Array.isArray(section?.strengths) ? section.strengths.map(String) : [],
      improvements: Array.isArray(section?.improvements) ? section.improvements.map(String) : [],
    };
  }
  return result;
}

const VALID_LEVELS: Level[] = ["mid", "senior", "staff_plus", "principal"];

export function normalizeLevel(raw: unknown): Level {
  const level = (raw as { assessed_level?: string } | undefined)?.assessed_level;
  return VALID_LEVELS.includes(level as Level) ? (level as Level) : "mid";
}

export function normalizeOverallFeedback(raw: unknown): string {
  const feedback = (raw as { overall_feedback?: unknown } | undefined)?.overall_feedback;
  return typeof feedback === "string" ? feedback : "";
}
