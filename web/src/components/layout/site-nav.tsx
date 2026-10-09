"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { nav } from "@/lib/site";

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {nav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "text-foreground",
            )}
          >
            {item.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-comp-1"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  // Close automatically after navigating: the menu is open only for the path it was opened on.
  const open = openFor === pathname;
  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpenFor(open ? null : pathname)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full border-b bg-background/95 px-4 pt-2 pb-4 backdrop-blur"
        >
          <ul className="grid gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(
                    "flex items-baseline justify-between rounded-lg px-3 py-2.5 hover:bg-muted",
                    pathname === item.href && "bg-muted",
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-sm text-muted-foreground">{item.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
