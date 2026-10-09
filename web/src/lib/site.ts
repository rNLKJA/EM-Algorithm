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

export const nav = [
  { href: "/stepper", label: "Stepper", blurb: "Four ratings, by hand" },
  { href: "/playground", label: "Playground", blurb: "200 ratings, live" },
  { href: "/pitfalls", label: "Pitfalls", blurb: "Where EM goes wrong" },
  { href: "/inference", label: "Inference", blurb: "How sure, how many" },
  { href: "/maths", label: "Maths", blurb: "The derivations" },
  { href: "/methods", label: "Methods", blurb: "Decisions and the model card" },
] as const;

export function repoFile(path: string): string {
  return `${site.repo}/blob/main/${path}`;
}
