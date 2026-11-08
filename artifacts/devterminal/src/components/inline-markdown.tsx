import React from "react";

/** Render provider text as React nodes, so embedded HTML always stays text. */
export function InlineMarkdown({ text }: { text: string }) {
  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return (
            <strong key={index} className="text-[#c4f477]">
              {part.slice(2, -2)}
            </strong>
          );
        if (part.startsWith("`") && part.endsWith("`"))
          return (
            <code
              key={index}
              className="rounded bg-white/5 px-1 text-[#a6d1e7]"
            >
              {part.slice(1, -1)}
            </code>
          );
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={index}>{part.slice(1, -1)}</em>;
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
}
