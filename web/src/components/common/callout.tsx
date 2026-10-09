import { CircleAlert, Info, PenLine, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const STYLES = {
  correction: {
    icon: PenLine,
    box: "border-correction/40 bg-correction-bg text-foreground",
    iconClass: "text-correction",
  },
  note: { icon: Info, box: "border-border bg-muted/60", iconClass: "text-muted-foreground" },
  warning: {
    icon: CircleAlert,
    box: "border-destructive/35 bg-destructive/[0.06]",
    iconClass: "text-destructive",
  },
  ok: { icon: ShieldCheck, box: "border-ok/35 bg-ok/[0.07]", iconClass: "text-ok" },
} as const;

export function Callout({
  variant = "note",
  title,
  children,
  className,
}: {
  variant?: keyof typeof STYLES;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const style = STYLES[variant];
  const Icon = style.icon;
  return (
    <aside
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3.5 text-[0.95rem] leading-relaxed",
        style.box,
        className,
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4.5 shrink-0", style.iconClass)} />
      <div className="min-w-0 space-y-1.5">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-foreground/85">{children}</div>
      </div>
    </aside>
  );
}

/** Small inline label used next to corrected numbers. */
export function CorrectionTag({ children = "corrected" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-correction-bg px-2 py-0.5 font-sans text-[0.7rem] font-semibold tracking-wide text-correction uppercase">
      <PenLine aria-hidden className="size-3" />
      {children}
    </span>
  );
}
