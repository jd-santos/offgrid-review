#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Focused browser regressions for the generated review runtime."""

from __future__ import annotations

import functools
import http.server
import json
import tempfile
import threading
import unittest
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, Page, Playwright, sync_playwright

from offgrid_review import default_spec, render_html

ROOT = Path(__file__).parents[2]
EXAMPLES = ROOT / "skills" / "offgrid-review" / "examples"


def load_example(name: str) -> dict[str, Any]:
    try:
        value = json.loads((EXAMPLES / name).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise AssertionError(f"Could not load example {name}: {error}") from error
    assert isinstance(value, dict)
    return value


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


class WorkbenchBrowserTests(unittest.TestCase):
    playwright: Playwright
    browser: Browser
    server: http.server.ThreadingHTTPServer
    server_thread: threading.Thread
    temporary_directory: tempfile.TemporaryDirectory[str]
    root: Path
    url: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary_directory = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary_directory.name)
        handler = functools.partial(_QuietHandler, directory=str(cls.root))
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/review.html"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.server_thread.join(timeout=5)
        cls.temporary_directory.cleanup()

    def write_review(self, data: dict[str, Any], spec: dict[str, Any]) -> None:
        (self.root / "review.html").write_text(
            render_html(data, spec), encoding="utf-8"
        )

    def new_page(self, **context_options: Any) -> tuple[Any, Page]:
        context = self.browser.new_context(**context_options)
        return context, context.new_page()

    def test_queue_decision_persists_and_exports_current_identity(self) -> None:
        data = {
            "items": [
                {
                    "id": "item-1",
                    "title": "Release review",
                    "description": "Inspect the release evidence.",
                }
            ]
        }
        spec = default_spec()
        spec["review_id"] = "browser-queue"
        spec["queues"][0]["source"] = "items"
        spec["queues"][0]["actions"].append(
            {"id": "follow_up", "label": "Add a follow-up"}
        )
        self.write_review(data, spec)
        context, page = self.new_page(
            permissions=["clipboard-read", "clipboard-write"]
        )
        requests: list[str] = []
        page.on("request", lambda request: requests.append(request.url))
        page.goto(self.url)

        page.locator("input[data-action='approve']").check()
        page.locator("input[data-action='follow_up']").check()
        payload = page.evaluate("decisionPayload()")
        self.assertEqual(payload["schema_version"], 1)
        self.assertEqual(payload["review_id"], "browser-queue")
        self.assertEqual(payload["decisions"][0]["id"], "example_queue:item-1")
        self.assertEqual(len(payload["decisions"][0]["actions"]), 2)
        self.assertIsNone(payload["decisions"][0]["action"])
        self.assertIsNone(payload["decisions"][0]["label"])
        self.assertTrue(payload["complete"])

        page.locator(".rail-meta > summary").click()
        page.get_by_role("button", name="Copy decisions").click()
        try:
            copied = json.loads(page.evaluate("navigator.clipboard.readText()"))
        except (TypeError, json.JSONDecodeError) as error:
            self.fail(f"Clipboard did not contain decision JSON: {error}")
        self.assertEqual(copied["artifact_fingerprint"], payload["artifact_fingerprint"])
        self.assertEqual(len(copied["decisions"][0]["actions"]), 2)

        page.reload()
        self.assertTrue(page.locator("input[data-action='approve']").is_checked())
        self.assertTrue(page.locator("input[data-action='follow_up']").is_checked())
        self.assertIn("1 of 1", page.locator("#progressLabel").inner_text())

        page.locator("input[data-action='needs_fix']").check()
        invalid_payload = page.evaluate("decisionPayload()")
        self.assertFalse(invalid_payload["valid"])
        self.assertTrue(any("conflicting" in warning for warning in invalid_payload["warnings"]))
        self.assertFalse(page.locator(".card-conflict").is_hidden())
        self.assertEqual(requests, [self.url, self.url])
        context.close()

    def test_regenerated_review_rejects_incompatible_saved_state(self) -> None:
        spec = default_spec()
        spec["review_id"] = "regeneration-test"
        spec["queues"][0]["source"] = "items"
        first = {"items": [{"id": "old", "title": "Old item"}]}
        second = {"items": [{"id": "new", "title": "New item"}]}
        self.write_review(first, spec)
        context, page = self.new_page()
        page.goto(self.url)
        page.locator("input[data-action='approve']").check()
        self.assertEqual(len(page.evaluate("decisionPayload().decisions")), 1)

        self.write_review(second, spec)
        page.goto(f"{self.url}?revision=2")

        self.assertIn("older or different review", page.locator("#stateNotice").inner_text())
        self.assertIn("0 of 1", page.locator("#progressLabel").inner_text())
        payload = page.evaluate("decisionPayload()")
        self.assertEqual(payload["decisions"], [])
        self.assertFalse(payload["complete"])
        context.close()

    def test_hostile_script_data_does_not_disable_runtime(self) -> None:
        spec = default_spec()
        spec["queues"][0]["source"] = "items"
        data = {
            "items": [
                {
                    "id": "hostile",
                    "title": "Tokenizer case",
                    "description": "<!--<script></script>\u2028still data",
                }
            ]
        }
        self.write_review(data, spec)
        context, page = self.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(self.url)

        self.assertTrue(page.evaluate("typeof decisionPayload === 'function'"))
        page.locator("input[data-action='approve']").check()
        self.assertEqual(
            page.evaluate("decisionPayload().decisions[0].id"),
            "example_queue:hostile",
        )
        self.assertEqual(errors, [])
        context.close()

    def test_note_only_response_completes_a_decision(self) -> None:
        data = {
            "items": [
                {
                    "id": "note-only",
                    "title": "Missing option",
                    "description": "None of the proposed actions fit.",
                }
            ]
        }
        spec = default_spec()
        spec["review_id"] = "browser-note-only"
        spec["queues"][0]["source"] = "items"
        self.write_review(data, spec)
        context, page = self.new_page()
        page.goto(self.url)

        page.locator(".decision-note > summary").click()
        page.locator("textarea[data-note-target='item']").fill(
            "Return this to the agent for a different proposal."
        )

        card = page.locator(".card")
        self.assertIn("done", card.get_attribute("class") or "")
        self.assertEqual(card.locator(".decision-state").inner_text(), "Complete with a note")
        self.assertIn("1 of 1", page.locator("#progressLabel").inner_text())
        self.assertEqual(page.locator("#progressTrack").get_attribute("aria-valuenow"), "1")
        self.assertEqual(page.locator(".queue-count").inner_text(), "1/1")
        self.assertIn("1 of 1 complete", page.locator(".queue-nav a").get_attribute("aria-label") or "")
        self.assertEqual(
            page.locator(".queue-nav a").get_attribute("aria-current"), "location"
        )

        payload = page.evaluate("decisionPayload()")
        self.assertTrue(payload["complete"])
        self.assertEqual(payload["decisions"], [])
        self.assertEqual(len(payload["annotations"]), 1)
        self.assertEqual(
            payload["annotations"][0]["notes"]["item"],
            "Return this to the agent for a different proposal.",
        )

        page.locator("#stateFilter").select_option("complete")
        self.assertTrue(card.is_visible())
        page.locator("#summaryTrigger").click()
        summary_text = page.locator("#summaryBody").inner_text()
        self.assertIn("Complete\n1 of 1", summary_text)
        self.assertIn("Notes added\n1", summary_text)
        page.locator("#summaryPanel .summary-close").click()
        context.close()

    def test_keyboard_navigation_names_targets_and_queue_reflow(self) -> None:
        data = {
            "items": [
                {"id": f"item-{index}", "title": f"Decision {index}"}
                for index in range(1, 4)
            ]
        }
        spec = default_spec()
        spec["review_id"] = "browser-accessibility"
        spec["queues"][0]["source"] = "items"
        self.write_review(data, spec)
        context, page = self.new_page(reduced_motion="reduce")
        page.goto(self.url)

        page.keyboard.press("Tab")
        self.assertTrue(
            page.locator(".skip-link").evaluate("element => element === document.activeElement")
        )
        page.keyboard.press("Enter")
        self.assertTrue(
            page.locator("#reviewMain").evaluate("element => element === document.activeElement")
        )

        page.locator("#summaryTrigger").focus()
        page.keyboard.press("j")
        self.assertTrue(
            page.locator("#summaryTrigger").evaluate("element => element === document.activeElement")
        )
        page.keyboard.press("Alt+j")
        self.assertEqual(
            page.evaluate("document.activeElement.closest('.card')?.dataset.id"),
            "example_queue:item-1",
        )
        page.keyboard.press("Alt+j")
        self.assertEqual(
            page.evaluate("document.activeElement.closest('.card')?.dataset.id"),
            "example_queue:item-2",
        )
        focus_bounds = page.evaluate(
            """() => {
              const focus = document.activeElement.getBoundingClientRect();
              const header = document.querySelector('.app-header').getBoundingClientRect();
              return { focusTop: focus.top, headerBottom: header.bottom };
            }"""
        )
        self.assertGreaterEqual(focus_bounds["focusTop"], focus_bounds["headerBottom"])

        page.locator("#summaryTrigger").focus()
        page.keyboard.press("/")
        self.assertTrue(
            page.locator("#summaryTrigger").evaluate("element => element === document.activeElement")
        )
        page.keyboard.press("Alt+/")
        self.assertTrue(
            page.locator("#reviewSearch").evaluate("element => element === document.activeElement")
        )

        unnamed_controls = page.evaluate(
            """() => [...document.querySelectorAll('button, input, select, textarea')]
              .filter(element => !element.hidden && element.getClientRects().length)
              .filter(element => {
                const aria = element.getAttribute('aria-label')?.trim();
                const labels = element.labels ? [...element.labels]
                  .map(label => label.textContent.trim()).join('') : '';
                const text = element.textContent?.trim() || '';
                return !aria && !labels && !text;
              })
              .map(element => element.outerHTML.slice(0, 160))"""
        )
        self.assertEqual(unnamed_controls, [])

        small_targets = page.evaluate(
            """() => [...document.querySelectorAll('button, a[href], summary, input, select, textarea')]
              .filter(element => !element.hidden && element.getClientRects().length)
              .map(element => {
                const rects = [element.getBoundingClientRect()];
                if (element.matches('input[type="checkbox"], input[type="radio"]')) {
                  const label = element.labels?.[0];
                  if (label) rects.push(label.getBoundingClientRect());
                }
                const left = Math.min(...rects.map(rect => rect.left));
                const right = Math.max(...rects.map(rect => rect.right));
                const top = Math.min(...rects.map(rect => rect.top));
                const bottom = Math.max(...rects.map(rect => rect.bottom));
                return {
                  html: element.outerHTML.slice(0, 120),
                  width: right - left,
                  height: bottom - top,
                };
              })
              .filter(target => target.width < 24 || target.height < 24)"""
        )
        self.assertEqual(small_targets, [])
        self.assertEqual(
            page.locator("html").evaluate("element => getComputedStyle(element).scrollBehavior"),
            "auto",
        )

        page.set_viewport_size({"width": 390, "height": 844})
        page.evaluate("document.documentElement.style.fontSize = '200%'")
        overflow = page.evaluate(
            "Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) "
            "- document.documentElement.clientWidth"
        )
        self.assertLessEqual(overflow, 1)

        page.evaluate("document.documentElement.style.fontSize = ''")
        page.set_viewport_size({"width": 320, "height": 844})
        narrow_overflow = page.evaluate(
            "Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) "
            "- document.documentElement.clientWidth"
        )
        self.assertLessEqual(narrow_overflow, 1)
        context.close()

    def test_planning_review_mobile_contents_focus_and_reflow(self) -> None:
        data = load_example("review-plan-data.json")
        spec = load_example("review-plan-spec.json")
        spec["review_id"] = "browser-plan"
        self.write_review(data, spec)
        context, page = self.new_page(viewport={"width": 390, "height": 844})
        page.goto(self.url)

        page.locator("#tocLauncher").click()
        self.assertTrue(page.locator("#tocDrawer").is_visible())
        page.locator("#tocDrawerClose").click()
        self.assertTrue(
            page.locator("#tocLauncher").evaluate("element => element === document.activeElement")
        )

        page.locator("#summaryTrigger").click()
        page.locator("#summaryPanel .summary-close").click()
        self.assertTrue(
            page.locator("#summaryTrigger").evaluate("element => element === document.activeElement")
        )
        self.assertEqual(
            page.locator("#summaryTrigger").get_attribute("aria-expanded"), "false"
        )

        page.locator("#mobileTrayToggle").click()
        page.locator("input[data-action='approve_direction']").check()
        first_block = page.locator(".document-block").first
        first_block.locator(".annotation-panel summary").click()
        first_block.locator("textarea[data-document-note]").fill(
            "Keep this block."
        )
        payload = page.evaluate("decisionPayload()")
        self.assertEqual(len(payload["decisions"]), 1)
        self.assertEqual(len(payload["annotations"]), 1)

        page.evaluate("document.documentElement.style.fontSize = '200%'")
        overflow = page.evaluate(
            "Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) "
            "- document.documentElement.clientWidth"
        )
        self.assertLessEqual(overflow, 1)
        context.close()


if __name__ == "__main__":
    unittest.main()
