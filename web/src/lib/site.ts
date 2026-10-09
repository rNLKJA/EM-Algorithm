import type { Metadata } from "next";

export const site = {
  name: "EM, one step at a time",
  shortName: "EM Lab",
  description:
    "An interactive companion to a maths-complete explainer of the Expectation-Maximisation algorithm: step through four ratings by hand, watch a 200-rating Gaussian mixture converge, and see where EM quietly goes wrong.",
  repo: "https://github.com/rNLKJA/EM-Algorithm",
  author: "Sunchuangyu (Rin) Huang",
  authorGithub: "https://github.com/rNLKJA",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://em-algorithm-lab.vercel.app",
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
  { href: "/maths", label: "Maths", blurb: "The derivations" },
] as const;

export function repoFile(path: string): string {
  return `${site.repo}/blob/main/${path}`;
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
