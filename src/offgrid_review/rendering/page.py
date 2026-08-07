# SPDX-License-Identifier: GPL-3.0-or-later OR Apache-2.0
"""Assemble one licensed, offline review artifact."""

from __future__ import annotations

import datetime as dt
import html
import re
from importlib import resources
from typing import Any

from ..identity import artifact_identity, browser_storage_key, script_json, slugify
from ..validation import validate_review
from .document import (
    materialize_block,
    render_document_blocks,
    render_document_toc,
)
from .queue import render_cards

_PAGE_TOKEN_RE = re.compile(r"@@([A-Z_]+)@@")
_SCRIPT_TOKEN_RE = re.compile(r"__([A-Z_]+)__")


def _resource_text(name: str) -> str:
    return resources.files("offgrid_review.resources").joinpath(name).read_text(
        encoding="utf-8"
    )


def _substitute(template: str, pattern: re.Pattern[str], values: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            raise ValueError(f"template token {key} has no value")
        return values[key]

    return pattern.sub(replace, template)


def _output_license() -> str:
    return _resource_text("output-license.txt").rstrip().replace("--", "- -")


def default_spec() -> dict[str, Any]:
    """Return a starter queue specification."""
    return {
        "title": "Offgrid Review",
        "subtitle": (
            "Review the evidence, select compatible actions or add decision notes, "
            "and export decision JSON. Nothing is changed from this page."
        ),
        "global_actions": [
            {
                "id": "defer",
                "label": "Defer for later",
                "description": "Leave the item for a future review.",
                "exclusive": True,
            },
            {
                "id": "needs_human",
                "label": "Needs another reviewer",
                "description": "Route the item to a person with more context.",
                "exclusive": True,
            },
            {
                "id": "ignore",
                "label": "No action needed",
                "description": "Record that the item was reviewed without follow-up.",
                "exclusive": True,
            },
        ],
        "queues": [
            {
                "id": "example_queue",
                "title": "Example queue",
                "description": "Describe what is being decided and why it matters.",
                "source": "example_items",
                "empty": "Nothing to review in this queue.",
                "question": "Which actions should be taken?",
                "selection_mode": "multiple",
                "detail_keys": [
                    "status",
                    "priority",
                    "due",
                    "labels",
                    "path",
                    "description",
                ],
                "primary_keys": ["status", "priority", "due"],
                "actions": [
                    {
                        "id": "approve",
                        "label": "Approve the proposal",
                        "description": "Carry this proposal into the apply pass.",
                        "risk": "low",
                        "reversible": True,
                    },
                    {
                        "id": "needs_fix",
                        "label": "Request changes",
                        "description": "Keep the item open and describe the required edits.",
                        "risk": "low",
                        "reversible": True,
                        "requires_note": True,
                        "conflicts_with": ["approve"],
                    },
                ],
            }
        ],
    }


def _action_specs(
    spec: dict[str, Any], document_id: str, document_blocks: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    keys = (
        "id",
        "label",
        "description",
        "risk",
        "reversible",
        "requires_note",
        "exclusive",
        "conflicts_with",
    )
    result: dict[str, dict[str, Any]] = {}
    for queue in spec.get("queues", []) or []:
        for action in queue.get("actions", []) or []:
            result[f"{queue['id']}.{action['id']}"] = {
                key: action.get(key) for key in keys
            }
    for block in document_blocks:
        if block.get("type") != "decision":
            continue
        for action in block.get("actions", []) or []:
            result[f"{document_id}.{action['id']}"] = {
                key: action.get(key) for key in keys
            }
    for action in spec.get("global_actions", []) or []:
        metadata = {key: action.get(key) for key in keys}
        if metadata.get("exclusive") is None:
            metadata["exclusive"] = True
        result[f"_global.{action['id']}"] = metadata
    return result


def _navigation(
    data: dict[str, Any],
    spec: dict[str, Any],
    document_blocks: list[dict[str, Any]],
) -> tuple[list[str], int, dict[str, int]]:
    links: list[str] = []
    total_cards = sum(
        1 for block in document_blocks if block.get("type") == "decision"
    )
    represented_counts: dict[str, int] = {}
    for queue in spec.get("queues", []) or []:
        queue_id = str(queue["id"])
        source = str(queue["source"])
        count = len(data[source])
        title = str(queue.get("title", queue_id))
        represented_counts[source] = count
        total_cards += count
        links.append(
            f"<a href='#{html.escape(queue_id)}' data-queue-target='{html.escape(queue_id)}' "
            f"aria-label='{html.escape(title)}, 0 of {count} complete'>"
            f"<span class='queue-name'>{html.escape(title)}</span>"
            f"<span class='queue-count' data-queue-progress='{html.escape(queue_id)}' "
            f"data-queue-name='{html.escape(title)}'>0/{count}</span></a>"
        )
    return links, total_cards, represented_counts


def _progress_section(total_cards: int) -> str:
    progress_max = max(total_cards, 1)
    return f"""
    <section class="rail-section review-progress" aria-labelledby="reviewProgressTitle">
      <h2 id="reviewProgressTitle">Review progress</h2>
      <div class="progress-line"><span id="progressLabel"><strong id="progressCount">0 of {total_cards}</strong> decisions complete</span><span id="progressPercent">0%</span></div>
      <div class="progress-track" id="progressTrack" role="progressbar" aria-labelledby="reviewProgressTitle progressLabel" aria-valuemin="0" aria-valuemax="{progress_max}" aria-valuenow="0" aria-valuetext="0 of {total_cards} decisions complete"><div class="progress-fill" id="progressFill"></div></div>
    </section>"""


def _tools_section(has_queues: bool) -> str:
    if not has_queues:
        return ""
    return """
    <section class="rail-section review-tools-section" aria-labelledby="reviewToolsTitle">
      <h2 id="reviewToolsTitle">Find a decision</h2>
      <div class="review-tools">
        <label for="reviewSearch">Search<input id="reviewSearch" type="search" placeholder="Title, evidence, or action" autocomplete="off" aria-keyshortcuts="Alt+/" title="Keyboard shortcut: Alt+/"></label>
        <label for="queueFilter">Queue<select id="queueFilter"><option value="">All queues</option></select></label>
        <label for="stateFilter">Completion<select id="stateFilter"><option value="all">All decisions</option><option value="incomplete">Needs a decision</option><option value="complete">Complete</option></select></label>
        <nav class="incomplete-nav" aria-labelledby="incompleteNavTitle">
          <h3 id="incompleteNavTitle">Needs a decision</h3>
          <div class="review-nav-buttons"><button type="button" id="prevIncomplete" aria-label="Previous decision that needs an answer" aria-keyshortcuts="Alt+K" title="Keyboard shortcut: Alt+K">Previous</button><button type="button" id="nextIncomplete" aria-label="Next decision that needs an answer" aria-keyshortcuts="Alt+J" title="Keyboard shortcut: Alt+J">Next</button></div>
        </nav>
        <span id="filterStatus" role="status" aria-live="polite"></span>
      </div>
    </section>"""


def render_html(data: dict[str, Any], spec: dict[str, Any]) -> str:
    """Validate inputs and return one self-contained review document."""
    validate_review(data, spec)
    generated_at = (
        dt.datetime.now(dt.timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )
    identity = artifact_identity(data, spec)
    storage_key = browser_storage_key(spec, identity)
    download_prefix = str(
        spec.get("download_prefix")
        or (slugify(str(spec.get("title", "review"))) + "-decisions")
    )
    payload_meta = spec.get("payload_meta") or {}
    item_queues = spec.get("queues", []) or []
    document_id = str(spec.get("document_id", "document-review"))
    document_blocks = [
        materialize_block(data, block) for block in (spec.get("blocks", []) or [])
    ]
    action_specs = _action_specs(spec, document_id, document_blocks)
    queue_links, total_cards, represented_counts = _navigation(
        data, spec, document_blocks
    )

    help_sentence = spec.get("agent_help") or (
        "Review the evidence, select every compatible action, or add a decision note "
        "when the options do not fit. Then download the decisions and send them back "
        "to the agent."
    )
    count_rows = "".join(
        f"<div><dt>{html.escape(str(key).replace('_', ' '))}</dt>"
        f"<dd>{html.escape(str(value))}</dd></div>"
        for key, value in (data.get("counts", {}) or {}).items()
        if represented_counts.get(str(key)) != value
    )
    cards = render_document_blocks(data, spec) + render_cards(data, spec)
    document_only = bool(document_blocks) and not item_queues
    queue_section = ""
    if queue_links and not document_only:
        queue_section = (
            "<section class='rail-section queue-section' aria-labelledby='queuesTitle'>"
            "<h2 id='queuesTitle'>Queues</h2>"
            f"<nav class='queue-nav' aria-labelledby='queuesTitle'>{''.join(queue_links)}</nav>"
            "</section>"
        )
    toc_section = render_document_toc(document_blocks, document_id)

    javascript = _substitute(
        _resource_text("review.js"),
        _SCRIPT_TOKEN_RE,
        {
            "STORAGE_KEY": script_json(storage_key),
            "DOWNLOAD_NAME": script_json(download_prefix + "-"),
            "CONSOLE_TITLE": script_json(spec.get("title", "Offgrid Review")),
            "REVIEW_META": script_json(payload_meta),
            "ACTION_SPECS": script_json(action_specs),
            "ARTIFACT_IDENTITY": script_json(identity),
        },
    )
    page_values = {
        "OUTPUT_LICENSE": _output_license(),
        "LANGUAGE": html.escape(str(spec.get("language", "en"))),
        "TITLE": html.escape(str(spec.get("title", "Offgrid Review"))),
        "SUBTITLE": html.escape(
            str(
                spec.get(
                    "subtitle",
                    "About this review and what the exported decisions mean.",
                )
            )
        ),
        "TOTAL_CARDS": str(total_cards),
        "RAIL_CLASS": "review-rail document-only" if document_only else "review-rail",
        "QUEUE_SECTION": queue_section,
        "TOC_SECTION": toc_section,
        "TOOLS_SECTION": _tools_section(bool(item_queues)),
        "PROGRESS_SECTION": _progress_section(total_cards),
        "GENERATED_AT": html.escape(generated_at),
        "GENERATOR_VERSION": html.escape(str(identity["generator_version"])),
        "REVIEW_ID": html.escape(str(identity["review_id"])),
        "COUNT_ROWS": count_rows,
        "HELP_SENTENCE": html.escape(str(help_sentence)),
        "CARDS": cards,
    }
    page = _substitute(_resource_text("page.html"), _PAGE_TOKEN_RE, page_values)
    return page.replace(
        "<!-- REVIEW_CSS -->", f"<style>{_resource_text('review.css')}</style>"
    ).replace("<!-- REVIEW_JS -->", f"<script>{javascript}</script>")
