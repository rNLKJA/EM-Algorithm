/**
 * A mocked AI provider for the tour. No real key is ever used: a placeholder
 * (not a credential) is put in sessionStorage where the site keeps a visitor's
 * key, every request to the providers is intercepted inside the test browser,
 * and the reply is written here from the numbers in the request itself.
 *
 * The mocked reply names itself as a mock (model id and headline), uses only
 * numbers from the snapshot it was sent (so the site's grounding check passes
 * for the right reason) and reports no token usage, because there was none.
 */
import type { BrowserContext, Request } from "@playwright/test";

import { MOCK_MODEL_ID } from "../src/lib/showcase";

/** Not a credential: an obviously fake placeholder the site's key store will hand to the adapter. */
export const PLACEHOLDER_KEY = "placeholder-not-a-real-key";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

interface Params {
  pi1: number;
  pi2: number;
  mu1: number;
  mu2: number;
  sigma1: number;
  sigma2: number;
}

interface Snapshot {
  iteration: number;
  n: number;
  parameters_before: Params;
  parameters_after: Params;
  responsibilities?: { rating: number; gamma1: number; gamma2: number }[];
  responsibility_summary?: {
    ratings_more_likely_component1: number;
    ratings_more_likely_component2: number;
    share_component1: number;
  };
  log_likelihood_before: number;
  log_likelihood_after: number;
  log_likelihood_change: number;
  stopping_rule: { tolerance: number; status: string };
}

/** The JSON snapshot embedded in the site's user prompt. */
export function snapshotFromPrompt(prompt: string): Snapshot {
  const start = prompt.indexOf("{");
  if (start < 0) throw new Error(`No snapshot in prompt: ${prompt.slice(0, 200)}`);
  return JSON.parse(prompt.slice(start)) as Snapshot;
}

/** A plain-language reading built only from the snapshot's own numbers. */
export function mockedExplanation(s: Snapshot) {
  const b = s.parameters_before;
  const a = s.parameters_after;
  const label: Record<keyof Params, string> = {
    pi1: "π₁",
    pi2: "π₂",
    mu1: "μ₁",
    mu2: "μ₂",
    sigma1: "σ₁",
    sigma2: "σ₂",
  };
  const moved = (k: keyof Params) =>
    b[k] === a[k] ? `${label[k]} stayed at ${a[k]}` : `${label[k]} went from ${b[k]} to ${a[k]}`;
  const eStep = s.responsibilities
    ? (() => {
        const one = s.responsibilities.filter((r) => r.gamma1 > 0.5).map((r) => r.rating);
        const two = s.responsibilities.filter((r) => r.gamma1 <= 0.5).map((r) => r.rating);
        return `Ratings ${one.join(" and ")} lean to component 1 and ${two.join(" and ")} to component 2; each rating's gamma1 and gamma2 add up to 1.`;
      })()
    : `${s.responsibility_summary?.ratings_more_likely_component1} ratings lean to component 1 and ${s.responsibility_summary?.ratings_more_likely_component2} to component 2; component 1's share of the responsibility is ${s.responsibility_summary?.share_component1}.`;
  const unchanged = s.log_likelihood_change === 0;
  return {
    headline: `Mocked response for illustration: iteration ${s.iteration} on ${s.n} ratings, written by the showcase script from the numbers sent.`,
    e_step: eStep,
    m_step: `Using those responsibilities as weights, ${moved("pi1")}, ${moved("mu1")}, ${moved("mu2")}, ${moved("sigma1")} and ${moved("sigma2")}.`,
    log_likelihood: `${
      unchanged
        ? `The log-likelihood stayed at ${s.log_likelihood_after}`
        : `The log-likelihood went from ${s.log_likelihood_before} to ${s.log_likelihood_after}`
    }, a change of ${s.log_likelihood_change} against a tolerance of ${s.stopping_rule.tolerance}; the run's status is "${s.stopping_rule.status}".`,
    caveats: [
      "No model wrote this: the tour intercepted the request inside the test browser and answered it locally, with no API key and no provider call.",
    ],
  };
}

export interface MockAi {
  /** Requests that reached the mock (each one an AI call the app made). */
  calls: number;
  /** Requests to anything else that carried the placeholder (must stay empty). */
  leaks: string[];
}

export async function mockAiProviders(
  context: BrowserContext,
  { latencyMs = 450 }: { latencyMs?: number } = {},
): Promise<MockAi> {
  const state: MockAi = { calls: 0, leaks: [] };

  await context.addInitScript((key) => {
    sessionStorage.setItem("emlab.ai.key.anthropic", key);
  }, PLACEHOLDER_KEY);

  await context.route("https://api.anthropic.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    state.calls += 1;
    const body = JSON.parse(req.postData() ?? "{}") as {
      messages?: { role: string; content: string }[];
    };
    const user = body.messages?.find((m) => m.role === "user")?.content ?? "";
    const explanation = mockedExplanation(snapshotFromPrompt(user));
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({
        id: `msg_mock_${state.calls}`,
        type: "message",
        role: "assistant",
        model: MOCK_MODEL_ID,
        content: [{ type: "text", text: JSON.stringify(explanation) }],
        stop_reason: "end_turn",
        // no usage block: the mock has no token counts to report
      }),
    });
  });

  // The tour never uses OpenAI; block it so nothing can leave the browser.
  await context.route("https://api.openai.com/**", (route) => route.abort("blockedbyclient"));

  context.on("request", (req: Request) => {
    if (req.url().startsWith("https://api.anthropic.com/")) return;
    const headers = JSON.stringify(req.headers());
    const data = req.postData() ?? "";
    if (
      headers.includes(PLACEHOLDER_KEY) ||
      data.includes(PLACEHOLDER_KEY) ||
      req.url().includes(PLACEHOLDER_KEY)
    ) {
      state.leaks.push(req.url());
    }
  });

  return state;
}
