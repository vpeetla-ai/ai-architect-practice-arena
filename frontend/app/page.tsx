export default function HomePage() {
  return (
    <main>
      <div className="page-hero">
        <p className="category-label" style={{ marginTop: 0 }}>Interview practice</p>
        <h1>AI Architect Practice Arena</h1>
        <p>
          Pick one of <strong>49 playbook questions</strong> (system design, cloud, general SD,
          behavioral STAR, trade-offs, Staff+ coding, and interview craft) from the sidebar — sourced from{" "}
          <a href="https://github.com/vpeetla-ai/ai-architect-interview-playbook" target="_blank" rel="noreferrer">
            ai-architect-interview-playbook
          </a>
          . Write your answer, and get graded by both OpenAI and Anthropic against that
          question&apos;s Staff+/Principal rubric — using your own API key, never stored on our
          servers.
        </p>
      </div>
    </main>
  );
}
