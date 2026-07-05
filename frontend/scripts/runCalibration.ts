/**
 * Runs the calibration set (content/calibration/manifest.json) through both
 * judges and reports whether each judge's assessed_level matches the
 * expected level for both the weak and strong reference answer per
 * question. This is the "verify a real judge actually works before
 * trusting it" step named in docs/adr/0001 -- the same discipline
 * golden-eval-registry applied to its own first real suite execution.
 *
 * Requires real API keys as environment variables (this is a local CLI
 * script run by a human with their own keys, NOT the browser app -- the
 * browser app never reads keys from the environment, only from a
 * session-scoped form field. See docs/adr/0001 for why the browser and
 * this script have different key-handling rules).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... npm run calibrate
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openaiAdapter } from "../lib/judge/openaiAdapter";
import { anthropicAdapter } from "../lib/judge/anthropicAdapter";
import type { JudgeAdapter, Level, Rubric, SectionedAnswer } from "../lib/judge/types";

type CalibrationAnswer = Omit<SectionedAnswer, "high_level_design_image_url">;

interface CalibrationCase {
  question_id: string;
  weak_answer: CalibrationAnswer;
  expected_weak_level: Level;
  strong_answer: CalibrationAnswer;
  expected_strong_level: Level;
}

const CONTENT_DIR = join(__dirname, "..", "..", "content");

function loadRubrics(): Rubric[] {
  return JSON.parse(readFileSync(join(CONTENT_DIR, "rubrics.json"), "utf-8"));
}

function loadCalibrationSet(): CalibrationCase[] {
  return JSON.parse(readFileSync(join(CONTENT_DIR, "calibration", "manifest.json"), "utf-8"));
}

const LEVEL_ORDER: Level[] = ["mid", "senior", "staff_plus", "principal"];

// A "pass" is judged assessed_level within one step of the expected level --
// not exact-match-only, since level assessment on free text has inherent
// judgment variance even for a well-calibrated judge. Anything off by more
// than one step, or systematically in the same wrong direction across many
// questions, is a real calibration problem worth investigating before
// trusting the harness.
function withinOneStep(assessed: Level, expected: Level): boolean {
  return Math.abs(LEVEL_ORDER.indexOf(assessed) - LEVEL_ORDER.indexOf(expected)) <= 1;
}

// A single retry on a transient network-level failure (e.g. "fetch failed")
// -- not on a real judge error like a malformed API key or a 4xx from the
// provider, which a retry won't fix and which should surface immediately.
const RETRYABLE_ERROR_PATTERN = /fetch failed|ECONNRESET|ETIMEDOUT|network/i;

async function runAdapterAgainstCase(
  adapter: JudgeAdapter,
  rubric: Rubric,
  answer: SectionedAnswer,
  expected: Level,
  apiKey: string,
): Promise<{ pass: boolean; assessed: Level | "ERROR"; detail: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const verdict = await adapter.judge(rubric, answer, apiKey);
      const pass = withinOneStep(verdict.assessed_level, expected);
      return {
        pass,
        assessed: verdict.assessed_level,
        detail: pass ? "ok" : `expected ~${expected}, got ${verdict.assessed_level}`,
      };
    } catch (err) {
      const message = String(err);
      if (attempt === 1 && RETRYABLE_ERROR_PATTERN.test(message)) {
        console.log(`  (retrying [${adapter.provider}] ${rubric.question_id} after transient error: ${message})`);
        continue;
      }
      return { pass: false, assessed: "ERROR", detail: message };
    }
  }
  // Unreachable -- the loop always returns on its second iteration.
  throw new Error("unreachable");
}

async function main() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiKey && !anthropicKey) {
    console.error(
      "FAIL: set OPENAI_API_KEY and/or ANTHROPIC_API_KEY to run the calibration set for real.",
    );
    process.exit(1);
  }

  const rubrics = loadRubrics();
  const rubricById = new Map(rubrics.map((r) => [r.question_id, r]));
  const calibrationSet = loadCalibrationSet();

  let totalCases = 0;
  let totalPassed = 0;

  for (const testCase of calibrationSet) {
    const rubric = rubricById.get(testCase.question_id);
    if (!rubric) {
      console.error(`FAIL: no rubric found for ${testCase.question_id} -- rubrics.json and calibration/manifest.json are out of sync`);
      process.exitCode = 1;
      continue;
    }

    for (const [adapter, key] of [
      [openaiAdapter, openaiKey] as const,
      [anthropicAdapter, anthropicKey] as const,
    ]) {
      if (!key) continue;

      for (const [label, answer, expected] of [
        ["weak", testCase.weak_answer, testCase.expected_weak_level],
        ["strong", testCase.strong_answer, testCase.expected_strong_level],
      ] as const) {
        totalCases += 1;
        const result = await runAdapterAgainstCase(adapter, rubric, answer, expected, key);
        if (result.pass) totalPassed += 1;
        console.log(
          `${result.pass ? "PASS" : "FAIL"} [${adapter.provider}] ${testCase.question_id} (${label}): ${result.detail}`,
        );
      }
    }
  }

  console.log(`\n${totalPassed}/${totalCases} calibration cases passed.`);
  if (totalPassed !== totalCases) {
    process.exitCode = 1;
  }
}

main();
