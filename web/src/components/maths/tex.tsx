import "server-only";
import katex from "katex";
import { ScrollX } from "@/components/common/scroll-x";
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

/**
 * Display maths block. Give `narrow` (the same equation broken over lines) for
 * anything too wide for a phone: a container query swaps it in when the block is
 * narrower than 42rem (the maths column is wider than that from tablets up). Whatever still overflows scrolls sideways in a ScrollX box,
 * which becomes focusable (and fades its edge) only when it actually overflows.
 */
export function MathBlock({
  children,
  narrow,
  className,
}: {
  children: string;
  narrow?: string;
  className?: string;
}) {
  const block = (tex: string, extra?: string) => (
    <ScrollX label="Equation" className={cn("overflow-y-hidden", extra)}>
      <div dangerouslySetInnerHTML={{ __html: render(tex, true) }} />
    </ScrollX>
  );
  if (!narrow) return <div className={cn("my-4", className)}>{block(children)}</div>;
  return (
    <div className={cn("@container my-4", className)}>
      {block(children, "@max-2xl:hidden")}
      {block(narrow, "@2xl:hidden")}
    </div>
  );
}
