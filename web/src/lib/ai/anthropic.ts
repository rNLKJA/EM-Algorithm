/**
 * Anthropic Messages API adapter, called directly from the visitor's browser
 * with their own key (`anthropic-dangerous-direct-browser-access: true` enables
 * CORS for this). Plain `fetch` keeps the bundle small and lets the tests mock
 * the network; the request follows the Messages API: POST /v1/messages with
 * structured output through `output_config.format` (JSON schema).
 */
import { AiError, kindFromStatus, readErrorBody } from "./errors";
import { anthropicSupportsEffort } from "./models";
import { redactSecrets } from "./redact";
import type { ProviderResponse, StructuredRequest } from "./types";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

export function buildAnthropicBody(req: StructuredRequest): Record<string, unknown> {
  const outputConfig: Record<string, unknown> = {
    format: { type: "json_schema", schema: req.schema },
  };
  // a short explanation grounded in given numbers does not need deep reasoning
  if (anthropicSupportsEffort(req.model)) outputConfig.effort = "low";
  return {
    model: req.model,
    max_tokens: req.maxTokens ?? 16000,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
    output_config: outputConfig,
  };
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessage {
  model?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export async function callAnthropic(req: StructuredRequest): Promise<ProviderResponse> {
  const doFetch = req.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": req.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(buildAnthropicBody(req)),
      signal: req.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new AiError("aborted", "Request cancelled");
    // fetch rejects on network failure and on CORS rejection alike
    throw new AiError("network", "Network or CORS error while calling api.anthropic.com");
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new AiError(
      kindFromStatus(res.status, body.type),
      redactSecrets(body.message ?? res.statusText ?? "Request failed", req.apiKey),
      res.status,
    );
  }

  const msg = (await res.json()) as AnthropicMessage;
  if (msg.stop_reason === "refusal") throw new AiError("refusal", "The model declined to answer");
  if (msg.stop_reason === "max_tokens")
    throw new AiError("truncated", "The answer hit the token limit");
  // thinking blocks (if any) come first; the answer is in the text blocks
  const text = (msg.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  return {
    text,
    model: msg.model ?? req.model,
    stopReason: msg.stop_reason ?? null,
    usage:
      msg.usage && typeof msg.usage.input_tokens === "number"
        ? { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens ?? 0 }
        : null,
  };
}
