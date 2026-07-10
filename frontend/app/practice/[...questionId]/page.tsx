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
import { SECTION_KEYS_BY_FORMAT } from "@/lib/judge/types";
import type {
  Answer,
  BehavioralRubric,
  JudgeVerdict,
  Rubric,
  SystemDesignRubric,
  TradeoffRubric,
} from "@/lib/judge/types";

interface PageProps {
  params: Promise<{ questionId: string[] }>;
}

const LEVEL_LABEL: Record<string, string> = {
  mid: "Mid-level",
  senior: "Senior",
  staff_plus: "Staff+",
  principal: "Principal",
};

const SECTION_LABEL: Record<string, string> = {
  requirements: "Requirements",
  core_entities: "Core Entities",
  api_interface: "API / Interface",
  data_flow: "Data Flow",
  high_level_design: "High-Level Design",
  deep_dives: "Deep Dives",
  situation: "Situation",
  task: "Task",
  action: "Action",
  result: "Result",
  follow_up_response: "Follow-up Response",
  framework: "Framework",
  applied_example: "Applied Example",
};

const EMPTY_ANSWER_BY_FORMAT: Record<Rubric["format"], Record<string, string>> = {
  system_design: {
    requirements: "",
    core_entities: "",
    api_interface: "",
    data_flow: "",
    data_flow_mermaid: "",
    high_level_design_text: "",
    high_level_design_mermaid: "",
    high_level_design_image_url: "",
    deep_dives: "",
  },
  behavioral: {
    situation: "",
    task: "",
    action: "",
    result: "",
    follow_up_response: "",
  },
  tradeoff: {
    framework: "",
    applied_example: "",
  },
};

/**
 * The answer state is stored as a flat string map regardless of format --
 * structurally identical to whichever of SectionedAnswer/BehavioralAnswer/
 * TradeoffAnswer actually applies, since all three are just string fields.
 * Cast to the Answer union only at the judge-adapter call boundary, where
 * `rubric` and `answer` are guaranteed to match by construction (this
 * component only ever populates `answer` with the current rubric's own
 * format's keys).
 */
function renderSystemDesignSections(
  rubric: SystemDesignRubric,
  answer: Record<string, string>,
  updateSection: (key: string, value: string) => void,
) {
  return (
    <>
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

      <h3>Data Flow</h3>
      <p className="key-notice">
        How data moves through the system &mdash; APIs and core business steps in sequence
        (distinct from the component architecture below).
      </p>
      <textarea
        value={answer.data_flow}
        onChange={(e) => updateSection("data_flow", e.target.value)}
        placeholder="Describe the happy-path sequence: client → API → services → response..."
      />
      <p className="key-notice">Optional sequence diagram (Mermaid) &mdash; renders live below:</p>
      <textarea
        value={answer.data_flow_mermaid}
        onChange={(e) => updateSection("data_flow_mermaid", e.target.value)}
        placeholder={"sequenceDiagram\n  Client->>API: POST /v1/...\n  API-->>Client: 200"}
        style={{ minHeight: "120px", fontFamily: "monospace" }}
      />
      <MermaidDiagram source={answer.data_flow_mermaid} />

      <h3>High-Level Design</h3>
      <p className="key-notice">Component architecture that satisfies the functional requirements.</p>
      <textarea
        value={answer.high_level_design_text}
        onChange={(e) => updateSection("high_level_design_text", e.target.value)}
        placeholder="Describe the high-level architecture..."
      />
      <p className="key-notice">Diagram (Mermaid syntax) &mdash; renders live below as you type:</p>
      <textarea
        value={answer.high_level_design_mermaid}
        onChange={(e) => updateSection("high_level_design_mermaid", e.target.value)}
        placeholder={"graph TB\n  Client --> Gateway\n  Gateway --> Service"}
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
      <p className="key-notice">Non-functional deep dives: latency, scale, failure, cost, security.</p>
      <textarea
        value={answer.deep_dives}
        onChange={(e) => updateSection("deep_dives", e.target.value)}
        placeholder="Walk through the 2-3 hardest trade-offs, with real numbers where you can..."
      />
    </>
  );
}

function renderBehavioralSections(
  rubric: BehavioralRubric,
  answer: Record<string, string>,
  updateSection: (key: string, value: string) => void,
) {
  return (
    <>
      <h3>The question</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{renderInlineMarkdown(rubric.generic_prompt)}</p>

      <div className="illustrative-example">
        <p className="key-notice">
          Illustrative example from a real case study &mdash; answer with your OWN experience, not this one:
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>
          <strong>Situation:</strong> {renderInlineMarkdown(rubric.situation_summary)}
        </p>
        <p style={{ whiteSpace: "pre-wrap" }}>
          <strong>Task:</strong> {renderInlineMarkdown(rubric.task_summary)}
        </p>
      </div>

      <h3>Situation</h3>
      <textarea
        value={answer.situation}
        onChange={(e) => updateSection("situation", e.target.value)}
        placeholder="What was the real situation you were in..."
      />

      <h3>Task</h3>
      <textarea
        value={answer.task}
        onChange={(e) => updateSection("task", e.target.value)}
        placeholder="What did you specifically need to accomplish..."
      />

      <h3>Action</h3>
      <textarea
        value={answer.action}
        onChange={(e) => updateSection("action", e.target.value)}
        placeholder="What did you actually do, and why..."
      />

      <h3>Result</h3>
      <textarea
        value={answer.result}
        onChange={(e) => updateSection("result", e.target.value)}
        placeholder="What was the measurable outcome..."
      />

      <h3>Follow-up: {rubric.follow_up_question}</h3>
      <textarea
        value={answer.follow_up_response}
        onChange={(e) => updateSection("follow_up_response", e.target.value)}
        placeholder="How would you answer this follow-up..."
      />
    </>
  );
}

function renderTradeoffSections(
  rubric: TradeoffRubric,
  answer: Record<string, string>,
  updateSection: (key: string, value: string) => void,
) {
  return (
    <>
      <h3>The question</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{renderInlineMarkdown(rubric.generic_prompt)}</p>

      <h3>Your framework / reasoning</h3>
      <textarea
        value={answer.framework}
        onChange={(e) => updateSection("framework", e.target.value)}
        placeholder="How do you reason about this trade-off..."
      />

      <h3>A concrete example where you&rsquo;ve seen this decided</h3>
      <textarea
        value={answer.applied_example}
        onChange={(e) => updateSection("applied_example", e.target.value)}
        placeholder="Walk through a real or realistic case..."
      />
    </>
  );
}

export default function PracticePage({ params }: PageProps) {
  const { questionId } = usePromise(params);
  const fullId = questionId.join("/");

  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<Record<string, string>>(EMPTY_ANSWER_BY_FORMAT.system_design);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [grading, setGrading] = useState(false);
  const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setRubric(null);
    setLoadError(null);
    setVerdicts([]);
    setErrors([]);
    fetchRubric(fullId)
      .then((r) => {
        setRubric(r);
        setAnswer(EMPTY_ANSWER_BY_FORMAT[r.format]);
      })
      .catch((err) => setLoadError(String(err)));
  }, [fullId]);

  function updateSection(key: string, value: string) {
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
    // Safe: `answer` is only ever populated with the current rubric's own
    // format's keys (see EMPTY_ANSWER_BY_FORMAT), so this flat string map
    // always structurally matches the Answer variant `rubric.format` implies.
    const typedAnswer = answer as unknown as Answer;

    if (openaiKey) {
      jobs.push(
        openaiAdapter
          .judge(rubric, typedAnswer, openaiKey)
          .then((v) => void newVerdicts.push(v))
          .catch((err) => void newErrors.push(`OpenAI: ${err}`)),
      );
    }
    if (anthropicKey) {
      jobs.push(
        anthropicAdapter
          .judge(rubric, typedAnswer, anthropicKey)
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
  const sectionOrder = SECTION_KEYS_BY_FORMAT[rubric.format];

  return (
    <main className="practice-layout-grid">
      <div className="practice-main-col">
        <h1>{rubric.title}</h1>

        {rubric.format === "system_design" && renderSystemDesignSections(rubric, answer, updateSection)}
        {rubric.format === "behavioral" && renderBehavioralSections(rubric, answer, updateSection)}
        {rubric.format === "tradeoff" && renderTradeoffSections(rubric, answer, updateSection)}

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
            {sectionOrder.map((key) => {
              const section = v.sections[key];
              if (!section || (section.strengths.length === 0 && section.improvements.length === 0)) return null;
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
