import "server-only";
import katex from "katex";
import { cn } from "@/lib/utils";

const MACROS = {
  "\\R": "\\mathbb{R}",
};

function render(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: true,
    strict: "ignore",
    output: "htmlAndMathml",
    macros: { ...MACROS },
  });
}

/** Inline maths, rendered to HTML at build time (no KaTeX JavaScript ships to the browser). */
export function M({ children }: { children: string }) {
  return <span dangerouslySetInnerHTML={{ __html: render(children, false) }} />;
}

/** Display maths block. */
export function MathBlock({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn("my-4 overflow-x-auto", className)}
      dangerouslySetInnerHTML={{ __html: render(children, true) }}
    />
  );
}
