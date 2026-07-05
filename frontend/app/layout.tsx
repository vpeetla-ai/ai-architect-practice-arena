import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Architect Practice Arena",
  description:
    "Mock-interview practice for ai-architect-interview-playbook -- both OpenAI and Anthropic grade your answer against real Staff+/Principal rubrics, using your own API key.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
