import Link from "next/link";
import { Button } from "@/components/ui/button";
import { nav } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start px-4 py-24 sm:px-6">
      <p className="eyebrow">404 · not found</p>
      <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">
        This page has a responsibility of <span className="num">0.0000</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">
        No component of this site claims the address you asked for. Try one of these instead.
      </p>
      <ul className="mt-8 flex flex-wrap gap-2">
        <li>
          <Button asChild className="rounded-full">
            <Link href="/">Overview</Link>
          </Button>
        </li>
        {nav.map((item) => (
          <li key={item.href}>
            <Button asChild variant="outline" className="rounded-full">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
