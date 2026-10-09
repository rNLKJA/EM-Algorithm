import { cn } from "@/lib/utils";

/** The visual key for a mixture component: colour + marker shape + line style. */
export function ComponentSwatch({ k, className }: { k: 1 | 2; className?: string }) {
  return (
    <svg
      viewBox="0 0 28 14"
      aria-hidden
      className={cn("inline-block h-3.5 w-7 shrink-0", className)}
    >
      <line
        x1="1"
        x2="27"
        y1="7"
        y2="7"
        stroke={k === 1 ? "var(--comp-1)" : "var(--comp-2)"}
        strokeWidth="2.25"
        strokeDasharray={k === 2 ? "5 3" : undefined}
      />
      {k === 1 ? (
        <circle
          cx="14"
          cy="7"
          r="4.4"
          fill="var(--comp-1)"
          stroke="var(--card)"
          strokeWidth="1.5"
        />
      ) : (
        <path
          d="M14,1.8L19,10.6L9,10.6Z"
          fill="var(--comp-2)"
          stroke="var(--card)"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

export function Legend({
  labels = ["Component 1", "Component 2"],
  showMixture = true,
  showTruth = false,
  className,
}: {
  labels?: [string, string];
  showMixture?: boolean;
  showTruth?: boolean;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <li className="flex items-center gap-1.5">
        <ComponentSwatch k={1} />
        {labels[0]}
      </li>
      <li className="flex items-center gap-1.5">
        <ComponentSwatch k={2} />
        {labels[1]}
      </li>
      {showMixture && (
        <li className="flex items-center gap-1.5">
          <svg viewBox="0 0 28 14" aria-hidden className="h-3.5 w-7">
            <line x1="1" x2="27" y1="7" y2="7" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          Mixture
        </li>
      )}
      {showTruth && (
        <li className="flex items-center gap-1.5">
          <svg viewBox="0 0 28 14" aria-hidden className="h-3.5 w-7">
            <line
              x1="1"
              x2="27"
              y1="7"
              y2="7"
              stroke="currentColor"
              strokeOpacity="0.6"
              strokeWidth="1.8"
              strokeDasharray="1.5 4"
              strokeLinecap="round"
            />
          </svg>
          True mixture
        </li>
      )}
    </ul>
  );
}
