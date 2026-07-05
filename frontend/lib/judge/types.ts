export interface Rubric {
  question_id: string;
  title: string;
  category: string;
  requirements_summary: string;
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

export interface JudgeVerdict {
  provider: Provider;
  assessed_level: Level;
  met_criteria: string[];
  missing_criteria: string[];
  specific_feedback: string;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface JudgeAdapter {
  provider: Provider;
  judge(rubric: Rubric, answerText: string, apiKey: string): Promise<JudgeVerdict>;
}
