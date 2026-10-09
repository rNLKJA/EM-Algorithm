import Link from "next/link";
import { LogoMark } from "./logo-mark";
import { nav, repoFile, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 bg-background/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-5 w-7" />
            <span className="font-heading font-semibold">{site.name}</span>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            A personal project by {site.author}. The explainer and notebook were written in 2025;
            this site was built around them in 2026. The originals are preserved unchanged in{" "}
            <a className="link" href={`${site.repo}/tree/main/original`}>
              original/
            </a>
            , and every number shown here comes from re-running that notebook or from a TypeScript
            port tested against it.
          </p>
        </div>
        <div>
          <h2 className="eyebrow mb-3">Explore</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link className="hover:underline" href="/">
                Overview
              </Link>
            </li>
            {nav.map((item) => (
              <li key={item.href}>
                <Link className="hover:underline" href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="eyebrow mb-3">Source</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <a className="hover:underline" href={site.repo}>
                GitHub repository
              </a>
            </li>
            <li>
              <a className="hover:underline" href={repoFile("original/em-explainer.md")}>
                The original explainer
              </a>
            </li>
            <li>
              <a className="hover:underline" href={repoFile("original/em_algorithm_demo.ipynb")}>
                The original notebook
              </a>
            </li>
            <li>
              <a className="hover:underline" href={repoFile("scripts/export_parity.py")}>
                Parity export script
              </a>
            </li>
            <li>
              <a className="hover:underline" href={repoFile("LICENSE")}>
                MIT licence
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
