import type {
  Answer,
  BehavioralAnswer,
  BehavioralRubric,
  Rubric,
  SectionedAnswer,
  TradeoffAnswer,
  TradeoffRubric,
} from "./types";

interface PromptResult {
  system: string;
  user: string;
  /** Only ever set for system_design -- the other two formats have no
   * diagram/image concept. */
  imageUrl?: string;
}

/**
 * Builds the grading prompt directly from the rubric's real section text
 * (parsed verbatim from ai-architect-interview-playbook by
 * scripts/build_rubrics.py) rather than a paraphrased summary -- this is
 * what keeps the judge grounded in the same bar the playbook itself
 * defines, instead of drifting toward the judge model's own generic idea
 * of a good answer. Branches per rubric.format; the three builders below
 * share one JSON-response contract shape so parseVerdict.ts needs only one
 * normalizer, generalized over whichever section keys the format declares.
 */
export function buildJudgePrompt(rubric: Rubric, answer: Answer): PromptResult {
  if (rubric.format === "system_design") {
    return buildSystemDesignPrompt(rubric, answer as SectionedAnswer);
  }
  if (rubric.format === "behavioral") {
    return buildBehavioralPrompt(rubric, answer as BehavioralAnswer);
  }
  return buildTradeoffPrompt(rubric, answer as TradeoffAnswer);
}

function buildSystemDesignPrompt(
  rubric: Extract<Rubric, { format: "system_design" }>,
  answer: SectionedAnswer,
): PromptResult {
  const system = `You are grading a candidate's answer to a Staff+/Principal-level AI Architect system-design interview question, against a specific, predefined rubric. Grade STRICTLY against the rubric text below -- do not substitute your own general opinion of what a good answer looks like.

Question: ${rubric.title}

Reference material -- what a real answer covers, section by section (use this exact text to judge, don't paraphrase your own bar):

## Requirements
${rubric.requirements_summary}

## Core entities
${rubric.core_entities_summary}

## API / interface
${rubric.api_interface_summary}

## High-level design
${rubric.high_level_design_summary}
${rubric.reference_mermaid ? `\nReal system's own diagram (for comparison, not the only acceptable design):\n\`\`\`mermaid\n${rubric.reference_mermaid}\n\`\`\`` : ""}

## Deep dives
${rubric.deep_dives_summary}

## Level criteria -- what distinguishes Mid/Senior/Staff+/Principal:
- Mid-level: ${rubric.level_criteria.mid}
- Senior: ${rubric.level_criteria.senior}
- Staff+: ${rubric.level_criteria.staff_plus}
- Principal: ${rubric.level_criteria.principal}

Assess ONE overall level for the whole answer, based on which level's specific criteria it actually demonstrates -- not tone, length, or confidence. Classify at the HIGHEST level whose criteria are clearly satisfied; do not award a level for partial or vague gestures toward its criteria.

Additionally, grade EACH of the five sections (Requirements, Core Entities, API/Interface, High-Level Design, Deep Dives) separately: for each, list specific strengths (what the candidate got right, referencing the rubric) and specific improvements (what a stronger answer would have included, referencing the rubric) -- concrete and actionable, not generic praise or criticism. A section left blank or missing should be flagged plainly as missing, not skipped.

If a High-Level Design diagram image was provided (described below or shown to you directly), evaluate it as part of the High-Level Design section's strengths/improvements.

Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "assessed_level": "mid" | "senior" | "staff_plus" | "principal",
  "overall_feedback": "2-4 sentences summarizing the answer as a whole",
  "sections": {
    "requirements": { "strengths": string[], "improvements": string[] },
    "core_entities": { "strengths": string[], "improvements": string[] },
    "api_interface": { "strengths": string[], "improvements": string[] },
    "high_level_design": { "strengths": string[], "improvements": string[] },
    "deep_dives": { "strengths": string[], "improvements": string[] }
  }
}`;

  const imageNote = answer.high_level_design_image_url
    ? `\n\n[The candidate also provided a diagram image URL: ${answer.high_level_design_image_url} -- if you can see it below, evaluate it directly; if not, note in the High-Level Design section that a diagram was referenced but not visible to you.]`
    : "";

  const user = `Candidate's answer:

## Requirements
${answer.requirements || "(left blank)"}

## Core entities
${answer.core_entities || "(left blank)"}

## API / interface
${answer.api_interface || "(left blank)"}

## High-level design
${answer.high_level_design_text || "(left blank)"}
${answer.high_level_design_mermaid ? `\nDiagram (Mermaid source):\n\`\`\`mermaid\n${answer.high_level_design_mermaid}\n\`\`\`` : ""}${imageNote}

## Deep dives
${answer.deep_dives || "(left blank)"}`;

  return { system, user, imageUrl: answer.high_level_design_image_url };
}

function buildBehavioralPrompt(rubric: BehavioralRubric, answer: BehavioralAnswer): PromptResult {
  const system = `You are grading a candidate's answer to a Staff+/Principal-level AI Architect BEHAVIORAL interview question, using the STAR method (Situation, Task, Action, Result) plus a likely follow-up question.

Generic interview question posed to the candidate: "${rubric.generic_prompt}"

IMPORTANT: the reference material below is ONE real, illustrative example of someone demonstrating this competency -- it is NOT the assignment, and the candidate is not expected to reference the same company, numbers, or facts. Grade whether the candidate's own real story demonstrates the SAME underlying competency and depth, not whether it matches these specific details.

Illustrative reference example:
## Situation
${rubric.situation_summary}
## Task
${rubric.task_summary}
## Action (the depth a strong answer's action section shows)
${rubric.action_summary}
## Result (the depth a strong answer's result section shows)
${rubric.result_summary}

Likely follow-up question: "${rubric.follow_up_question}"
Reference answer to that follow-up (depth to calibrate against, not facts to match):
${rubric.follow_up_model_answer}

## Level criteria -- what distinguishes Mid/Senior/Staff+/Principal:
- Mid-level: ${rubric.level_criteria.mid}
- Senior: ${rubric.level_criteria.senior}
- Staff+: ${rubric.level_criteria.staff_plus}
- Principal: ${rubric.level_criteria.principal}

Assess ONE overall level for the whole answer, based on which level's specific criteria it actually demonstrates in the candidate's OWN story -- not tone, length, or confidence. Classify at the HIGHEST level whose criteria are clearly satisfied.

Additionally, grade EACH of five sections (Situation, Task, Action, Result, Follow-up Response) separately: for each, list specific strengths and specific improvements -- concrete and actionable, not generic praise or criticism. A section left blank should be flagged plainly as missing, not skipped.

Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "assessed_level": "mid" | "senior" | "staff_plus" | "principal",
  "overall_feedback": "2-4 sentences summarizing the answer as a whole",
  "sections": {
    "situation": { "strengths": string[], "improvements": string[] },
    "task": { "strengths": string[], "improvements": string[] },
    "action": { "strengths": string[], "improvements": string[] },
    "result": { "strengths": string[], "improvements": string[] },
    "follow_up_response": { "strengths": string[], "improvements": string[] }
  }
}`;

  const user = `Candidate's answer:

## Situation
${answer.situation || "(left blank)"}

## Task
${answer.task || "(left blank)"}

## Action
${answer.action || "(left blank)"}

## Result
${answer.result || "(left blank)"}

## Response to the follow-up question ("${rubric.follow_up_question}")
${answer.follow_up_response || "(left blank)"}`;

  return { system, user };
}

function buildTradeoffPrompt(rubric: TradeoffRubric, answer: TradeoffAnswer): PromptResult {
  const system = `You are grading a candidate's answer to a Staff+/Principal-level AI Architect REASONING-FRAMEWORK interview question -- not a system design, a trade-off argument explained out loud.

Question posed to the candidate: "${rubric.generic_prompt}"

Reference material -- the real framework and supporting evidence this question is grounded in (use this to judge depth and correctness; the candidate does not need to cite the same real systems):

## The framework
${rubric.framework_summary}

## Supporting evidence and edge cases
${rubric.supporting_evidence_summary}

## Level criteria -- what distinguishes Mid/Senior/Staff+/Principal:
- Mid-level: ${rubric.level_criteria.mid}
- Senior: ${rubric.level_criteria.senior}
- Staff+: ${rubric.level_criteria.staff_plus}
- Principal: ${rubric.level_criteria.principal}

Assess ONE overall level based on which level's specific criteria the candidate's reasoning actually demonstrates -- not tone, length, or confidence. Classify at the HIGHEST level whose criteria are clearly satisfied.

Additionally, grade EACH of two sections (Framework, Applied Example) separately: for each, list specific strengths and specific improvements -- concrete and actionable. A section left blank should be flagged plainly as missing, not skipped.

Respond with ONLY valid JSON matching this exact shape, no markdown fences, no commentary:
{
  "assessed_level": "mid" | "senior" | "staff_plus" | "principal",
  "overall_feedback": "2-4 sentences summarizing the answer as a whole",
  "sections": {
    "framework": { "strengths": string[], "improvements": string[] },
    "applied_example": { "strengths": string[], "improvements": string[] }
  }
}`;

  const user = `Candidate's answer:

## Framework / reasoning
${answer.framework || "(left blank)"}

## A concrete example where you've seen this trade-off decided
${answer.applied_example || "(left blank)"}`;

  return { system, user };
}
