import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-16">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] font-semibold sm:text-5xl">{title}</h1>
      {children && (
        <div className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
    </header>
  );
}
