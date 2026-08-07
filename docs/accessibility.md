# Accessibility checks

Generated workbenches target WCAG 2.2 Level AA. This is an engineering target,
not a certification claim. The renderer, browser runtime, themes, and release
checks all share responsibility for meeting it.

## Built-in behavior

The generated HTML provides:

- A skip link and named header, navigation, main, and complementary regions.
- One page title followed by ordered section and decision headings.
- Native checkboxes, radio buttons, selects, text fields, textareas, fieldsets,
  and disclosures.
- Visible labels, legends, instructions, completion text, risk text, and error
  text.
- Three-pixel focus outlines in light and dark themes.
- `Alt+/` for search and `Alt+J` or `Alt+K` for incomplete-decision navigation.
  Bare character shortcuts are not used.
- Polite status updates for storage, filters, decision completion, progress, and
  downloads. Conflicts use an alert.
- A 24 by 24 CSS-pixel minimum target for controls, links, and disclosure
  summaries. Checkbox and radio labels form part of the native control target.
- Text and control-boundary contrast that meets the relevant 4.5:1 and 3:1
  thresholds in both themes.
- Layout reflow at a 320 CSS-pixel viewport and at 200 percent text size.
- Reduced-motion handling for smooth scrolling, progress updates, tooltips,
  trays, and notifications.
- Text alternatives for every generated chart and diagram.

Completion never relies on color alone. A decision reads **Needs a decision**,
names its selected action, reports multiple actions, reports a note-only
response, or identifies a conflict in text.

## Automated coverage

Run the renderer and browser checks:

```bash
uv run python -m unittest discover -s tests -p 'test_*.py'
uv run --group test python -m unittest tests.browser.test_workbench
```

The current tests cover:

- Accessible names for visible form controls.
- Skip-link focus and focus return from summary and contents surfaces.
- Modifier-key navigation and suppression of bare character shortcuts.
- Focus placement below the sticky header.
- Minimum pointer-target dimensions.
- Light and dark text contrast plus control and focus-indicator contrast.
- Reduced-motion styles.
- Queue and document reflow with enlarged text.
- Mobile contents and action-tray behavior.
- Live progress semantics and note-only completion.

These checks catch regressions in known components. They cannot prove that
arbitrary agent-authored wording is clear or that every browser and
assistive-technology combination behaves identically.

## Manual release checks

Before a stable release:

1. Complete one queue review using only Tab, Shift+Tab, Enter, Space, Escape,
   and the documented modifier shortcuts.
2. Complete one document review using VoiceOver on macOS and Safari or Chrome.
3. Verify the title, queue navigation, decision question, option descriptions,
   state changes, notes, warnings, summary, and export controls are announced in
   a useful order.
4. Check light, dark, and forced-colors modes without relying on color to
   identify selection, completion, risk, or errors.
5. Check 320 CSS pixels, 200 percent text size, and browser zoom up to 400
   percent for clipping or two-dimensional page scrolling.
6. Confirm sticky header, summary panel, contents drawer, and mobile tray do not
   cover the focused control.
7. Review one large artifact with at least 100 decisions across several queues.
   Confirm search, filters, queue progress, and previous or next navigation
   remain understandable.

Record failures in `TODO.md` with the affected criterion, browser, assistive
technology, and generated example.
