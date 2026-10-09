---
id: DR-006
title: Say exactly what the AI feature sends, which model answered, and how the site was built
status: Accepted (supersedes DR-005 in part)
date: 2026-10-10
applies-to: /methods#ai-use, /ai-log, README, web/src/lib/ai
---

# DR-006: Say exactly what the AI feature sends, which model answered, and how the site was built

**Decision in one line:** the AI use statement now lists every field the snapshot carries (checked by a test), the audit log records the model that was asked as well as the one that answered and whether Anthropic's fallback ran, and the site says plainly that it was built with an AI coding assistant; this replaces DR-005's "Grounded input" bullet and the audit part of its "Refusals" bullet, and the rest of DR-005 stands.

## Context

A review before release checked the AI use statement against the code and the repository, and found three places where it said less, or more, than was true:

- DR-005 and /methods said the request contains "only the iteration's numbers". The snapshot also carries the page name, a one-line description of the data set (for example the seed of browser-generated ratings), its size, the run's stopping status and fixed notes on how to read the numbers. None of it is personal, but the statement was not literally accurate.
- With Claude Sonnet 5.5, Anthropic's server-side fallback can answer a declined request with another model inside the same call. The audit log kept one `model` field, overwritten with the model that answered, so an auditor could not see what was requested or that a fallback happened.
- /methods said every other text on the site "was written without" AI. The commit history shows the site's code and text were developed with an AI coding assistant. The runtime claim (only the optional feature calls a model) was true; the authorship claim was not.

## Decision

- **What is sent.** `SNAPSHOT_FIELDS` in `web/src/lib/ai/explain-iteration.ts` lists every field in plain words, /methods prints that list, and a test fails if a stepper or playground snapshot carries a field that is not on it, or the list names one that is never sent.
- **Which model answered.** Each audit entry stores `requested_model` (what the visitor's settings asked for), `model` (what the provider reports) and `fallback` (true when a `fallback` content block or a `fallback_message` entry in `usage.iterations` shows the fallback ran). Both new fields are in the JSON and CSV exports and on /ai-log, and the explanation's label names the fallback when it happens. Entries written before this change have only `model`.
- **How the site was built.** /methods and the README say that nothing on the site calls an AI model at runtime except the optional feature, that the code and text were developed with an AI coding assistant (Claude Code), and that every number comes from the code, the tests and the seeded scripts.

## Options considered

1. **Trim the snapshot to numbers only,** so the old wording became true. The page name and data-set line help the model explain the right thing (four hand-worked ratings, or 200 generated ones), and dropping them would make the explanations worse to save a sentence.
2. **Keep one `model` field and append "(fallback)" to it.** Simple, but it mixes two facts into one string that the CSV export and any later analysis would have to parse.
3. **Separate fields and a field list tested against the code** (chosen).

## Why

A transparency statement that is wrong in small ways teaches readers to discount it in big ones. Each of these claims can be checked in a minute (by reading the request in the browser's network panel, or the repository's history), so each has to be exactly true. Tying the disclosure to the code with a test keeps it true when the snapshot changes. The design remains informed by, not compliant with, the frameworks named in DR-005.

## What happened

- The three issues were found in review before release, not by a visitor. No live call has been made (the project has no key), so the fallback detection is tested only against mocked responses shaped like Anthropic's documented ones.
- The log view names the requested model only when the fallback ran. A provider that reports a dated model id (OpenAI often does) is therefore not mistaken for a fallback.

## What I'd change

- Show the exact JSON that will be sent before the first call, with a "send" button, rather than only describing it on /methods.
- Record the fallback's switch points (which model declined, which continued) in the audit entry, not just a flag, if a fallback ever turns up in practice.
