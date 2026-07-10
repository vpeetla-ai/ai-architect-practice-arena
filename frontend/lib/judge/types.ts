interface RubricBase {
  question_id: string;
  title: string;
  category: string;
  level_criteria: {
    mid: string;
    senior: string;
    staff_plus: string;
    principal: string;
  };
  related_deep_dives: string[];
}

export interface SystemDesignRubric extends RubricBase {
  format: "system_design";
  requirements_summary: string;
  core_entities_summary: string;
  api_interface_summary: string;
  data_flow_summary: string;
  high_level_design_summary: string;
  reference_mermaid: string | null;
  deep_dives_summary: string;
}

/**
 * STAR write-ups of a real, specific case (Lucid Motors' supply chain,
 * Volvo's payments/EDI, etc.) -- not re-answerable literally. `generic_prompt`
 * is what the candidate is actually asked; situation/task/action/result stay
 * as reference material illustrating the competency and expected depth, not
 * facts the candidate is expected to reproduce.
 */
export interface BehavioralRubric extends RubricBase {
  format: "behavioral";
  generic_prompt: string;
  situation_summary: string;
  task_summary: string;
  action_summary: string;
  result_summary: string;
  follow_up_question: string;
  follow_up_model_answer: string;
}

/** Reasoning-framework questions (cost vs. latency vs. safety, build vs.
 * buy, etc.) -- already generic and reusable as posed in the playbook. */
export interface TradeoffRubric extends RubricBase {
  format: "tradeoff";
  generic_prompt: string;
  framework_summary: string;
  supporting_evidence_summary: string;
}

export type RubricFormat = "system_design" | "behavioral" | "tradeoff";
export type Rubric = SystemDesignRubric | BehavioralRubric | TradeoffRubric;

export type Level = "mid" | "senior" | "staff_plus" | "principal";

export type Provider = "openai" | "anthropic";

export type SystemDesignSectionKey =
  | "requirements"
  | "core_entities"
  | "api_interface"
  | "data_flow"
  | "high_level_design"
  | "deep_dives";
export type BehavioralSectionKey = "situation" | "task" | "action" | "result" | "follow_up_response";
export type TradeoffSectionKey = "framework" | "applied_example";
export type SectionKey = SystemDesignSectionKey | BehavioralSectionKey | TradeoffSectionKey;

/** The section keys a judge prompt/verdict uses for each rubric format --
 * the one shared source prompt-building, verdict-parsing, and the practice
 * page's results rendering all read from, so the three can't drift apart. */
export const SECTION_KEYS_BY_FORMAT: Record<RubricFormat, readonly SectionKey[]> = {
  system_design: [
    "requirements",
    "core_entities",
    "api_interface",
    "data_flow",
    "high_level_design",
    "deep_dives",
  ],
  behavioral: ["situation", "task", "action", "result", "follow_up_response"],
  tradeoff: ["framework", "applied_example"],
};

/**
 * The candidate's answer, broken into the same sections the playbook itself
 * uses (Hello Interview six-step for system design). High-Level Design gets
 * two extra, optional diagram inputs: raw Mermaid source (rendered live in
 * the browser, and read as plain text by the judges -- no vision API needed
 * for this path) and/or an image URL for other tools (Excalidraw exports,
 * screenshots), sent to the judges as a real vision input when the provider
 * supports it. Data Flow may include an optional sequence-diagram Mermaid.
 */
export interface SectionedAnswer {
  requirements: string;
  core_entities: string;
  api_interface: string;
  data_flow: string;
  data_flow_mermaid?: string;
  high_level_design_text: string;
  high_level_design_mermaid: string;
  high_level_design_image_url?: string;
  deep_dives: string;
}

export interface BehavioralAnswer {
  situation: string;
  task: string;
  action: string;
  result: string;
  follow_up_response: string;
}

export interface TradeoffAnswer {
  framework: string;
  applied_example: string;
}

export type Answer = SectionedAnswer | BehavioralAnswer | TradeoffAnswer;

export interface SectionFeedback {
  strengths: string[];
  improvements: string[];
}

export interface JudgeVerdict {
  provider: Provider;
  assessed_level: Level;
  overall_feedback: string;
  /** Keyed by whichever SectionKey union matches the rubric's format --
   * see SECTION_KEYS_BY_FORMAT. */
  sections: Record<string, SectionFeedback>;
  /** True if an image URL was provided and successfully sent as a real
   * vision input; false if one was provided but only passed as a text
   * reference (fetch failed, or the provider rejected the format) -- see
   * docs/adr/0002 for why this needs to degrade gracefully rather than
   * fail the whole grading call over one optional field. Undefined if no
   * image was provided at all (always undefined for behavioral/tradeoff). */
  image_used_as_vision_input?: boolean;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface JudgeAdapter {
  provider: Provider;
  judge(rubric: Rubric, answer: Answer, apiKey: string): Promise<JudgeVerdict>;
}
