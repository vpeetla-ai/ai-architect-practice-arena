import type { Rubric } from "./types";

/**
 * Builds the grading prompt directly from the rubric's real level-criteria
 * text (parsed verbatim from ai-architect-interview-playbook by
 * scripts/build_rubrics.py) rather than a paraphrased summary -- this is
 * what keeps the judge grounded in the same bar the playbook itself
 * defines, instead of drifting toward the judge model's own generic idea
 * of a good answer.
 */
export function buildJudgePrompt(rubric: Rubric, answerText: string): { system: string; user: string } {
  const system = `You are grading a candidate's answer to a Staff+/Principal-level AI Architect system-design interview question, against a specific, predefined rubric. Grade STRICTLY against the rubric text below -- do not substitute your own general opinion of what a good answer looks like.

Question: ${rubric.title}

Requirements the answer should address:
${rubric.requirements_summary}

Rubric -- what a real answer looks like at each level (use this exact text to judge, don't paraphrase your own bar):
- Mid-level: ${rubric.level_criteria.mid}
- Senior: ${rubric.level_criteria.senior}
- Staff+: ${rubric.level_criteria.staff_plus}
- Principal: ${rubric.level_criteria.principal}

Assess which level the candidate's answer most closely matches, based on which level's specific criteria the answer actually demonstrates -- not tone, length, or confidence. An answer should be classified at the HIGHEST level whose criteria it clearly satisfies; do not award a level based on partial or vague gestures toward its criteria.

Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "assessed_level": "mid" | "senior" | "staff_plus" | "principal",
  "met_criteria": ["specific things the answer got right, quoting or paraphrasing the rubric criteria met"],
  "missing_criteria": ["specific things a higher level would have included that this answer didn't"],
  "specific_feedback": "2-4 sentences of concrete, actionable feedback"
}`;

  const user = `Candidate's answer:\n\n${answerText}`;

  return { system, user };
}
