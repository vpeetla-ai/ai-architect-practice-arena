import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONTENT_DIR = join(__dirname, "..", "..", "..", "..", "content");

interface Rubric {
  question_id: string;
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

  it("every rubric has a matching calibration case (no untested question)", () => {
    const calibrationIds = new Set(calibrationSet.map((c) => c.question_id));
    for (const rubric of rubrics) {
      expect(calibrationIds.has(rubric.question_id)).toBe(true);
    }
  });

  it("every rubric's question_id resolves to a real playbook file on disk", () => {
    for (const rubric of rubrics) {
      const playbookPath = join(CONTENT_DIR, "playbook", `${rubric.question_id}.md`);
      expect(existsSync(playbookPath), `missing playbook file for ${rubric.question_id}`).toBe(true);
    }
  });
});
