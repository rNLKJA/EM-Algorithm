/**
 * Bring-your-own-key AI: every network call is mocked. The tests pin the
 * request shape (and that the key only ever travels in a header), the error
 * mapping, zod validation, key storage, the audit log and the grounding check.
 */
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { README_INIT, README_RATINGS } from "../em/readme-example";
import { diagnoseStep } from "../em/diagnose";
import { eStep, logLikelihood, mStep } from "../em/em";
import { notebookRun } from "../em/notebook-run";
import {
  ANTHROPIC_URL,
  buildAnthropicBody,
  buildAnthropicHeaders,
  callAnthropic,
  FALLBACK_BETA,
  usedFallback,
} from "./anthropic";
import {
  createBrowserAuditStore,
  createIndexedDbAuditStore,
  createMemoryAuditStore,
  sanitiseEntry,
  toCsv,
  toJson,
  type AuditEntry,
} from "./audit-log";
import { generateStructured, parseStructured } from "./client";
import { AiError, describeAiError, kindFromStatus } from "./errors";
import {
  buildExplainUserPrompt,
  buildIterationSnapshot,
  degenerateStatus,
  EXPLANATION_JSON_SCHEMA,
  ExplanationSchema,
  explanationToText,
  extractNumbers,
  findUngroundedNumbers,
  forDisplay,
  normaliseScientific,
  SNAPSHOT_FIELDS,
} from "./explain-iteration";
import { createKeyStore, normaliseSettings, type StorageLike } from "./key-store";
import { anthropicSupportsEffort, DEFAULT_SETTINGS, isValidModelId } from "./models";
import { buildOpenAiBody, callOpenAi, OPENAI_URL } from "./openai";
import { containsSecret, redactSecrets } from "./redact";
import type { StructuredRequest } from "./types";

const KEY = "sk-ant-api03-TESTKEY-abcdefghijklmnop";
const OPENAI_KEY = "sk-proj-TESTKEY1234567890abcdef";

const explanation = {
  headline: "The groups barely move.",
  e_step: "Ratings 2 and 3 belong to component 1 with gamma1 = 1.",
  m_step: "The means stay at 2.5 and 7.5.",
  log_likelihood: "The change is 0, below the tolerance 1e-6.",
  caveats: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const baseReq = (over: Partial<StructuredRequest> = {}): StructuredRequest => ({
  apiKey: KEY,
  model: "claude-haiku-4-5",
  system: "sys",
  user: "user",
  schema: EXPLANATION_JSON_SCHEMA,
  schemaName: "iteration_explanation",
  ...over,
});

describe("Anthropic adapter", () => {
  it("calls the Messages API from the browser with the key only in a header", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        model: "claude-haiku-4-5",
        content: [{ type: "text", text: JSON.stringify(explanation) }],
        stop_reason: "end_turn",
        usage: { input_tokens: 812, output_tokens: 190 },
      }),
    );
    const res = await callAnthropic(baseReq({ fetchImpl: fetchImpl as unknown as typeof fetch }));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ANTHROPIC_URL);
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(KEY);
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(String(init.body)).not.toContain(KEY);
    const body = JSON.parse(String(init.body));
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.effort).toBeUndefined(); // Haiku rejects effort
    expect(res.usage).toEqual({ input_tokens: 812, output_tokens: 190 });
  });

  it("sends low effort to Sonnet and maps refusal, truncation and HTTP errors", async () => {
    expect(buildAnthropicBody(baseReq({ model: "claude-sonnet-5-5" })).output_config).toMatchObject(
      {
        effort: "low",
      },
    );
    expect(anthropicSupportsEffort("claude-haiku-4-5")).toBe(false);
    const call = (res: Response) =>
      callAnthropic(baseReq({ fetchImpl: (async () => res) as unknown as typeof fetch }));
    await expect(call(jsonResponse({ stop_reason: "refusal", content: [] }))).rejects.toMatchObject(
      {
        kind: "refusal",
      },
    );
    await expect(
      call(jsonResponse({ stop_reason: "max_tokens", content: [] })),
    ).rejects.toMatchObject({ kind: "truncated" });
    const err = await call(
      jsonResponse(
        { error: { type: "authentication_error", message: `invalid x-api-key ${KEY}` } },
        401,
      ),
    ).catch((e: AiError) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe("invalid_key");
    expect((err as AiError).message).not.toContain(KEY);
    await expect(
      call(jsonResponse({ error: { type: "rate_limit_error", message: "slow down" } }, 429)),
    ).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("opts Sonnet 5.5 into the server-side refusal fallback, and only Sonnet 5.5", () => {
    const sonnet = baseReq({ model: "claude-sonnet-5-5" });
    expect(buildAnthropicBody(sonnet).fallbacks).toBe("default");
    expect(buildAnthropicHeaders(sonnet)["anthropic-beta"]).toBe(FALLBACK_BETA);
    expect(FALLBACK_BETA).toBe("server-side-fallback-2026-07-01");
    const haiku = baseReq();
    expect(buildAnthropicBody(haiku)).not.toHaveProperty("fallbacks");
    expect(buildAnthropicHeaders(haiku)).not.toHaveProperty("anthropic-beta");
    // the key travels in the x-api-key header only, never in the body
    expect(JSON.stringify(buildAnthropicBody(sonnet))).not.toContain(KEY);
  });

  it("keeps the reply, usage and model of a refused or truncated call for the audit log", async () => {
    const call = (body: unknown) =>
      callAnthropic(
        baseReq({
          model: "claude-sonnet-5-5",
          fetchImpl: (async () => jsonResponse(body)) as unknown as typeof fetch,
        }),
      ).catch((e: AiError) => e);
    const refused = (await call({
      model: "claude-sonnet-5-5",
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "general_harms" },
      content: [{ type: "text", text: "partial" }],
      usage: { input_tokens: 900, output_tokens: 12 },
    })) as AiError;
    expect(refused.kind).toBe("refusal");
    expect(refused.message).toMatch(/general_harms/);
    expect(refused.raw).toBe("partial");
    expect(refused.usage).toEqual({ input_tokens: 900, output_tokens: 12 });
    expect(refused.model).toBe("claude-sonnet-5-5");
    const cut = (await call({
      model: "claude-sonnet-5-5",
      stop_reason: "max_tokens",
      content: [{ type: "text", text: '{"headline": "The gro' }],
      usage: { input_tokens: 900, output_tokens: 4000 },
    })) as AiError;
    expect(cut.kind).toBe("truncated");
    expect(cut.raw).toBe('{"headline": "The gro');
    expect(cut.usage?.output_tokens).toBe(4000);
  });

  it("records when the server-side fallback answered instead of the requested model", async () => {
    const call = (body: unknown) =>
      callAnthropic(
        baseReq({
          model: "claude-sonnet-5-5",
          fetchImpl: (async () => jsonResponse(body)) as unknown as typeof fetch,
        }),
      );
    // a switch point in the content, and the fallback run in usage.iterations
    const rescued = await call({
      model: "claude-opus-5-5",
      content: [
        {
          type: "fallback",
          from: { model: "claude-sonnet-5-5" },
          to: { model: "claude-opus-5-5" },
        },
        { type: "text", text: JSON.stringify(explanation) },
      ],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 900,
        output_tokens: 200,
        iterations: [{ type: "message" }, { type: "fallback_message" }],
      },
    });
    expect(rescued.fallback).toBe(true);
    expect(rescued.model).toBe("claude-opus-5-5");
    expect(rescued.text).toBe(JSON.stringify(explanation)); // the fallback block is not text
    // a sticky turn carries no block, only the usage entry
    expect(
      usedFallback({ content: [], usage: { iterations: [{ type: "fallback_message" }] } }),
    ).toBe(true);
    // an ordinary reply
    const plain = await call({
      model: "claude-sonnet-5-5",
      content: [{ type: "text", text: JSON.stringify(explanation) }],
      stop_reason: "end_turn",
      usage: { input_tokens: 900, output_tokens: 200, iterations: [{ type: "message" }] },
    });
    expect(plain.fallback).toBe(false);
    // the fallback model can decline too: the error keeps the flag for the audit log
    const refused = await call({
      model: "claude-opus-5-5",
      content: [
        {
          type: "fallback",
          from: { model: "claude-sonnet-5-5" },
          to: { model: "claude-opus-5-5" },
        },
      ],
      stop_reason: "refusal",
      usage: { input_tokens: 900, output_tokens: 3, iterations: [{ type: "fallback_message" }] },
    }).catch((e: AiError) => e);
    expect(refused).toBeInstanceOf(AiError);
    expect((refused as AiError).fallback).toBe(true);
    expect((refused as AiError).model).toBe("claude-opus-5-5");
  });

  it("reports network/CORS failures and cancellations", async () => {
    await expect(
      callAnthropic(
        baseReq({
          fetchImpl: (async () => {
            throw new TypeError("Failed to fetch");
          }) as unknown as typeof fetch,
        }),
      ),
    ).rejects.toMatchObject({ kind: "network" });
    await expect(
      callAnthropic(
        baseReq({
          fetchImpl: (async () => {
            throw new DOMException("aborted", "AbortError");
          }) as unknown as typeof fetch,
        }),
      ),
    ).rejects.toMatchObject({ kind: "aborted" });
  });
});

describe("OpenAI adapter", () => {
  it("uses Bearer auth and strict json_schema output", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        model: "gpt-5-mini",
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(explanation) } }],
        usage: { prompt_tokens: 700, completion_tokens: 150 },
      }),
    );
    const res = await callOpenAi({
      ...baseReq({ apiKey: OPENAI_KEY, model: "gpt-5-mini" }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENAI_URL);
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(String(init.body)).not.toContain(OPENAI_KEY);
    const body = buildOpenAiBody(baseReq({ model: "gpt-5-mini" }));
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
    expect(res.usage).toEqual({ input_tokens: 700, output_tokens: 150 });
  });

  it("maps refusals and length stops", async () => {
    const call = (res: Response) =>
      callOpenAi(baseReq({ fetchImpl: (async () => res) as unknown as typeof fetch }));
    await expect(
      call(jsonResponse({ choices: [{ message: { refusal: "no" } }] })),
    ).rejects.toMatchObject({ kind: "refusal" });
    await expect(
      call(jsonResponse({ choices: [{ finish_reason: "length", message: { content: "{" } }] })),
    ).rejects.toMatchObject({ kind: "truncated", raw: "{" });
    await expect(
      call(
        jsonResponse({
          model: "gpt-5-mini",
          choices: [{ message: { refusal: "I can't help with that." } }],
          usage: { prompt_tokens: 700, completion_tokens: 9 },
        }),
      ),
    ).rejects.toMatchObject({
      kind: "refusal",
      raw: "I can't help with that.",
      usage: { input_tokens: 700, output_tokens: 9 },
      model: "gpt-5-mini",
    });
  });
});

describe("structured client", () => {
  it("refuses to call without a key", async () => {
    const fetchImpl = vi.fn();
    await expect(
      generateStructured({
        provider: "anthropic",
        apiKey: null,
        model: "claude-haiku-4-5",
        system: "s",
        user: "u",
        schemaName: "x",
        jsonSchema: EXPLANATION_JSON_SCHEMA,
        validator: ExplanationSchema,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "no_key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("validates the reply with zod and measures latency", async () => {
    let t = 1000;
    const res = await generateStructured({
      provider: "anthropic",
      apiKey: KEY,
      model: "claude-haiku-4-5",
      system: "s",
      user: "u",
      schemaName: "x",
      jsonSchema: EXPLANATION_JSON_SCHEMA,
      validator: ExplanationSchema,
      now: () => (t += 250),
      fetchImpl: (async () =>
        jsonResponse({
          content: [{ type: "text", text: JSON.stringify(explanation) }],
          stop_reason: "end_turn",
        })) as unknown as typeof fetch,
    });
    expect(res.data.headline).toBe(explanation.headline);
    expect(res.latencyMs).toBe(250);
    expect(() => parseStructured("not json", ExplanationSchema)).toThrow(AiError);
    expect(() => parseStructured(JSON.stringify({ headline: "x" }), ExplanationSchema)).toThrow(
      /schema/,
    );
  });

  it("keeps the raw reply and usage when the reply fails validation", async () => {
    const bad = JSON.stringify({ headline: "only a headline" });
    const err = await generateStructured({
      provider: "anthropic",
      apiKey: KEY,
      model: "claude-haiku-4-5",
      system: "s",
      user: "u",
      schemaName: "x",
      jsonSchema: EXPLANATION_JSON_SCHEMA,
      validator: ExplanationSchema,
      fetchImpl: (async () =>
        jsonResponse({
          model: "claude-haiku-4-5",
          content: [{ type: "text", text: bad }],
          stop_reason: "end_turn",
          usage: { input_tokens: 800, output_tokens: 20 },
        })) as unknown as typeof fetch,
    }).catch((e: AiError) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).kind).toBe("invalid_output");
    expect((err as AiError).raw).toBe(bad);
    expect((err as AiError).usage).toEqual({ input_tokens: 800, output_tokens: 20 });
    expect((err as AiError).model).toBe("claude-haiku-4-5");
  });

  it("accepts any reply that obeys the JSON schema, and shortens it only for display", () => {
    const long = {
      ...explanation,
      e_step: "x".repeat(1500),
      caveats: ["one", "two", "three", "four", "five"],
    };
    // the JSON schema sent to the provider has no item or length limits, so neither does zod
    const parsed = parseStructured(JSON.stringify(long), ExplanationSchema);
    expect(parsed.caveats).toHaveLength(5);
    const shown = forDisplay(parsed);
    expect(shown.shortened).toBe(true);
    expect(shown.explanation.caveats).toEqual(["one", "two", "three", "four"]);
    expect(shown.explanation.e_step.length).toBeLessThanOrEqual(1200);
    expect(shown.explanation.e_step.endsWith("…")).toBe(true);
    expect(forDisplay(explanation).shortened).toBe(false);
    expect(forDisplay(explanation).explanation).toEqual(explanation);
  });

  it("explains errors in plain language", () => {
    expect(kindFromStatus(529)).toBe("overloaded");
    expect(kindFromStatus(500)).toBe("server");
    expect(kindFromStatus(400, "insufficient_quota")).toBe("billing");
    expect(describeAiError(new AiError("network", "x"))).toMatch(/CORS/);
    expect(describeAiError(new Error("x"))).toMatch(/Something went wrong/);
    expect(new AiError("rate_limited", "x").retryable).toBe(true);
  });
});

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("key store", () => {
  it("keeps the key for the session by default, on the device only when asked", () => {
    const session = memoryStorage();
    const local = memoryStorage();
    const store = createKeyStore(() => ({ session, local }));
    store.setKey("anthropic", `  ${KEY}  `, false);
    expect(store.getKey("anthropic")).toBe(KEY);
    expect(store.keyLocation("anthropic")).toBe("session");
    expect([...local.data.values()].join()).not.toContain(KEY);
    store.setKey("anthropic", KEY, true);
    expect(store.keyLocation("anthropic")).toBe("device");
    expect(session.data.size).toBe(0);
    store.forgetKey("anthropic");
    expect(store.getKey("anthropic")).toBeNull();
    store.setKey("openai", OPENAI_KEY, false);
    store.forgetAll();
    expect(store.getKey("openai")).toBeNull();
  });

  it("stores only non-secret settings and drops a key pasted as a model", () => {
    const local = memoryStorage();
    const store = createKeyStore(() => ({ session: null, local }));
    expect(store.getSettings()).toEqual(DEFAULT_SETTINGS);
    store.setSettings({
      provider: "openai",
      anthropicModel: "claude-sonnet-5-5",
      openaiModel: OPENAI_KEY,
    });
    const saved = store.getSettings();
    expect(saved.provider).toBe("openai");
    expect(saved.anthropicModel).toBe("claude-sonnet-5-5");
    expect(saved.openaiModel).toBe(DEFAULT_SETTINGS.openaiModel);
    expect([...local.data.values()].join()).not.toContain("TESTKEY");
    expect(normaliseSettings({ anthropicModel: "claude-unknown" }).anthropicModel).toBe(
      DEFAULT_SETTINGS.anthropicModel,
    );
    expect(isValidModelId("gpt-5-mini")).toBe(true);
    expect(isValidModelId("has space")).toBe(false);
  });
});

describe("redaction", () => {
  it("removes keys and key-like tokens", () => {
    expect(redactSecrets(`Incorrect API key provided: ${OPENAI_KEY}`)).not.toContain("TESTKEY");
    expect(redactSecrets("x-api-key: abc123456789")).toBe("[redacted key]");
    expect(redactSecrets("custom-secret-value", "custom-secret-value")).toBe("[redacted key]");
    expect(containsSecret({ nested: [KEY] })).toBe(true);
    expect(containsSecret("μ = 7.5")).toBe(false);
  });
});

function entry(over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: "e1",
    timestamp: "2026-10-09T01:00:00.000Z",
    feature: "explain-iteration",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    input: { system: "sys", user: "{}" },
    output: JSON.stringify(explanation),
    status: "ok",
    latency_ms: 900,
    usage: { input_tokens: 800, output_tokens: 200 },
    decision: "pending",
    ...over,
  };
}

describe("audit log", () => {
  it("never stores the key, even when a provider echoes it", () => {
    const e = sanitiseEntry(
      entry({
        output: null,
        status: "error",
        error: { kind: "invalid_key", message: `bad ${KEY}` },
      }),
      KEY,
    );
    expect(JSON.stringify(e)).not.toContain(KEY);
  });

  it("exports CSV with escaping and formula-injection guards, and JSON", () => {
    const csv = toCsv([
      entry({ edited_output: '=HYPERLINK("x")', input: { system: "a,b", user: 'say "hi"' } }),
    ]);
    const [header, row] = csv.trim().split("\r\n");
    expect(header.split(",")).toContain("latency_ms");
    // which model was asked, which answered, and whether the fallback ran
    expect(header.split(",").slice(3, 7)).toEqual([
      "provider",
      "requested_model",
      "model",
      "fallback",
    ]);
    const fb = toCsv([
      entry({ requested_model: "claude-sonnet-5-5", model: "claude-opus-5-5", fallback: true }),
    ])
      .trim()
      .split("\r\n")[1]
      .split(",");
    expect(fb.slice(3, 7)).toEqual(["anthropic", "claude-sonnet-5-5", "claude-opus-5-5", "true"]);
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain('"a,b"');
    expect(JSON.parse(toJson([entry()])).entries).toHaveLength(1);
  });

  it("memory and IndexedDB stores add, update the human decision, list newest first and clear", async () => {
    for (const store of [createMemoryAuditStore(), createIndexedDbAuditStore(new IDBFactory())]) {
      await store.add(entry());
      await store.add(entry({ id: "e2", timestamp: "2026-10-09T02:00:00.000Z" }));
      const updated = await store.update("e1", {
        decision: "edited",
        edited_output: `edited with ${KEY}`,
      });
      expect(updated?.decision).toBe("edited");
      expect(updated?.edited_output).not.toContain(KEY);
      expect((await store.list()).map((e) => e.id)).toEqual(["e2", "e1"]);
      expect(await store.update("missing", { decision: "accepted" })).toBeNull();
      await store.clear();
      expect(await store.list()).toHaveLength(0);
    }
  });

  it("falls back to memory when IndexedDB is unavailable", async () => {
    const store = createBrowserAuditStore(null);
    expect(store.persistence()).toBe("memory");
    await store.add(entry());
    expect(await store.list()).toHaveLength(1);
  });
});

describe("explain this iteration", () => {
  const data = [...README_RATINGS];
  const before = { pi1: 0.5, pi2: 0.5, mu1: 4, mu2: 6, sigma1: 2, sigma2: 2 };
  const e = eStep(data, before);
  const after = mStep(data, e.gamma1, e.gamma2);
  const snapshot = buildIterationSnapshot({
    source: "stepper",
    dataset: "four ratings",
    data,
    iteration: 1,
    stage: "m",
    before,
    after,
    e,
    logLikelihoodBefore: logLikelihood(data, before),
    logLikelihoodAfter: logLikelihood(data, after),
    stopping: { tolerance: 1e-6, maxIterations: 15, status: "continuing" },
  });

  it("sends every responsibility for the four ratings, and nothing secret", () => {
    expect(snapshot.responsibilities).toHaveLength(4);
    expect(snapshot.responsibility_summary).toBeUndefined();
    expect(snapshot.stage_on_screen).toMatch(/M-step/);
    expect(snapshot.parameters_after.mu1).toBeCloseTo(after.mu1, 3);
    const prompt = buildExplainUserPrompt(snapshot);
    expect(prompt).toContain('"iteration": 1');
    expect(containsSecret(prompt)).toBe(false);
  });

  it("summarises the responsibilities of a 200-rating data set", () => {
    const p = notebookRun.init;
    const big = buildIterationSnapshot({
      source: "playground",
      dataset: "notebook",
      data: notebookRun.ratings,
      iteration: 1,
      before: p,
      after: notebookRun.iterations[0].params,
      e: eStep(notebookRun.ratings, p),
      logLikelihoodBefore: logLikelihood(notebookRun.ratings, p),
      logLikelihoodAfter: notebookRun.iterations[0].logLikelihood,
      stopping: { tolerance: 1e-4, maxIterations: 15, status: "continuing" },
    });
    expect(big.responsibilities).toBeUndefined();
    const s = big.responsibility_summary!;
    expect(s.ratings_more_likely_component1 + s.ratings_more_likely_component2).toBe(200);
    expect(s.share_component1 + s.share_component2).toBeCloseTo(1, 3);
    expect(s.gamma1_at_rating).toHaveLength(5);
    expect(JSON.stringify(big).length).toBeLessThan(4000);
  });

  it("sends only the fields the AI use statement on /methods lists", () => {
    const p = notebookRun.init;
    const playground = buildIterationSnapshot({
      source: "playground",
      dataset: "notebook",
      data: notebookRun.ratings,
      iteration: 1,
      before: p,
      after: notebookRun.iterations[0].params,
      e: eStep(notebookRun.ratings, p),
      logLikelihoodBefore: logLikelihood(notebookRun.ratings, p),
      logLikelihoodAfter: notebookRun.iterations[0].logLikelihood,
      stopping: { tolerance: 1e-4, maxIterations: 15, status: "collapsed" },
    });
    const listed = new Set<string>(SNAPSHOT_FIELDS.flatMap((f) => f.keys));
    const sent = new Set([...Object.keys(snapshot), ...Object.keys(playground)]);
    expect([...sent].filter((k) => !listed.has(k))).toEqual([]);
    // and the list has nothing that is never sent
    expect([...listed].filter((k) => !sent.has(k))).toEqual([]);
  });

  it("flags numbers that are not in the snapshot", () => {
    const ok = `μ₁ moved from 4 to ${snapshot.parameters_after.mu1} and π₁ is now ${snapshot.parameters_after.pi1}.`;
    expect(findUngroundedNumbers(ok, snapshot)).toEqual([]);
    expect(findUngroundedNumbers("The mean jumped to 42.7.", snapshot)).toEqual(["42.7"]);
    expect(findUngroundedNumbers("It covers 50% of the ratings.", snapshot)).toEqual([]);
    expect(extractNumbers("gamma1 = 0.25, x2 and −1.5").map((n) => n.value)).toEqual([0.25, -1.5]);
    const text = explanationToText({ ...explanation, caveats: ["Only one iteration."] });
    expect(text).toContain("Caveat: Only one iteration.");
  });

  it("reads scientific notation, exponent included", () => {
    expect(normaliseScientific("1.5 × 10⁻⁵ and 10^-6 and 2 x 10^(-3)")).toBe(
      "1.5e-5 and 1e-6 and 2e-3",
    );
    expect(
      extractNumbers("tolerance 1.0e-6").map((n) => [n.value, n.decimals, n.exponent]),
    ).toEqual([[1e-6, 1, -6]]);
    // the snapshot's tolerance is 1e-6, written in every common form
    for (const ok of [
      "below the tolerance 1e-6",
      "below the tolerance 1.0e-6",
      "below the tolerance 10^-6",
      "below the tolerance 10⁻⁶",
      "below the tolerance 1 × 10⁻⁶",
      "below the tolerance 1E-06",
    ])
      expect(findUngroundedNumbers(ok, snapshot)).toEqual([]);
  });

  it("flags invented numbers in scientific notation", () => {
    // 3.1e-2 means 0.031 ± 0.0005, not ± 0.05; integer mantissas are not small counts
    expect(
      findUngroundedNumbers("The change 3.1e-2 is above the tolerance 1.5e-5", snapshot),
    ).toEqual(["3.1e-2", "1.5e-5"]);
    expect(findUngroundedNumbers("The change 3e-2 is above 1e-5", snapshot)).toEqual([
      "3e-2",
      "1e-5",
    ]);
    expect(findUngroundedNumbers("a change of 2e-7", snapshot)).toEqual(["2e-7"]);
    expect(findUngroundedNumbers("the tolerance is 10⁻⁵", snapshot)).toEqual(["1e-5"]);
    // whole numbers from 0 to 10 written plainly are still left alone
    expect(findUngroundedNumbers("two components and 7 ratings", snapshot)).toEqual([]);
  });

  it("names a breakdown after its cause, so underflow is not called a collapse", () => {
    // rating 8 sits 100 or more standard deviations from both means: both densities are 0
    const narrow = { pi1: 0.5, pi2: 0.5, mu1: 2, mu2: 3, sigma1: 0.05, sigma2: 0.05 };
    const eNarrow = eStep(data, narrow);
    const broken = mStep(data, eNarrow.gamma1, eNarrow.gamma2);
    const status = degenerateStatus(diagnoseStep(data, narrow, broken));
    expect(status).toBe("numerical-underflow");
    expect(degenerateStatus({ kind: "empty", component: 2 })).toBe("component-emptied");
    expect(degenerateStatus({ kind: "collapse", component: 1, sigma: 0 })).toBe("collapsed");
    expect(degenerateStatus(null)).toBe("collapsed");

    const s = buildIterationSnapshot({
      source: "stepper",
      dataset: "four ratings",
      data,
      iteration: 1,
      before: narrow,
      after: broken,
      e: eNarrow,
      logLikelihoodBefore: logLikelihood(data, narrow),
      logLikelihoodAfter: Number.NaN,
      stopping: { tolerance: 1e-6, maxIterations: 15, status },
    });
    expect(s.stopping_rule.status).toBe("numerical-underflow");
    expect(s.notes.at(-1)).toMatch(/not a variance collapse/);
    // an ordinary iteration carries only the three standing notes
    expect(snapshot.notes).toHaveLength(3);
  });

  it("the stepper's explainer start is covered too", () => {
    const e0 = eStep(data, README_INIT);
    expect(
      buildIterationSnapshot({
        source: "stepper",
        dataset: "x",
        data,
        iteration: 1,
        before: README_INIT,
        after: mStep(data, e0.gamma1, e0.gamma2),
        e: e0,
        logLikelihoodBefore: 0,
        logLikelihoodAfter: 0,
        stopping: { tolerance: 1e-6, maxIterations: 15, status: "converged" },
      }).responsibilities![1].gamma2,
    ).toBeLessThan(1e-10);
  });
});
