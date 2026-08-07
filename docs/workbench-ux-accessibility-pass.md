# Workbench UX and accessibility pass

## Problem

The generated workbench did not explain the relationship between the review,
its queues, and its individual decisions clearly enough. Header progress
repeated queue information, low-priority utilities competed with export, and
navigation controls appeared after the queue list even though finding the next
relevant decision is the primary task.

Some wording was mechanical or redundant. In particular, **Review only**,
**resolved**, and **previous unresolved** added weight without helping the
reviewer understand what to do. The completion model also ignored notes, even
though a note can be the complete answer when none of the supplied actions fit.

The same generator serves decision batches, document reviews, desktop layouts,
and constrained mobile viewers. The pass needed to improve the shared system
rather than optimize one example artifact.

## Chosen approach

Keep the existing `queues` concept and artifact schema, but align the interface
with the reviewer’s workflow:

1. Treat the generated file as the review, each queue as a related group of
   decisions, and each item or decision block as one decision.
2. Put search, filters, and incomplete-decision navigation before queues.
3. Remove redundant title metadata and reduce the weight of summary access.
4. Move aggregate completion out of the header and into review navigation.
5. Use **complete** and **needs a decision** instead of **resolved** and
   **unresolved**.
6. Count a selected action or substantive decision note as complete. Note-only
   responses remain feedback rather than approved actions.
7. Keep export as the only primary header action.
8. Tell review authors to divide large evaluations into meaningful queues based
   on shared context and questions, not arbitrary batches.
9. Target WCAG 2.2 AA across desktop, mobile, light, dark, keyboard, focus,
   status announcements, contrast, target size, text scaling, and reflow.

## Rejected alternatives

### Copy and spacing cleanup only

A surface cleanup would be low risk, but it would leave the navigation hierarchy
and large-review authoring model unclear.

### Dedicated large-review mode

Category overviews, resumable batches, and guided sequences may help with
hundreds of decisions. Adding them without a representative large review would
expand state and specification complexity before the interaction model is
understood.

## Acceptance criteria

- Review, queue, and decision concepts are distinguishable in copy and
  structure.
- Search and incomplete-decision navigation precede queue navigation.
- **Review only** is removed and summary is quieter than export.
- Header progress no longer duplicates batch navigation progress.
- Queue fractions use regular weight while aggregate progress carries emphasis.
- A substantive note can complete a decision without selecting an action.
- Reviewers can identify and navigate to decisions that still need an answer.
- Queue and document examples reflow without clipping at narrow widths and 200
  percent text size.
- Keyboard focus is visible and predictable across panels, filters, navigation,
  the mobile tray, and document contents.
- Status and completion do not depend on color alone.
- Light and dark theme text and control boundaries meet AA contrast thresholds.
- Renderer and browser tests cover the revised contract.
- Skill guidance, examples, documentation, and screenshots match the UI.

## Outcome

The shared renderer, runtime, tests, examples, skill, product and design
contracts, accessibility reference, changelog, and screenshots now implement
this approach. Manual VoiceOver, forced-colors, 400 percent zoom, and a
representative 100-decision review remain bounded follow-ups in `TODO.md`.
