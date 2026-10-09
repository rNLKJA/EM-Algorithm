import { cn } from "@/lib/utils";

/** A notebook-style output block: monospace, labelled, scrollable. */
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
        className="num overflow-auto px-3.5 py-3 text-[0.8rem] leading-relaxed whitespace-pre text-foreground/90"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </pre>
    </figure>
  );
}
