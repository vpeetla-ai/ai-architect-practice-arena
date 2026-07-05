import { Fragment } from "react";

/**
 * Minimal inline-markdown renderer for the small subset the playbook's
 * rubric text actually uses (**bold** and line breaks) -- not a general
 * Markdown engine, since pulling in a full parser for two syntax forms
 * would be more dependency than this text needs.
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  return text.split("\n").map((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <Fragment key={lineIndex}>
        {parts.map((part, partIndex) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={partIndex}>{part.slice(2, -2)}</strong>
          ) : (
            <Fragment key={partIndex}>{part}</Fragment>
          ),
        )}
        {lineIndex < text.split("\n").length - 1 && <br />}
      </Fragment>
    );
  });
}
