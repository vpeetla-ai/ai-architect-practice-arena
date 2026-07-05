"use client";

import { useEffect, useState } from "react";
import { use as usePromise } from "react";
import { fetchRubric } from "@/lib/api";
import { openaiAdapter } from "@/lib/judge/openaiAdapter";
import { anthropicAdapter } from "@/lib/judge/anthropicAdapter";
import { buildConsensus } from "@/lib/judge/consensus";
import { estimateCostUsd } from "@/lib/judge/pricing";
import { renderInlineMarkdown } from "@/lib/renderInlineMarkdown";
import { MermaidDiagram } from "@/lib/MermaidDiagram";
import type { JudgeVerdict, Rubric, SectionedAnswer, SectionKey } from "@/lib/judge/types";

interface PageProps {
  params: Promise<{ questionId: string[] }>;
}

const LEVEL_LABEL: Record<string, string> = {
  mid: "Mid-level",
  senior: "Senior",
  staff_plus: "Staff+",
  principal: "Principal",
};

const SECTION_LABEL: Record<SectionKey, string> = {
  requirements: "Requirements",
  core_entities: "Core Entities",
  api_interface: "API / Interface",
  high_level_design: "High-Level Design",
  deep_dives: "Deep Dives",
};

const SECTION_ORDER: SectionKey[] = ["requirements", "core_entities", "api_interface", "high_level_design", "deep_dives"];

const EMPTY_ANSWER: SectionedAnswer = {
  requirements: "",
  core_entities: "",
  api_interface: "",
  high_level_design_text: "",
  high_level_design_mermaid: "",
  high_level_design_image_url: "",
  deep_dives: "",
};

export default function PracticePage({ params }: PageProps) {
  const { questionId } = usePromise(params);
  const fullId = questionId.join("/");

  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<SectionedAnswer>(EMPTY_ANSWER);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [grading, setGrading] = useState(false);
  const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    fetchRubric(fullId)
      .then(setRubric)
      .catch((err) => setLoadError(String(err)));
    setAnswer(EMPTY_ANSWER);
    setVerdicts([]);
    setErrors([]);
  }, [fullId]);

  function updateSection(key: keyof SectionedAnswer, value: string) {
    setAnswer((prev) => ({ ...prev, [key]: value }));
  }

  const hasAnyAnswer = Object.values(answer).some((v) => v.trim());

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
    <main className="practice-layout-grid">
      <div className="practice-main-col">
        <h1>{rubric.title}</h1>

        <h3>Requirements</h3>
        <p style={{ whiteSpace: "pre-wrap" }}>{renderInlineMarkdown(rubric.requirements_summary)}</p>
        <textarea
          value={answer.requirements}
          onChange={(e) => updateSection("requirements", e.target.value)}
          placeholder="Functional and non-functional requirements..."
        />

        <h3>Core Entities</h3>
        <textarea
          value={answer.core_entities}
          onChange={(e) => updateSection("core_entities", e.target.value)}
          placeholder="The key entities in this system and their relationships..."
        />

        <h3>API / Interface</h3>
        <textarea
          value={answer.api_interface}
          onChange={(e) => updateSection("api_interface", e.target.value)}
          placeholder="The core API surface..."
        />

        <h3>High-Level Design</h3>
        <textarea
          value={answer.high_level_design_text}
          onChange={(e) => updateSection("high_level_design_text", e.target.value)}
          placeholder="Describe the high-level architecture..."
        />
        <p className="key-notice">Diagram (Mermaid syntax) &mdash; renders live below as you type:</p>
        <textarea
          value={answer.high_level_design_mermaid}
          onChange={(e) => updateSection("high_level_design_mermaid", e.target.value)}
          placeholder={"flowchart LR\n  A --> B"}
          style={{ minHeight: "120px", fontFamily: "monospace" }}
        />
        <MermaidDiagram source={answer.high_level_design_mermaid} />
        <p className="key-notice">Or paste a diagram image URL (Excalidraw export, screenshot, etc.):</p>
        <input
          type="text"
          value={answer.high_level_design_image_url}
          onChange={(e) => updateSection("high_level_design_image_url", e.target.value)}
          placeholder="https://..."
          style={{
            width: "100%",
            background: "#10141d",
            color: "#e6e8ee",
            border: "1px solid #1e2431",
            borderRadius: "0.5rem",
            padding: "0.6rem 0.75rem",
          }}
        />
        {answer.high_level_design_image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied URL, next/image's domain allowlist doesn't apply
          <img
            src={answer.high_level_design_image_url}
            alt="High-level design diagram"
            style={{ maxWidth: "100%", marginTop: "0.75rem", borderRadius: "0.5rem" }}
          />
        )}

        <h3>Deep Dives</h3>
        <textarea
          value={answer.deep_dives}
          onChange={(e) => updateSection("deep_dives", e.target.value)}
          placeholder="Walk through the 2-3 hardest trade-offs, with real numbers where you can..."
        />

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
      </div>

      <aside className="right-rail">
        <div className="right-rail-panel">
          <p className="key-notice">
            Paste your own API key below &mdash; it is used only to call the provider directly from your
            browser and is never sent to or stored on our servers. Provide either or both.
          </p>
          <label>
            OpenAI API key
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
            />
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

          <button onClick={handleGrade} disabled={grading || !hasAnyAnswer || (!openaiKey && !anthropicKey)}>
            {grading ? "Grading..." : "Grade my answer"}
          </button>
        </div>

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
            <p>{v.overall_feedback}</p>
            {v.image_used_as_vision_input === false && (
              <p className="key-notice">
                (The diagram image URL couldn&rsquo;t be used as a real visual input for this judge &mdash;
                graded from text only.)
              </p>
            )}
            {SECTION_ORDER.map((key) => {
              const section = v.sections[key];
              if (section.strengths.length === 0 && section.improvements.length === 0) return null;
              return (
                <div key={key} style={{ marginTop: "0.75rem" }}>
                  <strong>{SECTION_LABEL[key]}</strong>
                  {section.strengths.map((s) => (
                    <div key={s}>&#10003; {s}</div>
                  ))}
                  {section.improvements.map((s) => (
                    <div key={s}>&rarr; {s}</div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        {verdicts.length > 0 && (
          <p className="key-notice">Estimated cost of this grading pass on your own key: ${totalCostUsd.toFixed(4)}</p>
        )}
      </aside>
    </main>
  );
}
