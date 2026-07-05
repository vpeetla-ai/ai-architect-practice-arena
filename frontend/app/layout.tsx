import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { fetchQuestions } from "@/lib/api";
import { QuestionNavLink } from "@/lib/QuestionNavLink";

export const metadata: Metadata = {
  title: "AI Architect Practice Arena",
  description:
    "Mock-interview practice for ai-architect-interview-playbook -- both OpenAI and Anthropic grade your answer against real Staff+/Principal rubrics, using your own API key.",
};

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  "ai-system-design": "AI System Design",
  "general-system-design": "General System Design",
  "cloud-architecture": "Cloud Architecture",
  behavioral: "Behavioral",
  "scalability-governance-tradeoffs": "Scalability & Governance Trade-offs",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const questions = await fetchQuestions();
  const byCategory = new Map<string, typeof questions>();
  for (const q of questions) {
    const list = byCategory.get(q.category) ?? [];
    list.push(q);
    byCategory.set(q.category, list);
  }

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <nav className="question-nav">
            <Link href="/" className="nav-home-link">
              AI Architect Practice Arena
            </Link>
            {Array.from(byCategory.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="category-label">{CATEGORY_LABELS[category] ?? category}</div>
                {items.map((q) => (
                  <QuestionNavLink key={q.question_id} href={`/practice/${q.question_id}`}>
                    {q.title}
                  </QuestionNavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="practice-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
