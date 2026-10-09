import type { Metadata } from "next";

export const DEFAULT_SITE_URL = "https://em-algorithm-lab.vercel.app";

/**
 * The canonical and Open Graph base URL. An unset or blank NEXT_PUBLIC_SITE_URL
 * (a copied .env.example leaves it empty) means the production domain; anything
 * else is used as given, so a malformed value still fails the build loudly in
 * `new URL()` rather than being ignored.
 */
export function resolveSiteUrl(raw: string | undefined): string {
  return raw?.trim() || DEFAULT_SITE_URL;
}

export const site = {
  name: "EM, one step at a time",
  shortName: "EM Lab",
  description:
    "An interactive companion to a maths-complete explainer of the Expectation-Maximisation algorithm: step through four ratings by hand, watch a 200-rating Gaussian mixture converge, and see where EM quietly goes wrong.",
  repo: "https://github.com/rNLKJA/EM-Algorithm",
  author: "Sunchuangyu (Rin) Huang",
  authorGithub: "https://github.com/rNLKJA",
  url: resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
} as const;

/** The social card served by app/opengraph-image.tsx (alt text kept in sync there). */
export const shareImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "EM, one step at a time: an interactive companion to an EM algorithm explainer",
  type: "image/png",
};

export const nav = [
  { href: "/stepper", label: "Stepper", blurb: "Four ratings, by hand" },
  { href: "/playground", label: "Playground", blurb: "200 ratings, live" },
  { href: "/pitfalls", label: "Pitfalls", blurb: "Where EM goes wrong" },
  { href: "/inference", label: "Inference", blurb: "How sure, how many" },
  { href: "/maths", label: "Maths", blurb: "The derivations" },
  { href: "/methods", label: "Methods", blurb: "Decisions and the model card" },
  { href: "/tour", label: "Tour", blurb: "Recorded walkthroughs" },
] as const;

/**
 * The git ref that links to the source point at. A deployment can pin it to the
 * commit it was built from (`NEXT_PUBLIC_REPO_REF`, e.g. passed with
 * `vercel deploy --build-env`), so files that are not on main yet still resolve;
 * otherwise links follow main.
 */
export const repoRef = process.env.NEXT_PUBLIC_REPO_REF?.trim() || "main";

export function repoFile(path: string): string {
  return `${site.repo}/blob/${repoRef}/${path}`;
}

export function repoTree(path: string): string {
  return `${site.repo}/tree/${repoRef}/${path}`;
}

/**
 * Metadata for a page: its own title and description for search results and link
 * previews (the root layout's Open Graph block would otherwise be inherited as is),
 * and a canonical URL resolved against `metadataBase` (NEXT_PUBLIC_SITE_URL).
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title?: string;
  description: string;
  path: string;
}): Metadata {
  const shareTitle = title ?? site.name;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      title: shareTitle,
      description,
      url: path,
      type: "website",
      siteName: site.name,
      locale: "en_AU",
      // a page's own openGraph block replaces the root one, file-based image included
      images: [shareImage],
    },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [shareImage] },
  };
}
