import Link from "next/link";
import { GithubMark } from "./github-mark";
import { LogoMark } from "./logo-mark";
import { MobileNav, SiteNav } from "./site-nav";
import { ThemeToggle } from "./theme-toggle";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {/* the accessible name is the visible text plus ", home" (WCAG 2.5.3) */}
        <Link href="/" className="group flex items-center gap-2.5 rounded-md pr-2">
          <LogoMark className="h-6 w-8.5 shrink-0" />
          <span className="font-heading text-[1.05rem] leading-none font-semibold tracking-tight">
            EM
            <span className="hidden sm:inline">
              <span className="text-muted-foreground">,</span>{" "}
              <span className="font-normal italic">one step at a time</span>
            </span>
            <span className="font-normal italic sm:hidden"> lab</span>
            <span className="sr-only">, home</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <SiteNav />
          <a
            href={site.repo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Source code on GitHub (opens in a new tab)"
          >
            <GithubMark className="size-4" />
          </a>
          <ThemeToggle />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
