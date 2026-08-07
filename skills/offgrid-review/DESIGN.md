---
name: Offgrid Review
description: A restrained review workbench for structured human judgment
colors:
  canvas-light: "#f8f6f7"
  surface-light: "#ffffff"
  surface-subtle-light: "#f3eff1"
  text-light: "#201a1c"
  muted-light: "#6d6468"
  border-light: "#d8d0d3"
  border-strong-light: "#95858b"
  blush-light: "#f4d8e1"
  blush-strong-light: "#e6b8c8"
  berry-light: "#7a2e4d"
  canvas-dark: "#171316"
  surface-dark: "#211b1f"
  surface-subtle-dark: "#2a2227"
  text-dark: "#faf5f7"
  muted-dark: "#c9bcc2"
  border-dark: "#453840"
  border-strong-dark: "#806d77"
  blush-dark: "#4a2b36"
  berry-dark: "#f0a9c0"
  risk-light: "#7c4659"
  risk-dark: "#e4a6ba"
  danger-light: "#b42318"
  danger-dark: "#ffb4ab"
typography:
  title:
    fontFamily: "Georgia, Times New Roman, DejaVu Serif, serif"
    fontSize: "clamp(1.35rem, 2.3vw, 2rem)"
    fontWeight: 400
    lineHeight: 1.18
    letterSpacing: "-0.015em"
  heading:
    fontFamily: "Trebuchet MS, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.005em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  state: "5px"
  control: "8px"
  option: "9px"
  callout: "10px"
  surface: "14px"
spacing:
  tight: "5px"
  control: "8px"
  group: "16px"
  section: "30px"
components:
  button-primary-light:
    backgroundColor: "{colors.berry-light}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
    height: "38px"
  button-primary-dark:
    backgroundColor: "{colors.berry-dark}"
    textColor: "{colors.canvas-dark}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
    height: "38px"
  action-option-light:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.option}"
    padding: "11px"
  action-option-selected-light:
    backgroundColor: "{colors.blush-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.option}"
    padding: "11px"
---

## Overview

This document is a maintainer contract. The generator does not read it at
runtime; it records the interface decisions future changes should preserve.

### Creative North Star

The Review Workbench

The interface is a serious workspace for inspecting evidence and recording
human judgment. Its identity comes from the relationship between evidence,
form controls, annotations, and review state. It does not depend on a visual
metaphor or decorative dashboard patterns.

Density is compact but not compressed. Neutral surfaces carry most of the
work. Blush marks selection, annotation, and active review state. Deep berry
marks primary controls. Muted plum marks risk, while red remains reserved for
errors and urgent danger.

**Key Characteristics:**

- Three coordinated work zones on wide screens.
- Document composition through semantic review blocks.
- Native form behavior with visible questions and instructions.
- Restrained blush selection fields in both themes.
- Progressive disclosure for evidence, visual alternatives, outcomes, and notes.
- On-demand review context beside the title.
- Direct labels that describe the effect of an action.

## Colors

The palette is restrained: neutral work surfaces, one blush and berry accent
family, a muted plum risk family, and separate error colors.

**The Blush Is State Rule.** Use blush for selection, annotation, and active
review context. Use muted plum for high-risk actions and red for errors or urgent
danger. Do not use blush for danger or general decoration.

**The Two Complete Themes Rule.** Light and dark modes use their own surface,
text, border, blush, and accent values. Do not create dark mode by inverting the
light palette.

## Typography

Display headings use Georgia, with Times New Roman and DejaVu Serif as broad
offline fallbacks. The serif appears on the product title, queue titles, item
titles, document headings, plan sections, summary title, and reviewed evidence
values. It gives the workbench a distinct editorial voice without changing the
form controls.

Operational questions and action labels keep Trebuchet MS, then Segoe UI and
the local system sans. Body copy and controls stay on the platform UI stack.
The hierarchy relies on size and spacing rather than heavy weight or uppercase
labels. Display headings use the regular face; compact operational headings use
bold weight where size alone cannot carry the hierarchy.

**The Split Voice Rule.** Serif identifies review content and major boundaries.
Humanist sans identifies instructions and controls. Do not use serif for action
labels, field labels, or status text.

**The Question Leads Rule.** A decision fieldset legend carries its own visual
weight. Do not place a decorative kicker above it.

## Layout

Desktop queue review uses three visible zones: a review-navigation rail, a
flexible evidence surface, and an item decision inspector. Document review uses
the same rail and header around one continuous reading surface. The header holds
the title, an authored question-mark help control, a quiet summary action, and
one filled export action. It does not repeat completion information already
available in review navigation.

For decision batches, the rail follows the reviewer's task order: find a
decision, see overall progress, then move between queues. Search, filters, and
incomplete-decision navigation come before the queue list. Queue fractions stay
quiet; the aggregate progress value carries the stronger emphasis. Document-only
reviews omit search and queues, then pair aggregate decision progress with
contents navigation. Theme selection lives in **File details**.

The rail becomes a horizontal control region below the header on medium
screens. Below the mobile breakpoint, cards become one column and the active
decision inspector moves into a persistent bottom action tray. Search, filters,
and queue navigation remain explicit.

Use tighter spacing inside questions and options. Use larger separation between
queues, plan sections, and unrelated review tasks.

## Elevation & Depth

Most hierarchy comes from tonal surfaces and one-pixel borders. Review cards
use a soft ambient shadow with vertical offset. The summary inspector and mobile
tray use directional shadows because they sit above the main work surface.

**The Structural Depth Rule.** Shadows explain overlap or surface hierarchy.
They are not accent halos.

## Shapes

Controls use modest corners. State tags are tighter than inputs. Action options
and callouts use medium corners. The largest radius belongs to the complete
review card, not to every nested element.

Interactive and informational elements stay visually distinct. Full capsules
are not part of the system.

## Components

### Buttons

Primary buttons use berry fill and theme-specific high-contrast text. Secondary
buttons use the current surface with a strong neutral border. Header utilities use text controls so **Download decisions** remains the only
filled rectangle. All buttons expose a three-pixel visible focus outline. When
the nonmodal summary closes, focus returns to its trigger unless the action is
moving the reviewer directly to another control.

### Inputs and fields

Inputs use the current surface, a strong neutral border, and an eight-pixel
corner. Labels sit above fields. Instructions and errors remain adjacent to the
control they describe.

### Action options

An action option combines a native checkbox or radio, a direct label, an
optional description, operational signals, and a progressively revealed note.
Selected compatible actions use the blush surface and berry border. High-risk
or irreversible actions use the quieter risk surface and border before
selection. Red remains available for validation errors and urgent danger.

### Review cards

A card joins evidence and its decision inspector in one bordered surface. The
evidence side contains visible primary facts, expandable supporting details,
raw source data, and plan sections. The decision note sits with the action
options so a reviewer can answer when none of those options fit. Do not nest
decorative cards inside the card.

### Semantic document blocks

Document blocks form one reading flow instead of a grid of decorative cards.
Overview uses a restrained blush field; prose, tables, timelines, and visuals
use spacing and rules for structure. Generated flow, dependency, and chart SVG
inherits theme tokens. Every visual is followed by a visible text-alternative
or data-table disclosure.

Custom SVG is an escape hatch. It must include a title, description, and
fallback, then pass the element and attribute allowlist before serialization.
Rejected graphics show a useful error without suppressing the fallback.

### Navigation

The review is the complete generated artifact. A queue is a meaningful group of
related decisions, and each item or decision block asks for one human judgment.
Visible labels and progress text must preserve that distinction.

Queue links show completed fractions in regular-weight tabular numerals and use
blush only for the current or hovered queue. Aggregate progress reads “decisions
complete.” A substantive decision, action, or plan-section note completes its
own decision even when no action is selected. Note-only completion exports as
feedback, not as approval to mutate the source system.

Search, queue filtering, completion filtering, and **Needs a decision**
navigation appear before queue links. The buttons use the short labels
**Previous** and **Next** because their surrounding heading supplies the
context. Modifier shortcuts are `Alt+/`, `Alt+J`, and `Alt+K`; do not add bare
character shortcuts that can interfere with assistive technology or speech
input.

Document reviews show **On this page** links in the desktop rail, with the
current section emphasized. At 1120 pixels and below, a floating authored list
icon opens those links in a nonmodal contents drawer above the action tray.
Document-only reviews omit queue and item filters. File metadata and theme
selection live in one disclosure below navigation. Mobile navigation follows
the active decision in the bottom tray. Grid children use shrinkable tracks and
`min-width: 0` where needed so document content reflows at 200 percent text
scaling instead of being clipped.

## Accessibility

WCAG 2.2 AA is the target for generated workbenches. Every pass must preserve:

- A skip link, named landmarks, ordered headings, and explicit accessible names.
- Native controls, fieldset legends, adjacent instructions, and text state that
  does not depend on color.
- Keyboard access without bare single-character shortcuts.
- Visible three-pixel focus outlines and focus return from nonmodal surfaces.
- Minimum 24 by 24 CSS-pixel targets, including labels associated with native
  checkbox and radio controls.
- Text and control-boundary contrast at AA thresholds in both themes.
- Status announcements for filtering, completion, conflicts, storage, and
  exports without moving focus unexpectedly.
- Reflow at 320 CSS pixels and at 200 percent text size without two-dimensional
  page scrolling.
- Reduced-motion behavior for progress, scrolling, trays, and notifications.

Automated browser coverage checks these contracts, but it does not replace
manual assistive-technology testing before a stable release.

## Design basis

The interaction model draws on [GOV.UK checkbox guidance](https://design-system.service.gov.uk/components/checkboxes/),
[GOV.UK check-answers guidance](https://design-system.service.gov.uk/patterns/check-answers/),
[USWDS form guidance](https://designsystem.digital.gov/components/form/), and
[W3C form guidance](https://www.w3.org/WAI/tutorials/forms/). These sources set
the usability floor without determining the visual styling.

## Do's and Don'ts

### Do

- **Do** use multi-select checkboxes as the normal decision model.
- **Do** declare single-select questions explicitly.
- **Do** keep action descriptions and risk signals visible before selection.
- **Do** attach comments to stable item, action, section, or document-block targets.
- **Do** choose the structured visual block that matches the review question.
- **Do** preserve a visible text path for every visual.
- **Do** reserve the strongest berry fill for primary review actions.
- **Do** keep header utilities quiet so export remains the only filled action.

### Don't

- **Don't** use blush to imply danger.
- **Don't** embed agent-authored SVG without sanitizing and reserializing it.
- **Don't** auto-submit or advance when a choice changes.
- **Don't** hide mobile behavior behind gestures.
- **Don't** turn evidence values into colorful decorative chips.
- **Don't** use gradients, glass effects, or visual metaphors to add identity.
