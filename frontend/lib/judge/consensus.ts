import type { JudgeVerdict, Level, Provider } from "./types";

export interface ConsensusResult {
  agree: boolean;
  levels: Partial<Record<Provider, Level>>;
}

/**
 * Merges two (or more) judges' verdicts for one attempt. Deliberately does
 * NOT silently average or pick a "winning" verdict when judges disagree --
 * `agree: false` is a real, surfaced signal the UI shows the user, not
 * hidden behind a single blended score. Per-section feedback is shown
 * per-judge in the results view rather than merged, since each judge's
 * strengths/improvements are its own independent read of the answer.
 */
export function buildConsensus(verdicts: JudgeVerdict[]): ConsensusResult {
  const levels: Partial<Record<Provider, Level>> = {};

  for (const verdict of verdicts) {
    levels[verdict.provider] = verdict.assessed_level;
  }

  const distinctLevels = new Set(Object.values(levels));

  return {
    agree: distinctLevels.size <= 1,
    levels,
  };
}
