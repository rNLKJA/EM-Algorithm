import { cn } from "@/lib/utils";

/**
 * A notebook-style output block: monospace, labelled, scrollable. On phones long lines
 * wrap (indentation kept) rather than run off the edge; from sm up they scroll as printed.
 */
export function ConsoleBlock({
  label,
  children,
  className,
  maxHeight,
}: {
  label: string;
  children: string;
  className?: string;
  maxHeight?: number;
}) {
  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-muted/50", className)}>
      <figcaption className="flex items-center gap-2 border-b px-3.5 py-2 font-mono text-[0.72rem] tracking-wide text-muted-foreground">
        <span aria-hidden className="inline-block size-2 rounded-full bg-comp-2/70" />
        {label}
      </figcaption>
      <pre
        tabIndex={0}
        className="num overflow-auto px-3.5 py-3 text-[0.8rem] leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground/90 sm:whitespace-pre"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </pre>
    </figure>
  );
}
