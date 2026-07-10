import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONTENT_DIR = join(__dirname, "..", "..", "..", "..", "content");

interface Rubric {
  question_id: string;
  format?: string;
}

interface CalibrationCase {
  question_id: string;
}

describe("content consistency (no orphaned question references)", () => {
  const rubrics: Rubric[] = JSON.parse(readFileSync(join(CONTENT_DIR, "rubrics.json"), "utf-8"));
  const calibrationSet: CalibrationCase[] = JSON.parse(
    readFileSync(join(CONTENT_DIR, "calibration", "manifest.json"), "utf-8"),
  );

  it("has a non-empty rubric set", () => {
    expect(rubrics.length).toBeGreaterThan(0);
  });

  it("every calibration case references a real, current rubric", () => {
    const rubricIds = new Set(rubrics.map((r) => r.question_id));
    for (const testCase of calibrationSet) {
      expect(rubricIds.has(testCase.question_id)).toBe(true);
    }
  });

  it("every calibrated rubric category has a matching calibration case", () => {
    // Coding + interview-craft are practice-graded via the tradeoff shape but
    // live-provider calibration still covers the original 35 only (see README).
    const calibrationIds = new Set(calibrationSet.map((c) => c.question_id));
    const deferred = /^(coding|staff-plus-interview-craft)\//;
    for (const rubric of rubrics) {
      if (deferred.test(rubric.question_id)) continue;
      expect(calibrationIds.has(rubric.question_id)).toBe(true);
    }
  });

  it("every system_design calibration answer includes the six-step data_flow field", () => {
    const sdIds = new Set(rubrics.filter((r) => r.format === "system_design").map((r) => r.question_id));
    const full: Array<{
      question_id: string;
      weak_answer: Record<string, string>;
      strong_answer: Record<string, string>;
    }> = JSON.parse(readFileSync(join(CONTENT_DIR, "calibration", "manifest.json"), "utf-8"));
    for (const testCase of full) {
      if (!sdIds.has(testCase.question_id)) continue;
      expect(testCase.weak_answer.data_flow?.trim().length).toBeGreaterThan(0);
      expect(testCase.strong_answer.data_flow?.trim().length).toBeGreaterThan(0);
    }
  });

  it("every rubric's question_id resolves to a real playbook file on disk", () => {
    for (const rubric of rubrics) {
      const playbookPath = join(CONTENT_DIR, "playbook", `${rubric.question_id}.md`);
      expect(existsSync(playbookPath), `missing playbook file for ${rubric.question_id}`).toBe(true);
    }
  });
});
