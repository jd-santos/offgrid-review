---
name: offgrid-review
description: >-
  Move complex human decisions out of chat and into a portable review console.
  Use when an agent can gather the evidence and options, but a person needs to
  compare items, annotate a proposal, or decide the direction of a plan. The
  console captures machine-readable decisions without applying them; a separate
  verified pass makes changes later.
version: 1.3.1
author: JD Santos
category: workflow
allowed-tools: Bash(uvx --from git+https://github.com/jd-santos/offgrid-review.git offgrid-review *), Bash(uvx offgrid-review@* *), Bash(uvx offgrid-review *), Read
---

# Offgrid Review

Give human judgment a better interface than a long chat thread. Gather the
facts and options, turn them into a portable review console, then return the
reviewer's decisions and annotations to a separate verified apply pass.

The pattern:

```text
agent gathers evidence and frames the questions
    → portable HTML review console
    → human decisions and annotations
    → verified apply pass
```

Use it when an agent has a batch of related decisions, a proposal, or a complete
plan that would be painful to work through one question at a time in chat. The
facts and options should be gatherable before the human review begins.

## When to use

- Reconciliation or alignment between two systems (e.g. a project/planning store
  and a task/reminder list).
- Inbox, triage, and backlog decision batches.
- Classification or labeling tasks.
- Backlog prioritization.
- Agent-prepared plans that need section comments, visual inspection, and an
  explicit direction decision.
- Any "these items need a human verdict but I don't want to narrate each one in
  a chat thread" situation.

## When NOT to use

- Simple, few-item reviews. Just do them inline.
- Anything where decisions should be reached completely automatically (no human
  loop). No console is needed.
- Work that itself is not safe to separate into "review now, apply later." If a
  change must happen the moment it's decided, this pattern adds needless
  friction.

## Keep review and apply separate

The console is a **decision-capture** surface, never an **apply** surface.
Nothing is changed from the page on purpose. A human reviews and exports
decision JSON, then a separately verified pass actually makes changes. Never
let the console (or the generator) mutate the underlying system.

## Workflow

### 1. Gather deterministic data (JSON)

Write or use a read-only script that snapshots the current state of the system
under review and emits JSON:

```json
{
  "date": "2026-08-01",
  "counts": { "main_items": 3 },
  "main_items": [
    { "id": "a", "title": "Item A", "status": "Ready", "priority": "p1" }
  ]
}
```

Requirements: read-only, deterministic-enough to re-run, explicit source IDs on
each item, and enough raw data captured that the apply pass can find items
again. See `reference/artifact-contract.md` for the full shape.

### 2. Write the agent-authored spec (JSON)

This is where the judgment goes: what should be asked this time. Add `title`,
`subtitle`, optional `agent_help`, optional `global_actions`, and either
`queues`, semantic `blocks`, or both.

Each queue defines its source, evidence fields, question, selection mode, and
actions. Group decisions that share context and ask the same kind of question.
For a large evaluation, organize meaningful categories by decision type, risk,
source, or area of responsibility instead of making arbitrary batches. See
[Framing large reviews](reference/usage.md#framing-large-reviews) for the
authoring checklist.

Keep each queue scannable, put higher-value or higher-risk queues first, and
write a concrete description. Items that need different questions or action
sets belong in different queues. Always leave a path for an answer the options
did not anticipate. A decision note counts as a complete response but exports
as feedback rather than an approved action.

Document blocks compose overview, prose, table, flow, timeline, dependency
graph, chart, constrained SVG, and decision sections. Multi-select is the
default. Use single-select only for truly exclusive outcomes. Actions can
declare risk, reversibility, required rationale, exclusivity, and conflicts.

Prefer semantic visual blocks over custom SVG. Every visual must retain its
visible text alternative. Custom SVG must pass the built-in allowlist sanitizer
and include title, description, and fallback text.

### 3. Generate the console

Until `0.1.0` is published, run the release candidate from Git:

```bash
uvx --from git+https://github.com/jd-santos/offgrid-review.git offgrid-review \
  --data review-data.json \
  --spec review-spec.json \
  --out review.html
```

This Git-source command is temporary. Use `uvx offgrid-review` after the PyPI
release. Exact version pins are only needed for reproducibility.

See `reference/usage.md` for commands, custom specifications, tested platforms,
and file-viewer constraints. The Python package has no third-party runtime
dependencies; UVX is the recommended runner, not a package dependency.

### 4. Human reviews and exports decisions

Open the HTML, inspect the evidence, select every compatible action, and add
notes at the decision, action, plan-section, or document-block level. If the
actions do not express the intended answer, add a decision note instead. An
action or substantive decision note marks that decision complete. Note-only
responses remain feedback and do not authorize the apply pass to mutate the
source system. Complete planning documents receive responsive contents
navigation automatically. The console stores review state in `localStorage`
when the viewer allows it and falls back to in-session state otherwise.

Saved state is scoped to a review ID and loaded only when its schema and artifact
fingerprint match. A visible
warning explains ignored state or tells the reviewer to download before
closing.

### 5. Safe apply pass

Use the exported decision JSON to make changes, following `reference/apply-pass.md`:

- **Verify current state before mutating.** Re-fetch the item, then skip or
  re-ask if it changed since review.
- **Never do destructive actions unless explicitly approved** by the human's
  chosen action.
- **Treat `defer` / `needs human decision` / `ignore` as non-actions.** Never
  guess.
- **Report applied / skipped / error counts.**

## Deliverables in this skill

- `examples/review-spec.json`: multi-select, single-select, and decision-batch
  examples.
- `examples/review-data.json`: evidence for the checked-in decision batches.
- `examples/review-plan-spec.json`: semantic planning-document example.
- `examples/review-plan-data.json`: planning-document source data.
- `reference/artifact-contract.md`: data, spec, and export schemas.
- `reference/apply-pass.md`: the safe multi-action apply contract.
- `reference/usage.md`: setup, interaction behavior, and constraints.
- `PRODUCT.md`: product purpose, constraints, and principles.
- `DESIGN.md`: interface system and responsive behavior.

## Pitfalls

- **Keep embedded JSON literal and raw-text safe.** The generator escapes HTML
  raw-text tokenizer characters as JSON Unicode sequences. Never replace this
  with HTML entity encoding inside `<script type="application/json">`; raw-text
  script content does not decode entities, so `JSON.parse()` fails.
- **Storage blockers.** Telegram, some iOS viewers, and local-file viewers block
  `localStorage`. Initialization and persistence must stay inside `try`/`catch`
  so session interactions still work, and the UI must tell the human to
  download decisions when storage is unavailable.
- **Handoff files contain source snapshots.** Anyone who receives the HTML or
  exported decisions can inspect the embedded review data. Never include
  secrets or unrelated private fields.
- **Don't drift into an apply surface.** If you find the console "just applying"
  a change, stop. That belongs in the apply pass, gated by the exported
  decisions.
- **The CLI is not the intelligence.** Frame new reviews by writing a new spec,
  not by changing the renderer. This skill is the agent discovery and workflow
  layer; the CLI package is the deterministic execution layer.
- **Use semantic blocks first.** Flow, timeline, dependency graph, and chart
  renderers provide deterministic visuals and text alternatives.
- **Never embed supplied SVG directly.** The generator must parse and serialize
  only its accepted subset. Rejected SVG shows an error plus the required text
  fallback, and its original source is omitted from annotation snapshots.
