export interface Rubric {
  question_id: string;
  title: string;
  category: string;
  requirements_summary: string;
  core_entities_summary: string;
  api_interface_summary: string;
  high_level_design_summary: string;
  reference_mermaid: string | null;
  deep_dives_summary: string;
  level_criteria: {
    mid: string;
    senior: string;
    staff_plus: string;
    principal: string;
  };
  related_deep_dives: string[];
}

export type Level = "mid" | "senior" | "staff_plus" | "principal";

export type Provider = "openai" | "anthropic";

export type SectionKey = "requirements" | "core_entities" | "api_interface" | "high_level_design" | "deep_dives";

/**
 * The candidate's answer, broken into the same sections the playbook itself
 * uses. High-Level Design gets two extra, optional diagram inputs: raw
 * Mermaid source (rendered live in the browser, and read as plain text by
 * the judges -- no vision API needed for this path) and/or an image URL for
 * other tools (Excalidraw exports, screenshots), sent to the judges as a
 * real vision input when the provider supports it.
 */
export interface SectionedAnswer {
  requirements: string;
  core_entities: string;
  api_interface: string;
  high_level_design_text: string;
  high_level_design_mermaid: string;
  high_level_design_image_url?: string;
  deep_dives: string;
}

export interface SectionFeedback {
  strengths: string[];
  improvements: string[];
}

export interface JudgeVerdict {
  provider: Provider;
  assessed_level: Level;
  overall_feedback: string;
  sections: Record<SectionKey, SectionFeedback>;
  /** True if an image URL was provided and successfully sent as a real
   * vision input; false if one was provided but only passed as a text
   * reference (fetch failed, or the provider rejected the format) -- see
   * docs/adr/0002 for why this needs to degrade gracefully rather than
   * fail the whole grading call over one optional field. Undefined if no
   * image was provided at all. */
  image_used_as_vision_input?: boolean;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface JudgeAdapter {
  provider: Provider;
  judge(rubric: Rubric, answer: SectionedAnswer, apiKey: string): Promise<JudgeVerdict>;
}
