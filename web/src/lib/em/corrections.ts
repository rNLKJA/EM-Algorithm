/**
 * Numbers in the original explainer that do not survive recomputation. Every
 * "exact" value is computed here (not typed in), and corrections.test.ts pins
 * them. The site shows these beside the as-written values, labelled.
 */
import { betaPdf, normalPdf } from "./gaussian";

export interface Correction {
  id: string;
  /** section heading in original/em-explainer.md */
  section: string;
  quantity: string;
  asWritten: number;
  exact: number;
  /** why the exact value is what it is, in one line */
  why: string;
}

const g = (x: number, mu: number, sigma: number) => normalPdf(x, mu, sigma);

export const CORRECTIONS: Correction[] = [
  {
    id: "readme-f-2",
    section: "A Complete Example: iteration 1, E-step",
    quantity: "normal_pdf(2; 2.5, 0.5)",
    asWritten: 0.8,
    exact: g(2, 2.5, 0.5),
    why: "2 is exactly one standard deviation below 2.5, so the density is φ(1)/0.5.",
  },
  {
    id: "readme-f-3",
    section: "A Complete Example: iteration 1, E-step",
    quantity: "normal_pdf(3; 2.5, 0.5)",
    asWritten: 0.6,
    exact: g(3, 2.5, 0.5),
    why: "3 is also one standard deviation from 2.5, so it must equal the density at 2.",
  },
  {
    id: "readme-cross-3",
    section: "A Complete Example: iteration 1, E-step",
    quantity: "normal_pdf(3; 7.5, 0.5)",
    asWritten: 0.0001,
    exact: g(3, 7.5, 0.5),
    why: "3 is nine standard deviations from 7.5; the density is about 2 × 10⁻¹⁸.",
  },
  {
    id: "readme-cross-2",
    section: "A Complete Example: iteration 1, E-step",
    quantity: "normal_pdf(2; 7.5, 0.5)",
    asWritten: 0.0001,
    exact: g(2, 7.5, 0.5),
    why: "Eleven standard deviations away; the density is about 4 × 10⁻²⁷.",
  },
  {
    id: "estep-scifi",
    section: "E-step: Example Calculation",
    quantity: "f(5 | 4.5, 0.8²)",
    asWritten: 0.47,
    exact: g(5, 4.5, 0.8),
    why: "z = 0.625, so the density is φ(0.625)/0.8 ≈ 0.410.",
  },
  {
    id: "estep-romance",
    section: "E-step: Example Calculation",
    quantity: "f(5 | 3.0, 1.2²)",
    asWritten: 0.12,
    exact: g(5, 3.0, 1.2),
    why: "z ≈ 1.67, so the density is φ(1.67)/1.2 ≈ 0.083.",
  },
  {
    id: "estep-gamma",
    section: "E-step: Example Calculation",
    quantity: "γ (sci-fi | rating 5)",
    asWritten: 0.85,
    exact: (0.6 * g(5, 4.5, 0.8)) / (0.6 * g(5, 4.5, 0.8) + 0.4 * g(5, 3.0, 1.2)),
    why: "Recomputed from the two corrected densities and π = 0.6 / 0.4.",
  },
  {
    id: "beta-0.2",
    section: "Mixed Distributions: Normal + Beta",
    quantity: "Beta(0.2 | α = 2, β = 2)",
    asWritten: 1.2,
    exact: betaPdf(0.2, 2, 2),
    why: "Beta(2, 2) has density 6x(1 − x), and 6 × 0.2 × 0.8 = 0.96.",
  },
  {
    id: "beta-normal-0.2",
    section: "Mixed Distributions: Normal + Beta",
    quantity: "f₁(0.2 | μ = 7, σ = 1)",
    asWritten: 0.0001,
    exact: g(0.2, 7, 1),
    why: "6.8 standard deviations away; about 4 × 10⁻¹¹. The conclusion (γ ≈ 1 for beta) holds.",
  },
];
