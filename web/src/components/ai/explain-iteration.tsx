"use client";

import { Check, KeyRound, Loader2, Pencil, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { openAiSettings, useAiSettings } from "@/hooks/use-ai-settings";
import { auditStore, newEntryId, sanitiseEntry, type AuditEntry } from "@/lib/ai/audit-log";
import { generateStructured } from "@/lib/ai/client";
import { AiError, describeAiError } from "@/lib/ai/errors";
import {
  buildExplainUserPrompt,
  buildIterationSnapshot,
  EXPLAIN_FEATURE,
  EXPLAIN_SYSTEM_PROMPT,
  EXPLANATION_JSON_SCHEMA,
  ExplanationSchema,
  explanationToText,
  findUngroundedNumbers,
  forDisplay,
  GROUNDING_SCOPE,
  type Explanation,
  type IterationInput,
  type IterationSnapshot,
} from "@/lib/ai/explain-iteration";
import { keyStore } from "@/lib/ai/key-store";
import { modelFor, modelLabel, PROVIDER_LABEL } from "@/lib/ai/models";
import { redactSecrets } from "@/lib/ai/redact";
import type { Provider, TokenUsage } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type Decision = "pending" | "accepted" | "edited" | "rejected";

interface Result {
  entryId: string;
  context: string;
  snapshot: IterationSnapshot;
  checks: Record<string, unknown>;
  /** the reply as shown (long fields cut; see forDisplay) */
  explanation: Explanation;
  shortened: boolean;
  /** the full reply as text: what the grounding check reads and the edit box starts from */
  text: string;
  ungrounded: string[];
  provider: Provider;
  model: string;
  /** the model that was asked; differs from `model` when Anthropic's fallback answered */
  requestedModel: string;
  fallback: boolean;
  latencyMs: number;
  usage: TokenUsage | null;
  decision: Decision;
  edited?: string;
}

/**
 * Optional "Explain this iteration" panel (bring your own key). `input` is the
 * iteration on screen (null at the starting guess); `context` identifies it so a
 * stale explanation is marked when the reader moves on.
 */
export function ExplainIteration({
  input,
  context,
  className,
}: {
  input: IterationInput | null;
  context: string;
  className?: string;
}) {
  const { ready, hasKey, settings } = useAiSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [auditNotice, setAuditNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stale = result !== null && result.context !== context;

  /** Write an audit entry, and tell the visitor if it could not be kept. */
  const record = async (entry: AuditEntry, apiKey: string) => {
    const store = auditStore();
    try {
      await store.add(sanitiseEntry(entry, apiKey));
      setAuditNotice(
        store.persistence() === "memory"
          ? "IndexedDB is unavailable in this browser, so this call is recorded for this tab only. Export the log before closing the tab if you need to keep it."
          : null,
      );
    } catch {
      setAuditNotice(
        "This call could not be written to the audit log in this browser. The output is shown, but there is no record of it.",
      );
    }
  };

  const run = async () => {
    if (!input) return;
    const provider = settings.provider;
    const model = modelFor(settings);
    const apiKey = keyStore.getKey(provider);
    if (!apiKey) {
      openAiSettings();
      return;
    }
    setBusy(true);
    setError(null);
    setEditing(false);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const snapshot = buildIterationSnapshot(input);
    const user = buildExplainUserPrompt(snapshot);
    const base = {
      id: newEntryId(),
      timestamp: new Date().toISOString(),
      feature: EXPLAIN_FEATURE,
      provider,
      model,
      requested_model: model,
      input: { system: EXPLAIN_SYSTEM_PROMPT, user },
    };
    const started = performance.now();
    try {
      const res = await generateStructured({
        provider,
        apiKey,
        model,
        system: EXPLAIN_SYSTEM_PROMPT,
        user,
        schemaName: "iteration_explanation",
        jsonSchema: EXPLANATION_JSON_SCHEMA,
        validator: ExplanationSchema,
        maxTokens: 4000,
        signal: controller.signal,
      });
      const text = explanationToText(res.data);
      const shown = forDisplay(res.data);
      const ungrounded = findUngroundedNumbers(text, snapshot);
      const checks = { ungrounded_numbers: ungrounded, context };
      const entry: AuditEntry = {
        ...base,
        model: res.model,
        fallback: res.fallback,
        output: res.raw,
        status: "ok",
        latency_ms: res.latencyMs,
        usage: res.usage,
        decision: "pending",
        checks,
      };
      await record(entry, apiKey);
      setResult({
        entryId: entry.id,
        context,
        snapshot,
        checks,
        explanation: shown.explanation,
        shortened: shown.shortened,
        text,
        ungrounded,
        provider,
        model: res.model,
        requestedModel: model,
        fallback: res.fallback,
        latencyMs: res.latencyMs,
        usage: res.usage,
        decision: "pending",
      });
    } catch (e) {
      const ai = e instanceof AiError ? e : null;
      const kind = ai?.kind ?? "unknown";
      // cancelled calls are still logged (every call is audited) but need no message
      if (kind !== "aborted") setError(describeAiError(e));
      await record(
        {
          ...base,
          // a refusal, a cut-off reply or one that failed validation still cost
          // tokens: keep what came back
          model: ai?.model ?? model,
          fallback: ai?.fallback ?? false,
          output: ai?.raw ?? null,
          status: "error",
          error: {
            kind,
            message: redactSecrets(e instanceof Error ? e.message : String(e), apiKey),
          },
          latency_ms: Math.round(performance.now() - started),
          usage: ai?.usage ?? null,
          decision: "not_applicable",
        },
        apiKey,
      );
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: Decision, edited?: string) => {
    if (!result) return;
    setResult({ ...result, decision, edited });
    setEditing(false);
    const key = keyStore.getKey(result.provider);
    try {
      await auditStore().update(result.entryId, {
        decision,
        decided_at: new Date().toISOString(),
        ...(edited !== undefined
          ? {
              edited_output: redactSecrets(edited, key),
              // the grounding check, re-run on the text the visitor kept
              checks: {
                ...result.checks,
                ungrounded_numbers_edited: findUngroundedNumbers(edited, result.snapshot),
              },
            }
          : {}),
      });
    } catch {
      setAuditNotice("Your decision could not be written to the audit log in this browser.");
    }
  };

  const showingEdit = result?.decision === "edited" && result.edited !== undefined;
  const ungrounded =
    result && showingEdit && result.edited !== undefined
      ? findUngroundedNumbers(result.edited, result.snapshot)
      : (result?.ungrounded ?? []);
  const headingId = `explain-${context.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <section
      aria-labelledby={headingId}
      // focus lands here after the AI settings dialog closes if the button that
      // opened it was replaced by a disabled one
      tabIndex={-1}
      data-ai-focus-fallback
      className={cn(
        "rounded-2xl border border-dashed bg-card/60 p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3
            id={headingId}
            className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-sm font-semibold tracking-normal"
          >
            <Sparkles className="size-4 text-correction" aria-hidden />
            Explain this iteration
            <span className="rounded-full border px-2 py-0.5 text-[0.7rem] font-normal whitespace-nowrap text-muted-foreground">
              optional · AI · your own key
            </span>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Sends this iteration&apos;s numbers (parameters before and after, responsibilities,
            log-likelihood, stopping rule) and a fixed description of the page and data set, with no
            personal data, to {PROVIDER_LABEL[settings.provider]}, from your browser.{" "}
            <Link href="/methods#ai-use" className="underline underline-offset-3">
              What is sent
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {ready && !hasKey ? (
            <Button
              id={`${headingId}-action`}
              variant="outline"
              onClick={openAiSettings}
              className="rounded-full"
            >
              <KeyRound data-icon="inline-start" /> Add your API key
            </Button>
          ) : (
            <Button
              id={`${headingId}-action`}
              onClick={run}
              disabled={!ready || busy || !input}
              className="rounded-full px-3.5"
            >
              {busy ? (
                <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />
              ) : (
                <Sparkles data-icon="inline-start" aria-hidden />
              )}
              {busy ? "Asking…" : result ? "Explain again" : "Explain"}
            </Button>
          )}
          {busy ? (
            <Button
              variant="ghost"
              onClick={() => abortRef.current?.abort()}
              className="rounded-full"
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      {!input ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Step to an iteration first: the starting guess has nothing to explain yet.
        </p>
      ) : null}

      {/* a short announcement, not the whole panel: the article is long and changes on every decision */}
      <p role="status" className="sr-only">
        {busy
          ? "Asking the AI…"
          : result
            ? result.decision === "pending"
              ? "AI-generated explanation ready."
              : `AI-generated explanation ${result.decision}.`
            : ""}
      </p>
      <div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {auditNotice ? (
          <p role="status" className="mt-3 rounded-lg bg-correction-bg px-3 py-2 text-xs">
            <span className="font-medium">Audit log: </span>
            {auditNotice}{" "}
            <Link href="/ai-log" className="underline underline-offset-3">
              Open the AI audit log
            </Link>
          </p>
        ) : null}

        {result && result.decision === "rejected" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            You rejected this AI explanation. It is hidden here and kept, marked
            &ldquo;rejected&rdquo;, in the{" "}
            <Link href="/ai-log" className="link">
              audit log
            </Link>
            .
          </p>
        ) : null}

        {result && result.decision !== "rejected" ? (
          <article
            className={cn("mt-4 rounded-xl border bg-card p-4", stale && "opacity-70")}
            aria-label="AI-generated explanation"
          >
            <header className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-correction-bg px-2 py-0.5 font-semibold tracking-wide text-correction uppercase">
                <Sparkles className="size-3" aria-hidden /> AI-generated
              </span>
              <span className="text-muted-foreground">
                {modelLabel(result.model)} via {PROVIDER_LABEL[result.provider]}
                {result.fallback
                  ? ` (answered after ${modelLabel(result.requestedModel)} declined: server-side fallback)`
                  : ""}{" "}
                · {(result.latencyMs / 1000).toFixed(1)} s
                {result.usage
                  ? ` · ${result.usage.input_tokens.toLocaleString("en-AU")} in / ${result.usage.output_tokens.toLocaleString("en-AU")} out tokens`
                  : ""}
              </span>
              {result.decision !== "pending" ? (
                <span className="rounded-full border px-2 py-0.5 text-foreground/80">
                  {result.decision === "edited" ? "edited by you" : "accepted by you"}
                </span>
              ) : null}
            </header>
            {stale ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Written for a different iteration. Ask again for the one on screen.
              </p>
            ) : null}

            {editing ? (
              <div className="mt-3 space-y-2">
                <label htmlFor={`${headingId}-edit`} className="text-sm font-medium">
                  Edit the explanation
                </label>
                <textarea
                  id={`${headingId}-edit`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-input bg-background p-3 text-sm leading-relaxed"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => decide("edited", draft)}
                    className="rounded-full"
                  >
                    Save edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(false)}
                    className="rounded-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : showingEdit ? (
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{result.edited}</p>
            ) : (
              <ExplanationView e={result.explanation} />
            )}

            <p
              className={cn(
                "mt-3 rounded-lg px-3 py-2 text-xs",
                ungrounded.length ? "bg-correction-bg" : "bg-ok/10",
              )}
            >
              <span className="font-medium">
                Grounding check{showingEdit ? " (your edited text)" : ""}:{" "}
              </span>
              {ungrounded.length
                ? `${ungrounded.length} number${ungrounded.length > 1 ? "s" : ""} in this text could not be found in the numbers that were sent (${ungrounded.join(", ")}). Treat ${ungrounded.length > 1 ? "them" : "it"} with care.`
                : "every number it checks matches the numbers that were sent."}{" "}
              <span className="text-muted-foreground">It checks {GROUNDING_SCOPE}.</span>
            </p>
            {result.shortened && !showingEdit ? (
              <p className="mt-2 text-xs text-muted-foreground">
                The reply was longer than this panel shows, so it was shortened here. The full reply
                is in the{" "}
                <Link href="/ai-log" className="underline underline-offset-3">
                  audit log
                </Link>
                , and the grounding check read all of it.
              </p>
            ) : null}

            {result.decision === "pending" && !editing ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* on phones the label takes its own line so the three buttons share one row */}
                <span className="mr-1 w-full text-xs text-muted-foreground sm:w-auto">
                  Your decision:
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide("accepted")}
                  className="rounded-full"
                >
                  <Check className="text-ok" data-icon="inline-start" aria-hidden /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(result.text);
                    setEditing(true);
                  }}
                  className="rounded-full"
                >
                  <Pencil data-icon="inline-start" aria-hidden /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide("rejected")}
                  className="rounded-full"
                >
                  <X className="text-destructive" data-icon="inline-start" aria-hidden /> Reject
                </Button>
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}

function ExplanationView({ e }: { e: Explanation }) {
  return (
    <div className="mt-3 space-y-2.5 text-sm leading-relaxed">
      <p className="font-heading text-lg leading-snug">{e.headline}</p>
      <dl className="space-y-2">
        {(
          [
            ["E-step", e.e_step],
            ["M-step", e.m_step],
            ["Log-likelihood", e.log_likelihood],
          ] as const
        ).map(([label, text]) => (
          <div key={label}>
            <dt className="font-medium">{label}</dt>
            <dd className="text-foreground/85">{text}</dd>
          </div>
        ))}
      </dl>
      {e.caveats.length ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {e.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
