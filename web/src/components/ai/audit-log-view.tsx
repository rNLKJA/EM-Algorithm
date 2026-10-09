"use client";

import { Download, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { type AuditEntry, auditStore, onAuditLogChange, toCsv, toJson } from "@/lib/ai/audit-log";
import { modelLabel, PROVIDER_LABEL } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: AuditEntry[] };

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DECISION_STYLE: Record<AuditEntry["decision"], string> = {
  pending: "border-border text-muted-foreground",
  accepted: "border-ok/50 text-ok",
  edited: "border-comp-1/50 text-comp-1-ink",
  rejected: "border-destructive/45 text-destructive",
  not_applicable: "border-border text-muted-foreground",
};

export function AuditLogView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(() => {
    auditStore()
      .list()
      .then(
        (entries) => setState({ status: "ready", entries }),
        (e: unknown) =>
          setState({ status: "error", message: e instanceof Error ? e.message : String(e) }),
      );
  }, []);

  useEffect(() => {
    load();
    return onAuditLogChange(load);
  }, [load]);

  if (state.status === "loading")
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Reading the audit log from this browser…
      </p>
    );
  if (state.status === "error")
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not open the audit log ({state.message}). IndexedDB may be disabled in this browser.
      </p>
    );

  const { entries } = state;
  const stamp = new Date().toISOString().slice(0, 10);
  const memoryOnly = auditStore().persistence() === "memory";
  const totals = entries.reduce(
    (t, e) => ({
      calls: t.calls + 1,
      ok: t.ok + (e.status === "ok" ? 1 : 0),
      tokens: t.tokens + (e.usage ? e.usage.input_tokens + e.usage.output_tokens : 0),
    }),
    { calls: 0, ok: 0, tokens: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="sheet flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="num font-semibold">{totals.calls}</span> AI call
          {totals.calls === 1 ? "" : "s"} recorded in this browser
          {totals.calls ? (
            <span className="text-muted-foreground">
              {" "}
              · {totals.ok} succeeded · {totals.tokens.toLocaleString("en-AU")} tokens reported
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!entries.length}
            onClick={() =>
              download(`ai-audit-log-${stamp}.json`, "application/json", toJson(entries))
            }
            className="rounded-full"
          >
            <Download data-icon="inline-start" aria-hidden /> JSON
          </Button>
          <Button
            variant="outline"
            disabled={!entries.length}
            onClick={() =>
              download(`ai-audit-log-${stamp}.csv`, "text/csv;charset=utf-8", toCsv(entries))
            }
            className="rounded-full"
          >
            <Download data-icon="inline-start" aria-hidden /> CSV
          </Button>
          {confirmClear ? (
            <span className="inline-flex items-center gap-2 text-sm">
              Delete all entries from this browser?
              <Button
                variant="destructive"
                onClick={async () => {
                  await auditStore().clear();
                  setConfirmClear(false);
                }}
                className="rounded-full"
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmClear(false)}
                className="rounded-full"
              >
                Keep
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              disabled={!entries.length}
              onClick={() => setConfirmClear(true)}
              className="rounded-full text-destructive"
            >
              <Trash2 data-icon="inline-start" aria-hidden /> Clear
            </Button>
          )}
        </div>
      </div>

      {memoryOnly ? (
        <p role="status" className="rounded-xl bg-correction-bg px-4 py-3 text-sm">
          IndexedDB is unavailable in this browser, so the log is kept for this tab only and is lost
          when the tab closes. Export it as JSON or CSV to keep a copy.
        </p>
      ) : null}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No AI calls yet. Use &ldquo;Explain this iteration&rdquo; on the stepper or the playground
          (with your own key) and the call will appear here.
        </div>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => {
            const when = new Date(e.timestamp).toLocaleString("en-AU", {
              dateStyle: "medium",
              timeStyle: "medium",
            });
            return (
              <li key={e.id} className="sheet p-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <time dateTime={e.timestamp} className="num text-xs">
                    {when}
                  </time>
                  <span className="font-medium">{e.feature}</span>
                  <span className="text-muted-foreground">
                    {modelLabel(e.model)} via {PROVIDER_LABEL[e.provider]}
                    {e.fallback && e.requested_model
                      ? ` (requested ${modelLabel(e.requested_model)}; server-side fallback answered)`
                      : e.fallback
                        ? " (server-side fallback answered)"
                        : ""}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      e.status === "ok"
                        ? "border-border"
                        : "border-destructive/40 text-destructive",
                    )}
                  >
                    {e.status === "ok" ? "ok" : `error: ${e.error?.kind ?? "unknown"}`}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      DECISION_STYLE[e.decision],
                    )}
                  >
                    {e.decision === "not_applicable" ? "no decision (failed)" : e.decision}
                  </span>
                </div>
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <div>
                    <dt className="inline">latency </dt>
                    <dd className="num inline">{e.latency_ms} ms</dd>
                  </div>
                  <div>
                    <dt className="inline">tokens </dt>
                    <dd className="num inline">
                      {e.usage
                        ? `${e.usage.input_tokens} in / ${e.usage.output_tokens} out`
                        : "not reported"}
                    </dd>
                  </div>
                  {Array.isArray(e.checks?.ungrounded_numbers) ? (
                    <div>
                      <dt className="inline">ungrounded numbers </dt>
                      <dd className="num inline">
                        {(e.checks?.ungrounded_numbers as string[]).length || "none"}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline">id </dt>
                    <dd className="inline font-mono break-all">{e.id}</dd>
                  </div>
                </dl>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Input, output and decision
                  </summary>
                  <div className="mt-2 grid gap-3 lg:grid-cols-2">
                    <div className="min-w-0">
                      <p className="eyebrow mb-1">Input sent (system + user)</p>
                      <LogBlock label={`Input sent, call of ${when}`}>
                        {e.input.system}
                        {"\n\n"}
                        {e.input.user}
                      </LogBlock>
                    </div>
                    <div className="min-w-0">
                      <p className="eyebrow mb-1">
                        {e.status === "ok" ? "Output (AI-generated)" : "Error"}
                      </p>
                      <LogBlock
                        label={`${e.status === "ok" ? "AI-generated output" : "Error"}, call of ${when}`}
                      >
                        {e.status === "ok" ? prettyJson(e.output) : e.error?.message}
                      </LogBlock>
                      {e.edited_output ? (
                        <>
                          <p className="eyebrow mt-3 mb-1">Your edited version</p>
                          <LogBlock label={`Your edited version, call of ${when}`}>
                            {e.edited_output}
                          </LogBlock>
                        </>
                      ) : null}
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * A scrollable block of logged text. It is focusable and labelled so keyboard
 * users can scroll long prompts with the arrow keys (WCAG 2.1.1).
 */
function LogBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <pre
      tabIndex={0}
      role="region"
      aria-label={label}
      className="num max-h-72 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap"
    >
      {children}
    </pre>
  );
}

function prettyJson(s: string | null): string {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
