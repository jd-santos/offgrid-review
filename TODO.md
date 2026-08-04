# TODO

## In Progress

- [ ] Package Offgrid Review as a minimal dependency-free Python CLI
  - [x] Capture baseline queue and planning artifacts before moving code
  - [x] Add `pyproject.toml`, a `src/offgrid_review` package, and the `offgrid-review` entry point
  - [x] Separate argument handling from rendering without changing generated HTML
  - [x] Preserve the current `--data`, `--spec`, `--out`, and `--write-default-spec` interface
  - [x] Add `--version`, explicit errors, and stable exit codes
  - [x] Move regression tests to the importable package and add CLI coverage
  - [x] Build wheel and source distributions and smoke-test the wheel through UVX
  - [x] Keep the agent skill as the discovery layer and remove its renderer copy
  - [x] Update examples, screenshots, README, references, product docs, and changelog
  - [x] Add test/build automation and prepare Trusted Publishing without publishing
  - [ ] Sync the tested release candidate into Dotfiles as a tracked skill

### Accepted direction

- PyPI distributes the package; UVX is the recommended runner, not a runtime dependency.
- The Python package has no third-party runtime dependencies.
- The first CLI keeps one flag-based generation command rather than adding subcommands.
- The agent skill explains when and how to invoke the CLI.
- MCP, apply behavior, plugins, formal schemas, and extra CLI commands remain out of scope.
- Publishing to TestPyPI or PyPI requires a separate confirmation after local validation.

## Up Next

- [ ] Show recommendation provenance and supporting evidence
- [ ] Add operational risk, reversibility, evidence-strength, and ambiguity signals
- [ ] Add stale snapshot, invalid data, apply conflict, and recovery states
- [ ] Audit headings, high-zoom layout, contrast, and screen-reader flow
- [ ] Add optional per-action confirmation friction
- [ ] Import decision JSON with schema and snapshot compatibility checks
- [ ] Validate and document `npx skills` installation

## Backlog

- [ ] Add risk-tiered approval queues and escalation rules
- [ ] Build a snapshot-aware apply loop with fingerprints and apply reports
- [ ] Add safe bulk decisions with exception previews
- [ ] Add concrete before-and-after previews
- [ ] Add constrained reusable diff, comparison, and evidence components
- [ ] Explore an optional hosted mode while preserving offline artifacts

## Done

- [x] Publish the public README, generated screenshots, capture script, and changelog
