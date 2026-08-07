# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).
This project does not currently declare a Semantic Versioning policy.

## Unreleased

### Added

- Add the dependency-free `offgrid-review` Python CLI with UVX execution,
  version output, protected starter-spec generation, and concise command errors.
- Add queue-based and complete planning-document review with multi-select
  decisions, explicit single-select questions, granular notes, conflicts,
  summaries, persistence, and decision JSON export.
- Add semantic tables, flows, timelines, dependency graphs, charts, constrained
  SVG, and visible text alternatives.
- Add schema, generator, review, data, specification, and artifact identity to
  generated files and decision exports.
- Add path-aware input validation for IDs, types, references, source paths,
  collection limits, and reserved export fields.
- Add focused browser regressions for persistence, regenerated artifacts,
  hostile raw-text data, mobile document review, focus return, and text reflow.
- Add generated desktop, focused-module, and mobile screenshots with a
  standard-library capture script.
- Add a WCAG 2.2 AA accessibility contract, contrast checks, target-size checks,
  keyboard regressions, and a manual release checklist.

### Changed

- Replace self-referential demo content with a community workshop plan, launch
  decisions, and two-record reconciliation examples.
- Standardize **console** as the product term across public guidance, package
  metadata, and maintainer contracts.
- Reorder decision-batch navigation around search, completion filters, and
  incomplete-decision movement before overall and per-queue progress.
- Remove duplicate header progress and review-status text, reduce summary
  emphasis, and use complete or needs-a-decision language throughout the
  generated console.
- Count a substantive decision note as a complete response when no supplied
  action fits. Note-only responses still export as annotations and never as
  approved actions.
- Document how agents should divide large evaluations into meaningful queues
  that share context, a question, and an action set.
- Reframe the public quick start around the agent-to-human review workflow and
  use checked-in inputs for runnable CLI examples.
- Reserve exact UVX version pins for reproducibility, use the unversioned PyPI
  command after publication, and distinguish macOS manual testing from Ubuntu
  CI coverage.
- Split validation, identity, queue rendering, document rendering, SVG handling,
  page assembly, and browser resources into separate package boundaries.
- Require stable source item IDs and prefer those IDs over mutable paths when
  constructing decision identities.
- Scope browser storage to a review ID and load it only when its schema and
  artifact fingerprint match the current file. Pre-release title-only storage
  is intentionally not migrated.
- License the Python generator and aggregate package under GPL-3.0-or-later,
  while licensing the generated runtime and reusable output templates under
  Apache-2.0. Generated HTML carries the Apache license and notice.
- Rename reviewer-facing JSON actions to **Download decisions**, **Copy
  decisions**, and **Preview decisions** while retaining JSON as the exchange
  format.
- Keep the agent skill as the discovery and workflow layer while the CLI package
  owns deterministic execution.

### Fixed

- Remove stale design-process notes from generated HTML and avoid repeating an
  identical title in two-record comparison headings.
- Replace bare character shortcuts with modifier shortcuts so review navigation
  does not interfere with assistive technology or text input.
- Add a skip link, named decision regions, live completion semantics, current
  queue state, 24 CSS-pixel targets, and AA control-boundary contrast in both
  themes.
- Prevent decisions from an older artifact from inflating progress or appearing
  in a regenerated review export.
- Encode embedded JSON safely for HTML raw-text parsing so source strings such
  as `<!--<script>` cannot disable the browser runtime.
- Return focus to the review-summary trigger after closing the panel.
- Keep planning documents within the viewport at high text scaling.
- Report malformed data and specifications without exposing Python tracebacks.

## 2026-08-03

### Added

- Add the standard-library offline review generator and agent skill.
- Add the first review console interface, artifact documentation, product
  contract, and design contract.
