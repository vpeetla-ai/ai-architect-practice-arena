import Link from "next/link";
import { fetchQuestions } from "@/lib/api";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  "ai-system-design": "AI System Design",
  "general-system-design": "General System Design",
  "cloud-architecture": "Cloud Architecture",
};

export default async function HomePage() {
  const questions = await fetchQuestions();
  const byCategory = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = byCategory.get(q.category) ?? [];
    list.push(q);
    byCategory.set(q.category, list);
  }

  return (
    <main>
      <h1>AI Architect Practice Arena</h1>
      <p>
        Pick a question from{" "}
        <a href="https://github.com/vpeetla-ai/ai-architect-interview-playbook" target="_blank" rel="noreferrer">
          ai-architect-interview-playbook
        </a>
        , write your answer, and get graded by both OpenAI and Anthropic against the playbook&rsquo;s
        own real Staff+/Principal rubric &mdash; using your own API key, never stored or sent to our
        servers.
      </p>
      {Array.from(byCategory.entries()).map(([category, items]) => (
        <div key={category}>
          <div className="category-label">{CATEGORY_LABELS[category] ?? category}</div>
          {items.map((q) => (
            <Link key={q.question_id} className="question-card" href={`/practice/${q.question_id}`}>
              {q.title}
            </Link>
          ))}
        </div>
      ))}
    </main>
  );
}
