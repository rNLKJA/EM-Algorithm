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
- **Structured output.** The reply must match a JSON schema (provider structured-output modes), validated again with zod.
- **Transparency.** Every explanation is labelled "AI-generated", shows the model, latency and token usage, and runs a grounding check that lists numbers not found in what was sent.
- **Human in the loop and audit.** The visitor accepts, edits or rejects each explanation. Every call (including failures) is written to an IndexedDB audit log without the key, viewable and exportable (JSON, CSV) at /ai-log.

## Options considered

1. **No AI.** Safe, but misses a useful explanation and a governance showcase.
2. **A server proxy with my key.** Costs money, invites abuse and puts a secret on a server.
3. **An in-browser open model** (WebLLM). No key needed, but a multi-gigabyte download for a paragraph of text.
4. **Bring your own key, from the browser** (chosen).

## Why

It keeps the site free, static and fully functional without AI, and it makes the governance controls concrete: what is sent, what comes back, who decided what, all visible to the visitor. The design is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk Management Framework; it is not a compliance claim.

## What happened

- The provider adapters, error handling, key storage, audit log and grounding check are unit-tested with the network mocked (`ai.test.ts`): the key only ever travels in a request header, and a key echoed in a provider error is redacted before it is stored or shown.
- No live call was made during development or CI, because the project has no key. The request shapes follow the providers' documented APIs; a real call is the first thing to check after deployment.
- The grounding check is lexical. It catches an invented number, but not a correct number used in a wrong sentence, so it is a prompt for the human reviewer, not a verdict.

## What I'd change

- Build a small evaluation set (iterations with known facts: did the log-likelihood rise, did the run converge, which component owns each rating) and score explanations against it, with intervals, per model.
- Offer an in-browser model as a no-key option once small models are good enough at this.
