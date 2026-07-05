import type { JudgeVerdict, Level, Provider } from "./types";

export interface ConsensusResult {
  agree: boolean;
  levels: Partial<Record<Provider, Level>>;
  combined_met_criteria: string[];
  combined_missing_criteria: string[];
}

/**
 * Merges two (or more) judges' verdicts for one attempt. Deliberately does
 * NOT silently average or pick a "winning" verdict when judges disagree --
 * `agree: false` is a real, surfaced signal the UI shows the user, not
 * hidden behind a single blended score.
 */
export function buildConsensus(verdicts: JudgeVerdict[]): ConsensusResult {
  const levels: Partial<Record<Provider, Level>> = {};
  const met = new Set<string>();
  const missing = new Set<string>();

  for (const verdict of verdicts) {
    levels[verdict.provider] = verdict.assessed_level;
    verdict.met_criteria.forEach((c) => met.add(c));
    verdict.missing_criteria.forEach((c) => missing.add(c));
  }

  const distinctLevels = new Set(Object.values(levels));

  return {
    agree: distinctLevels.size <= 1,
    levels,
    combined_met_criteria: Array.from(met),
    combined_missing_criteria: Array.from(missing),
  };
}
