---
id: DR-005
title: "Explain this iteration": optional, bring your own key, grounded and audited
status: Accepted
date: 2026-10-09
applies-to: /stepper, /playground, /ai-log, /methods#ai-use, web/src/lib/ai
---

# DR-005: "Explain this iteration": optional, bring your own key, grounded and audited

**Decision in one line:** an optional AI explanation of the current EM iteration, called from the visitor's browser with their own key, fed only that iteration's numbers, labelled AI-generated, checked for numbers it did not receive, and recorded in a local audit log with the visitor's accept, edit or reject decision.

## Context

The lab is a teaching tool, and a plain-language reading of "what just happened in this E-step and M-step" is useful. It is also a small, realistic test of governing generative AI: the explanation is about numbers, which language models are prone to invent. There is no budget for an API key, no server, and nothing on the site may depend on AI.

## Decision

- **Bring your own key, browser only.** The visitor pastes an Anthropic (default, Claude Haiku 4.5; Claude Sonnet 5.5 optional) or OpenAI key. It stays in `sessionStorage` unless they choose "remember on this device" (`localStorage`), and "Forget key" removes it. Calls go straight from the browser to the provider. The key never reaches this site, a log or the repository.
- **Grounded input.** The request contains only the iteration's numbers: parameters before and after, responsibilities (all four in the stepper; a summary of the 200 in the playground), the log-likelihood before and after, and the stopping rule.
- **Structured output.** The reply must match a JSON schema (provider structured-output modes), validated again with zod against exactly the same contract. Display limits (long fields shortened, at most four caveats) are applied after validation, so a reply that obeys the schema is never thrown away for its length.
- **Refusals.** Claude Sonnet 5.5 requests opt into Anthropic's server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): if a safety classifier declines, Anthropic re-runs the request on the model it recommends for that category within the same call, and the audit log records the model that actually answered. Haiku 4.5 does not take the option. A refusal that still comes back is shown as a plain "declined" message.
- **Transparency.** Every explanation is labelled "AI-generated", shows the model, latency and token usage, and runs a grounding check that lists numbers not found in what was sent. The check covers numbers with decimals, numbers above 10 and anything in scientific notation (1e-6, 1.5 × 10⁻⁵, 10^-6), matched at the precision they are written with; whole numbers from 0 to 10 are not checked, because they are usually counts, ratings or ordinals.
- **Human in the loop and audit.** The visitor accepts, edits or rejects each explanation. Every call is written to an IndexedDB audit log without the key, viewable and exportable (JSON, CSV) at /ai-log. That includes failures: a refusal, a reply cut off at the token limit or one that fails validation keeps its raw reply and token usage, because the visitor paid for it.

## Options considered

1. **No AI.** Safe, but misses a useful explanation and a governance showcase.
2. **A server proxy with my key.** Costs money, invites abuse and puts a secret on a server.
3. **An in-browser open model** (WebLLM). No key needed, but a multi-gigabyte download for a paragraph of text.
4. **Bring your own key, from the browser** (chosen).

On refusals: leaving the fallback out would keep the browser request a little simpler (no beta header), but a visitor on Sonnet 5.5 would then pay for a declined request and get nothing back. Anthropic's CORS preflight accepts the `anthropic-beta` header, so the fallback costs nothing in the browser.

## Why

It keeps the site free, static and fully functional without AI, and it makes the governance controls concrete: what is sent, what comes back, who decided what, all visible to the visitor. The design is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk Management Framework; it is not a compliance claim.

## What happened

- The provider adapters, error handling, key storage, audit log and grounding check are unit-tested with the network mocked (`ai.test.ts`): the key only ever travels in a request header, and a key echoed in a provider error is redacted before it is stored or shown.
- No live call was made during development or CI, because the project has no key. The request shapes follow the providers' documented APIs; a real call is the first thing to check after deployment.
- The grounding check is lexical. It catches an invented number, but not a correct number used in a wrong sentence, so it is a prompt for the human reviewer, not a verdict. Review found two gaps before release, both fixed with tests: it read "3.1e-2" as accurate to ±0.05 because it ignored the exponent, and it skipped "3e-2" and "10⁻⁶" as small integers.
- Review also found that the first version's zod schema was stricter than the JSON schema sent to the provider (length and item limits the providers do not enforce), so a valid five-caveat reply was discarded after the visitor had paid for it, and that failed calls were logged without their reply or usage. Both are fixed.

## What I'd change

- Build a small evaluation set (iterations with known facts: did the log-likelihood rise, did the run converge, which component owns each rating) and score explanations against it, with intervals, per model.
- Offer an in-browser model as a no-key option once small models are good enough at this.
- Check numbers semantically as well as lexically: parse each sentence's claim ("the change is below the tolerance") and test it against the snapshot.
