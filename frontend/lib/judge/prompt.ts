import type { Rubric, SectionedAnswer } from "./types";

/**
 * Builds the grading prompt directly from the rubric's real section text
 * (parsed verbatim from ai-architect-interview-playbook by
 * scripts/build_rubrics.py) rather than a paraphrased summary -- this is
 * what keeps the judge grounded in the same bar the playbook itself
 * defines, instead of drifting toward the judge model's own generic idea
 * of a good answer.
 */
export function buildJudgePrompt(rubric: Rubric, answer: SectionedAnswer): { system: string; user: string } {
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

  return { system, user };
}
