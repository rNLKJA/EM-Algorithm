/**
 * Data sets for the playground and the pitfalls page. Only `notebook` is the
 * original data; everything else is generated in the browser with the seeded
 * TS PRNG and labelled "not the original".
 */
import { notebookRun } from "./notebook-run";
import { createRng } from "./rng";

export interface Component {
  weight: number;
  mu: number;
  sigma: number;
}

export interface Dataset {
  id: string;
  label: string;
  description: string;
  ratings: number[];
  /** index of the generating component per point; null when unknown */
  groups: number[] | null;
  original: boolean;
}

/** Any number of normal components, then clipping, using the TS PRNG. */
export function generateMixture(
  components: Component[],
  n: number,
  seed: number,
  clip: [number, number] | null = [1, 10],
): { ratings: number[]; groups: number[] } {
  const rng = createRng(seed);
  const total = components.reduce((s, c) => s + c.weight, 0);
  const groups: number[] = [];
  for (let i = 0; i < n; i++) {
    let u = rng.next() * total;
    let k = 0;
    while (k < components.length - 1 && u >= components[k].weight) {
      u -= components[k].weight;
      k++;
    }
    groups.push(k);
  }
  const ratings = groups.map((k) => {
    const v = rng.normal(components[k].mu, components[k].sigma);
    return clip ? Math.min(clip[1], Math.max(clip[0], v)) : v;
  });
  return { ratings, groups };
}

export const THREE_BUMPS: Component[] = [
  { weight: 0.38, mu: 2.2, sigma: 0.6 },
  { weight: 0.24, mu: 5.4, sigma: 0.6 },
  { weight: 0.38, mu: 8.4, sigma: 0.6 },
];

export function notebookDataset(): Dataset {
  return {
    id: "notebook",
    label: "The notebook's 200 ratings",
    description: "Seed 42, exported from the original notebook.",
    ratings: notebookRun.ratings,
    groups: notebookRun.trueGroups,
    original: true,
  };
}

export function threeBumpsDataset(seed = 11): Dataset {
  const { ratings, groups } = generateMixture(THREE_BUMPS, 240, seed);
  return {
    id: "three-bumps",
    label: "Three bumps, two components",
    description:
      "Made up for this page: three groups of raters, fitted with the notebook's two components.",
    ratings,
    groups,
    original: false,
  };
}
