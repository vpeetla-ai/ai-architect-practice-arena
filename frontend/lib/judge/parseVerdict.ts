import type { Level, SectionFeedback, SectionKey } from "./types";

/**
 * Normalizes a judge's raw parsed JSON into a safe, complete shape --
 * defends against a model omitting a section, returning a string instead
 * of an array, or otherwise not matching the requested schema exactly,
 * rather than letting a malformed response crash the results UI.
 *
 * `sectionKeys` is whichever SectionKey union matches the rubric's format
 * (see SECTION_KEYS_BY_FORMAT in types.ts) -- one normalizer generalized
 * over all three formats rather than one per format.
 */
export function normalizeSections(raw: unknown, sectionKeys: readonly SectionKey[]): Record<string, SectionFeedback> {
  const rawSections = (raw as { sections?: Record<string, unknown> } | undefined)?.sections ?? {};
  const result: Record<string, SectionFeedback> = {};
  for (const key of sectionKeys) {
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
