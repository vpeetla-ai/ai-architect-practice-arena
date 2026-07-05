"use client";

import { useEffect, useState } from "react";
import { use as usePromise } from "react";
import { fetchRubric } from "@/lib/api";
import { openaiAdapter } from "@/lib/judge/openaiAdapter";
import { anthropicAdapter } from "@/lib/judge/anthropicAdapter";
import { buildConsensus } from "@/lib/judge/consensus";
import { estimateCostUsd } from "@/lib/judge/pricing";
import { renderInlineMarkdown } from "@/lib/renderInlineMarkdown";
import type { JudgeVerdict, Rubric } from "@/lib/judge/types";

interface PageProps {
  params: Promise<{ questionId: string[] }>;
}

const LEVEL_LABEL: Record<string, string> = {
  mid: "Mid-level",
  senior: "Senior",
  staff_plus: "Staff+",
  principal: "Principal",
};

export default function PracticePage({ params }: PageProps) {
  const { questionId } = usePromise(params);
  const fullId = questionId.join("/");

  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [grading, setGrading] = useState(false);
  const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    fetchRubric(fullId)
      .then(setRubric)
      .catch((err) => setLoadError(String(err)));
  }, [fullId]);

  async function handleGrade() {
    if (!rubric) return;
    setGrading(true);
    setVerdicts([]);
    setErrors([]);

    const jobs: Promise<void>[] = [];
    const newVerdicts: JudgeVerdict[] = [];
    const newErrors: string[] = [];

    if (openaiKey) {
      jobs.push(
        openaiAdapter
          .judge(rubric, answer, openaiKey)
          .then((v) => void newVerdicts.push(v))
          .catch((err) => void newErrors.push(`OpenAI: ${err}`)),
      );
    }
    if (anthropicKey) {
      jobs.push(
        anthropicAdapter
          .judge(rubric, answer, anthropicKey)
          .then((v) => void newVerdicts.push(v))
          .catch((err) => void newErrors.push(`Anthropic: ${err}`)),
      );
    }

    await Promise.all(jobs);
    setVerdicts(newVerdicts);
    setErrors(newErrors);
    setGrading(false);
  }

  if (loadError) {
    return (
      <main>
        <p>Failed to load this question: {loadError}</p>
      </main>
    );
  }
  if (!rubric) {
    return (
      <main>
        <p>Loading&hellip;</p>
      </main>
    );
  }

  const consensus = verdicts.length > 0 ? buildConsensus(verdicts) : null;
  const totalCostUsd = verdicts.reduce(
    (sum, v) =>
      sum +
      estimateCostUsd(v.provider === "openai" ? "gpt-4.1-mini" : "claude-sonnet-4-5", v.prompt_tokens, v.completion_tokens),
    0,
  );

  return (
    <main>
      <p>
        <a href="/">&larr; back to all questions</a>
      </p>
      <h1>{rubric.title}</h1>

      <h3>Requirements</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{renderInlineMarkdown(rubric.requirements_summary)}</p>

      <h3>Your answer</h3>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer as you would say it out loud in an interview..."
      />

      <p className="key-notice">
        Paste your own API key below &mdash; it is used only to call the provider directly from your
        browser and is never sent to or stored on our servers. Provide either or both.
      </p>
      <label>
        OpenAI API key
        <input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." />
      </label>
      <label>
        Anthropic API key
        <input
          type="password"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder="sk-ant-..."
        />
      </label>

      <p>
        <button onClick={handleGrade} disabled={grading || !answer || (!openaiKey && !anthropicKey)}>
          {grading ? "Grading..." : "Grade my answer"}
        </button>
      </p>

      {errors.map((err) => (
        <p key={err} style={{ color: "#e08a8a" }}>
          {err}
        </p>
      ))}

      {consensus && !consensus.agree && (
        <div className="disagree-banner">
          The two judges disagreed on your level &mdash; shown separately below rather than averaged.
        </div>
      )}

      {verdicts.map((v) => (
        <div key={v.provider} className="verdict-card">
          <strong>{v.provider === "openai" ? "OpenAI" : "Anthropic"}</strong>{" "}
          <span className={`level-pill level-${v.assessed_level}`}>{LEVEL_LABEL[v.assessed_level]}</span>
          <p>{v.specific_feedback}</p>
          {v.met_criteria.length > 0 && (
            <>
              <strong>Met:</strong>
              <ul>
                {v.met_criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {v.missing_criteria.length > 0 && (
            <>
              <strong>Missing:</strong>
              <ul>
                {v.missing_criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}

      {verdicts.length > 0 && (
        <p className="key-notice">Estimated cost of this grading pass on your own key: ${totalCostUsd.toFixed(4)}</p>
      )}

      {rubric.related_deep_dives.length > 0 && (
        <>
          <h3>Related in the playbook</h3>
          <ul>
            {rubric.related_deep_dives.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
