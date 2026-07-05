"use client";

import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

/**
 * Renders Mermaid source text as a live SVG preview, client-side only.
 * Invalid/incomplete syntax (expected while the user is still typing) fails
 * quietly into a small "..." placeholder rather than throwing or showing a
 * scary error for every incomplete keystroke.
 */
export function MermaidDiagram({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const renderIdRef = useRef(0);

  useEffect(() => {
    if (!source.trim()) {
      setSvg(null);
      return;
    }

    let cancelled = false;
    const thisRenderId = ++renderIdRef.current;

    async function render() {
      const mermaid = (await import("mermaid")).default;
      if (!mermaidInitialized) {
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
        mermaidInitialized = true;
      }
      try {
        const { svg: renderedSvg } = await mermaid.render(`mermaid-preview-${thisRenderId}`, source);
        if (!cancelled && renderIdRef.current === thisRenderId) {
          setSvg(renderedSvg);
        }
      } catch {
        // Invalid/incomplete Mermaid syntax -- expected mid-typing; just
        // keep showing the last valid render rather than erroring out.
      }
    }

    const debounce = setTimeout(render, 400);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [source]);

  if (!svg) {
    return <p className="key-notice">Diagram preview will render here as you type valid Mermaid syntax.</p>;
  }

  // eslint-disable-next-line react/no-danger -- mermaid's own SVG output, rendered client-side from the user's own input
  return <div className="mermaid-preview" dangerouslySetInnerHTML={{ __html: svg }} />;
}
