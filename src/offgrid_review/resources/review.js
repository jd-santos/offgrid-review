// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 JD Santos
// @ts-nocheck: build-time placeholders are replaced before this script runs.

const STORAGE_KEY = __STORAGE_KEY__;
const THEME_KEY = `${STORAGE_KEY}:theme`;
const DOWNLOAD_NAME = __DOWNLOAD_NAME__;
const CONSOLE_TITLE = __CONSOLE_TITLE__;
const REVIEW_META = __REVIEW_META__;
const ACTION_SPECS = __ACTION_SPECS__;
const ARTIFACT_IDENTITY = __ARTIFACT_IDENTITY__;
const RISK_ORDER = { high: 3, medium: 2, low: 1, none: 0 };
const cardIndex = new Map(
	[...document.querySelectorAll(".card")].map((card) => [
		card.dataset.id,
		card,
	]),
);
const documentBlockIndex = new Map(
	[...document.querySelectorAll(".document-block[data-id]")].map((block) => [
		block.dataset.id,
		block,
	]),
);
let storageAvailable = false;
let storageCompatibilityMessage = "";
let activeMobileCard = null;
let activeNavigationCard = null;
let mobileTrayOpen = false;
let mobileRaf = 0;

function embeddedJSON(element) {
	if (!element) return null;
	try {
		return JSON.parse(element.textContent);
	} catch (_) {
		return null;
	}
}

function actionSpec(queue, actionId) {
	return (
		ACTION_SPECS[`${queue}.${actionId}`] ||
		ACTION_SPECS[`_global.${actionId}`] ||
		{}
	);
}

function normalizeNotes(entry) {
	const notes = entry?.notes || {};
	return {
		item: String(notes.item ?? entry?.note ?? ""),
		actions: { ...(notes.actions || {}) },
		sections: { ...(notes.sections || {}) },
	};
}

function normalizeDecision(entry) {
	if (!entry || typeof entry !== "object") return null;
	let actions = [];
	if (Array.isArray(entry.actions)) {
		actions = entry.actions
			.map((action) =>
				typeof action === "string"
					? { id: action, label: action }
					: { id: action?.id, label: action?.label || action?.id },
			)
			.filter((action) => action.id);
	} else if (entry.action) {
		actions = [{ id: entry.action, label: entry.label || entry.action }];
	}
	return { ...entry, actions, notes: normalizeNotes(entry) };
}

function currentDecision(id, value) {
	const entry = normalizeDecision(value);
	if (!entry) return null;
	const card = cardIndex.get(id);
	if (card) {
		const controls = new Map(
			controlsForCard(card).map((control) => [control.dataset.action, control]),
		);
		const actions = entry.actions
			.filter((action) => controls.has(action.id))
			.map((action) => ({
				id: action.id,
				label: controls.get(action.id).dataset.label || action.id,
			}));
		return {
			...entry,
			id,
			queue: card.dataset.queue,
			actions,
			action: actions.length === 1 ? actions[0].id : null,
			label: actions.length === 1 ? actions[0].label : null,
		};
	}
	const block = documentBlockIndex.get(id);
	if (!block) return null;
	return {
		...entry,
		id,
		queue: block.dataset.queue,
		actions: [],
		action: null,
		label: null,
	};
}

function loadDecisions() {
	try {
		const probe = "__review_console_storage_probe__";
		localStorage.setItem(probe, "1");
		localStorage.removeItem(probe);
		storageAvailable = true;
	} catch (_) {
		storageAvailable = false;
		return {};
	}

	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return {};
	let stored;
	try {
		stored = JSON.parse(raw);
	} catch (_) {
		storageCompatibilityMessage = "Unreadable saved decisions were ignored.";
		return {};
	}
	if (
		stored?.schema_version !== ARTIFACT_IDENTITY.schema_version ||
		stored?.artifact_fingerprint !== ARTIFACT_IDENTITY.artifact_fingerprint ||
		!stored?.decisions ||
		typeof stored.decisions !== "object" ||
		Array.isArray(stored.decisions)
	) {
		storageCompatibilityMessage =
			"Saved decisions belonged to an older or different review and were ignored.";
		return {};
	}
	return Object.fromEntries(
		Object.entries(stored.decisions)
			.map(([id, entry]) => [id, currentDecision(id, entry)])
			.filter(([, entry]) => entry),
	);
}

let decisions = loadDecisions();
const totalCards = document.querySelectorAll(".card").length;
if (!totalCards) document.getElementById("mobileTray").hidden = true;

function updateStorageStatus() {
	const el = document.getElementById("storageStatus");
	const notice = document.getElementById("stateNotice");
	if (storageCompatibilityMessage) {
		el.textContent = "Incompatible saved state ignored";
		notice.textContent = storageCompatibilityMessage;
		notice.hidden = false;
	} else {
		el.textContent = storageAvailable
			? "Saved in this browser"
			: "Session only; download before closing";
		notice.hidden = true;
	}
	el.classList.toggle(
		"storage-warning",
		!storageAvailable || Boolean(storageCompatibilityMessage),
	);
}

function persist() {
	if (storageAvailable) {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({
					schema_version: ARTIFACT_IDENTITY.schema_version,
					artifact_fingerprint: ARTIFACT_IDENTITY.artifact_fingerprint,
					decisions,
				}),
			);
			storageCompatibilityMessage = "";
		} catch (_) {
			storageAvailable = false;
		}
		updateStorageStatus();
	}
	updateProgress();
}

function toast(message) {
	const el = document.getElementById("toast");
	el.textContent = message;
	el.classList.add("show");
	clearTimeout(window.reviewToastTimer);
	window.reviewToastTimer = setTimeout(() => el.classList.remove("show"), 1900);
}

function decisionColumn(card) {
	return document.querySelector(
		`.decision-column[data-owner-key="${CSS.escape(card.dataset.ownerKey)}"]`,
	);
}

function controlsForCard(card) {
	return [...(decisionColumn(card)?.querySelectorAll(".action-input") || [])];
}

function textareasForCard(card) {
	return [
		...card.querySelectorAll("textarea[data-note-target]"),
		...(decisionColumn(card)?.querySelectorAll("textarea[data-note-target]") ||
			[]),
	];
}

function cardForControl(control) {
	const direct = control.closest(".card");
	if (direct) return direct;
	const owner = control.closest(".decision-column")?.dataset.ownerId;
	return owner ? cardIndex.get(owner) : null;
}

function cardRaw(card) {
	return embeddedJSON(card.querySelector(".raw-item"));
}

function selectedActions(card) {
	return controlsForCard(card)
		.filter((input) => input.checked)
		.map((input) => ({
			id: input.dataset.action,
			label: input.dataset.label || input.dataset.action,
		}));
}

function readNotes(card) {
	const notes = { item: "", actions: {}, sections: {} };
	textareasForCard(card).forEach((textarea) => {
		const target = textarea.dataset.noteTarget || "item";
		const value = textarea.value;
		if (target === "item") notes.item = value;
		else if (target.startsWith("action:")) {
			notes.actions[target.slice(7)] = value;
		} else if (target.startsWith("section:")) {
			notes.sections[target.slice(8)] = value;
		}
	});
	return notes;
}

function noteCount(notes) {
	return [
		notes?.item,
		...Object.values(notes?.actions || {}),
		...Object.values(notes?.sections || {}),
	].filter((value) => String(value || "").trim()).length;
}

function hasNotes(notes) {
	return noteCount(notes) > 0;
}

function selectedIds(entry) {
	return (entry?.actions || []).map((action) => action.id);
}

function conflictPairs(entry) {
	const ids = new Set(selectedIds(entry));
	const pairs = new Set();
	for (const id of ids) {
		const spec = actionSpec(entry.queue, id);
		for (const other of spec.conflicts_with || []) {
			if (ids.has(other)) pairs.add([id, other].sort().join("|"));
		}
	}
	return [...pairs];
}

function updateAnnotationCounts(card, notes) {
	const column = decisionColumn(card);
	const scopes = [card, column].filter(Boolean);
	scopes.forEach((scope) => {
		scope.querySelectorAll("[data-count-target]").forEach((el) => {
			const target = el.dataset.countTarget;
			let value = "";
			if (target === "item") value = notes.item;
			else if (target.startsWith("action:"))
				value = notes.actions[target.slice(7)] || "";
			else if (target.startsWith("section:"))
				value = notes.sections[target.slice(8)] || "";
			el.textContent = String(value).trim() ? "Added" : "";
		});
	});
}

function applyDecisionState(card, entry) {
	const actions = entry?.actions || [];
	const notes = entry?.notes || { item: "", actions: {}, sections: {} };
	const conflicts = entry ? conflictPairs(entry) : [];
	const hasNote = hasNotes(notes);
	card.classList.toggle("done", actions.length > 0 || hasNote);
	card.classList.toggle("has-conflict", conflicts.length > 0);
	const state = card.querySelector(".decision-state");
	if (conflicts.length) state.textContent = "Review conflicting actions";
	else if (actions.length === 1) state.textContent = actions[0].label;
	else if (actions.length > 1)
		state.textContent = `${actions.length} actions selected`;
	else if (hasNote) state.textContent = "Complete with a note";
	else state.textContent = "Needs a decision";

	const ids = new Set(actions.map((action) => action.id));
	controlsForCard(card).forEach((input) => {
		input.checked = ids.has(input.dataset.action);
		input
			.closest(".action-option")
			?.classList.toggle("selected", input.checked);
	});

	const conflict = decisionColumn(card)?.querySelector(".card-conflict");
	if (conflict) {
		conflict.hidden = conflicts.length === 0;
		conflict.textContent = conflicts.length
			? "These choices conflict. Remove one before export."
			: "";
	}
	updateAnnotationCounts(card, notes);
	updateMobileTray(card);
}

function fillExistingNotes(card, notes) {
	textareasForCard(card).forEach((textarea) => {
		const target = textarea.dataset.noteTarget || "item";
		if (target === "item") textarea.value = notes.item || "";
		else if (target.startsWith("action:")) {
			textarea.value = notes.actions[target.slice(7)] || "";
		} else if (target.startsWith("section:")) {
			textarea.value = notes.sections[target.slice(8)] || "";
		}
	});
}

function applyExisting() {
	cardIndex.forEach((card) => {
		const entry = decisions[card.dataset.id];
		if (!entry) return;
		fillExistingNotes(card, entry.notes);
		applyDecisionState(card, entry);
	});
}

function documentBlockRaw(block) {
	return embeddedJSON(block.querySelector(".block-raw"));
}

function updateDocumentAnnotationState(block, value) {
	const count = block.querySelector("[data-document-count]");
	if (count) count.textContent = String(value || "").trim() ? "Added" : "";
}

function applyExistingDocumentAnnotations() {
	documentBlockIndex.forEach((block) => {
		const entry = decisions[block.dataset.id];
		const value = entry?.notes?.item || entry?.note || "";
		const textarea = block.querySelector("textarea[data-document-note]");
		if (textarea) textarea.value = value;
		updateDocumentAnnotationState(block, value);
	});
}

function syncDocumentAnnotation(block) {
	const id = block.dataset.id;
	const textarea = block.querySelector("textarea[data-document-note]");
	const value = textarea?.value || "";
	if (!value.trim()) {
		delete decisions[id];
		updateDocumentAnnotationState(block, "");
		persist();
		return;
	}
	const now = new Date().toISOString();
	decisions[id] = {
		id,
		queue: block.dataset.queue,
		actions: [],
		action: null,
		label: null,
		note: value,
		notes: { item: value, actions: {}, sections: {} },
		item: documentBlockRaw(block),
		decided_at: null,
		updated_at: now,
	};
	updateDocumentAnnotationState(block, value);
	persist();
}

function syncDecision(card) {
	const id = card.dataset.id;
	const previous = decisions[id] || {};
	const actions = selectedActions(card);
	const notes = readNotes(card);
	if (!actions.length && !hasNotes(notes)) {
		delete decisions[id];
		applyDecisionState(card, null);
		persist();
		return;
	}
	const now = new Date().toISOString();
	decisions[id] = {
		...previous,
		id,
		queue: card.dataset.queue,
		actions,
		action: actions.length === 1 ? actions[0].id : null,
		label: actions.length === 1 ? actions[0].label : null,
		note: notes.item,
		notes,
		item: cardRaw(card),
		decided_at:
			previous.decided_at || (actions.length || hasNotes(notes) ? now : null),
		updated_at: now,
	};
	applyDecisionState(card, decisions[id]);
	persist();
}

function handleActionChange(input) {
	const card = cardForControl(input);
	if (!card) return;
	const controls = controlsForCard(card);
	if (input.checked) {
		const single = card.dataset.selectionMode === "single";
		const exclusive = input.dataset.exclusive === "true";
		if (single || exclusive) {
			controls.forEach((other) => {
				if (other !== input) other.checked = false;
			});
		} else {
			controls.forEach((other) => {
				if (other !== input && other.dataset.exclusive === "true")
					other.checked = false;
			});
		}
	}
	syncDecision(card);
	applyFilters();
}

document.querySelectorAll(".action-input").forEach((input) => {
	input.addEventListener("change", () => handleActionChange(input));
});

document.querySelectorAll("textarea[data-note-target]").forEach((textarea) => {
	textarea.addEventListener("input", () => {
		const card = cardForControl(textarea);
		if (card) {
			syncDecision(card);
			applyFilters();
		}
	});
});

document
	.querySelectorAll("textarea[data-document-note]")
	.forEach((textarea) => {
		textarea.addEventListener("input", () => {
			const block = textarea.closest(".document-block");
			if (block) syncDocumentAnnotation(block);
		});
	});

document.querySelectorAll(".annotation-toggle").forEach((button) => {
	button.addEventListener("click", () => {
		const panel = document.getElementById(button.getAttribute("aria-controls"));
		if (!panel) return;
		const opening = panel.hidden;
		panel.hidden = !opening;
		button.setAttribute("aria-expanded", String(opening));
		if (opening) panel.querySelector("textarea")?.focus();
	});
});

function actionNote(entry, actionId) {
	return entry.notes?.actions?.[actionId] || entry.notes?.item || "";
}

function reviewSummary() {
	const entries = Object.values(decisions);
	const completed = [...cardIndex.values()].filter((card) => {
		const entry = decisions[card.dataset.id];
		if (!entry) return false;
		return (
			selectedIds(entry).length > 0 ||
			hasNotes(entry.notes || normalizeNotes(entry))
		);
	}).length;
	const remaining = Math.max(0, totalCards - completed);
	const byAction = {};
	let highRisk = 0;
	let irreversible = 0;
	let missingRequiredNotes = 0;
	let conflicts = 0;
	let annotationCount = 0;

	entries.forEach((entry) => {
		annotationCount += noteCount(entry.notes || normalizeNotes(entry));
		if (conflictPairs(entry).length) conflicts += 1;
		for (const action of entry.actions || []) {
			const spec = actionSpec(entry.queue, action.id);
			const label = action.label || spec.label || action.id;
			byAction[label] = (byAction[label] || 0) + 1;
			if (RISK_ORDER[spec.risk || "none"] >= RISK_ORDER.high) highRisk += 1;
			if (spec.reversible === false) irreversible += 1;
			if (
				(spec.requires_note || spec.reversible === false) &&
				!String(actionNote(entry, action.id)).trim()
			) {
				missingRequiredNotes += 1;
			}
		}
	});

	const incomplete = remaining > 0;
	const warnings = [];
	if (incomplete) {
		warnings.push(
			`${remaining} decision${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s" : ""} an answer`,
		);
	}
	if (highRisk)
		warnings.push(`${highRisk} high-risk action${highRisk === 1 ? "" : "s"}`);
	if (irreversible)
		warnings.push(
			`${irreversible} irreversible action${irreversible === 1 ? "" : "s"}`,
		);
	if (missingRequiredNotes) {
		warnings.push(
			`${missingRequiredNotes} required rationale note${missingRequiredNotes === 1 ? " is" : "s are"} missing`,
		);
	}
	if (conflicts) {
		warnings.push(
			`${conflicts} decision${conflicts === 1 ? "" : "s"} contain${conflicts === 1 ? "s" : ""} conflicting actions`,
		);
	}
	return {
		completed,
		remaining,
		total: totalCards,
		incomplete,
		byAction: Object.entries(byAction).sort((a, b) => b[1] - a[1]),
		highRisk,
		irreversible,
		missingRequiredNotes,
		conflicts,
		annotationCount,
		warnings,
	};
}

function updateProgress() {
	const summary = reviewSummary();
	const progressText = `${summary.completed} of ${summary.total} decisions complete`;
	document.getElementById("progressCount").textContent =
		`${summary.completed} of ${summary.total}`;
	document.getElementById("progressPercent").textContent = summary.total
		? `${Math.round((summary.completed / summary.total) * 100)}%`
		: "100%";
	document.getElementById("progressFill").style.transform = summary.total
		? `scaleX(${summary.completed / summary.total})`
		: "scaleX(1)";
	const progressTrack = document.getElementById("progressTrack");
	progressTrack.setAttribute("aria-valuenow", String(summary.completed));
	progressTrack.setAttribute("aria-valuetext", progressText);

	document.querySelectorAll("[data-queue-progress]").forEach((el) => {
		const queue = el.dataset.queueProgress;
		const cards = [
			...document.querySelectorAll(`.card[data-queue="${CSS.escape(queue)}"]`),
		];
		const completed = cards.filter((card) =>
			card.classList.contains("done"),
		).length;
		el.textContent = `${completed}/${cards.length}`;
		el.closest("a")?.setAttribute(
			"aria-label",
			`${el.dataset.queueName}, ${completed} of ${cards.length} complete`,
		);
	});

	const warning = document.getElementById("summaryWarning");
	const activeWarnings =
		summary.highRisk ||
		summary.irreversible ||
		summary.conflicts ||
		summary.missingRequiredNotes;
	warning.hidden = !activeWarnings;
	if (activeWarnings) {
		document.getElementById("summaryWarningText").textContent =
			`${summary.warnings.filter((message) => !message.includes("need an answer")).join("; ")}.`;
	}
}

function textElement(tagName, text, className = "") {
	const element = document.createElement(tagName);
	element.textContent = String(text);
	if (className) element.className = className;
	return element;
}

function summaryRow(label, value, state = "") {
	const row = document.createElement("div");
	row.className = `summary-row${state ? ` ${state}` : ""}`;
	row.append(textElement("dt", label), textElement("dd", value));
	return row;
}

function summaryButton(label, handler, className = "") {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	if (className) button.className = className;
	button.addEventListener("click", handler);
	return button;
}

function openSummary() {
	const summary = reviewSummary();
	const body = document.getElementById("summaryBody");
	const notice = document.createElement("div");
	if (summary.warnings.length) {
		notice.className = "summary-banner";
		notice.append(
			textElement("strong", "Before export:"),
			document.createTextNode(` ${summary.warnings.join("; ")}.`),
		);
	} else {
		notice.className = "empty";
		notice.append(
			textElement("strong", "Review complete."),
			document.createTextNode(" The decision file is ready to export."),
		);
	}

	const rows = document.createElement("dl");
	rows.className = "summary-rows";
	rows.append(
		summaryRow(
			"Complete",
			`${summary.completed} of ${summary.total}`,
			summary.incomplete ? "" : "good",
		),
		summaryRow(
			"Needs a decision",
			summary.remaining,
			summary.remaining ? "warning" : "good",
		),
		summaryRow(
			"High-risk actions",
			summary.highRisk,
			summary.highRisk ? "bad" : "",
		),
		summaryRow(
			"Irreversible actions",
			summary.irreversible,
			summary.irreversible ? "bad" : "",
		),
		summaryRow("Conflicts", summary.conflicts, summary.conflicts ? "bad" : ""),
		summaryRow(
			"Missing rationale",
			summary.missingRequiredNotes,
			summary.missingRequiredNotes ? "bad" : "",
		),
		summaryRow("Notes added", summary.annotationCount),
	);

	const actionsHeading = textElement("h3", "Selected actions");
	let actionList;
	if (summary.byAction.length) {
		actionList = document.createElement("ul");
		actionList.className = "summary-list";
		summary.byAction.forEach(([label, count]) => {
			const item = document.createElement("li");
			item.append(textElement("span", label), textElement("b", count));
			actionList.append(item);
		});
	} else {
		actionList = textElement(
			"p",
			"No actions selected. Notes are listed in the exported annotations.",
			"field-hint",
		);
	}

	const actions = document.createElement("div");
	actions.className = "summary-actions";
	const continueButton = summaryButton("Continue review", jumpToIncomplete);
	continueButton.disabled = !summary.incomplete;
	actions.append(
		summaryButton(
			"Download decisions",
			() => exportFromSummary("download"),
			"button-primary",
		),
		summaryButton("Copy decisions", () => exportFromSummary("copy")),
		continueButton,
	);

	body.replaceChildren(notice, rows, actionsHeading, actionList, actions);
	const panel = document.getElementById("summaryPanel");
	const trigger = document.getElementById("summaryTrigger");
	panel.hidden = false;
	trigger.setAttribute("aria-expanded", "true");
	panel.querySelector(".summary-close").focus();
}

function hideSummary() {
	document.getElementById("summaryPanel").hidden = true;
	document
		.getElementById("summaryTrigger")
		.setAttribute("aria-expanded", "false");
}

function closeSummary() {
	hideSummary();
	document.getElementById("summaryTrigger").focus();
}

function focusDecision(card) {
	const target =
		controlsForCard(card)[0] ||
		decisionColumn(card)?.querySelector('textarea[data-note-target="item"]') ||
		card;
	target.focus({ preventScroll: true });
}

function jumpToIncomplete() {
	hideSummary();
	const card = [...document.querySelectorAll(".card:not(.done)")].find(
		(candidate) => !candidate.hidden && !candidate.closest(".queue").hidden,
	);
	if (!card) {
		toast("Every visible decision is complete");
		return;
	}
	activeNavigationCard = card;
	card.scrollIntoView({ behavior: "smooth", block: "center" });
	setActiveMobileCard(card);
	focusDecision(card);
}

function canonicalDecision(entry) {
	const actions = (entry.actions || []).map((action) => ({
		id: action.id,
		label: action.label || action.id,
	}));
	return {
		...entry,
		actions,
		action: actions.length === 1 ? actions[0].id : null,
		label: actions.length === 1 ? actions[0].label : null,
		note: entry.notes?.item || entry.note || "",
	};
}

function decisionPayload() {
	const summary = reviewSummary();
	const entries = Object.values(decisions).map(canonicalDecision);
	return {
		...REVIEW_META,
		...ARTIFACT_IDENTITY,
		console_title: CONSOLE_TITLE,
		exported_at: new Date().toISOString(),
		complete: !summary.incomplete,
		valid: summary.conflicts === 0 && summary.missingRequiredNotes === 0,
		warnings: summary.warnings,
		decisions: entries.filter((entry) => entry.actions.length > 0),
		annotations: entries
			.filter((entry) => entry.actions.length === 0 && hasNotes(entry.notes))
			.map((entry) => ({
				id: entry.id,
				queue: entry.queue,
				notes: entry.notes,
				item: entry.item,
				updated_at: entry.updated_at,
			})),
	};
}

function showExportPreview(text, message) {
	const box = document.getElementById("exportBox");
	box.value = text;
	box.style.display = "block";
	box.focus();
	box.select();
	toast(message);
}

function exportDecisions(mode) {
	if (reviewSummary().warnings.length) {
		openSummary();
		return;
	}
	writeDecisionExport(mode);
}

function exportFromSummary(mode) {
	writeDecisionExport(mode);
}

function writeDecisionExport(mode) {
	const text = JSON.stringify(decisionPayload(), null, 2);
	if (mode === "preview") {
		showExportPreview(text, "Decisions opened below as JSON");
		return;
	}
	if (mode === "copy") {
		if (navigator.clipboard?.writeText) {
			navigator.clipboard
				.writeText(text)
				.then(() => toast("Decisions copied as JSON"))
				.catch(() =>
					showExportPreview(text, "Clipboard unavailable; copy the JSON below"),
				);
		} else {
			showExportPreview(text, "Clipboard unavailable; copy the JSON below");
		}
		return;
	}
	const date = new Date().toISOString().slice(0, 10);
	const blob = new Blob([text], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${DOWNLOAD_NAME}${date}.json`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
	toast("Decisions downloaded as JSON");
}

function clearDecisions() {
	if (!confirm("Clear all decisions and notes saved in this browser?")) return;
	decisions = {};
	cardIndex.forEach((card) => {
		controlsForCard(card).forEach((input) => {
			input.checked = false;
		});
		textareasForCard(card).forEach((textarea) => {
			textarea.value = "";
		});
		applyDecisionState(card, null);
	});
	documentBlockIndex.forEach((block) => {
		const textarea = block.querySelector("textarea[data-document-note]");
		if (textarea) textarea.value = "";
		updateDocumentAnnotationState(block, "");
	});
	persist();
	applyFilters();
	toast("Decisions and notes cleared");
}

const searchInput = document.getElementById("reviewSearch");
const queueFilter = document.getElementById("queueFilter");
const stateFilter = document.getElementById("stateFilter");

function applyFilters() {
	const query = searchInput?.value.trim().toLowerCase() || "";
	const queueId = queueFilter?.value || "";
	const state = stateFilter?.value || "all";
	let visibleCards = 0;
	document.querySelectorAll(".queue").forEach((queue) => {
		let queueVisible = 0;
		queue.querySelectorAll(".card").forEach((card) => {
			const queueMatch = !queueId || card.dataset.queue === queueId;
			const complete = card.classList.contains("done");
			const stateMatch =
				state === "all" || (state === "complete" ? complete : !complete);
			const searchMatch = !query || (card.dataset.search || "").includes(query);
			const focused = cardForControl(document.activeElement) === card;
			card.hidden = !(queueMatch && stateMatch && searchMatch) && !focused;
			if (!card.hidden) {
				queueVisible += 1;
				visibleCards += 1;
			}
		});
		const hasCards = queue.querySelectorAll(".card").length > 0;
		queue.hidden =
			(queueId && queue.id !== queueId) || (hasCards && queueVisible === 0);
	});
	const filterStatus = document.getElementById("filterStatus");
	if (filterStatus) {
		filterStatus.textContent = `${visibleCards} decision${visibleCards === 1 ? "" : "s"} shown`;
	}
	scheduleMobileCardUpdate();
	scheduleNavigationUpdate();
}

function moveToIncomplete(direction) {
	const visible = [...document.querySelectorAll(".card")].filter(
		(card) => !card.hidden && !card.closest(".queue").hidden,
	);
	const incomplete = visible.filter((card) => !card.classList.contains("done"));
	if (!incomplete.length) {
		toast("Every visible decision is complete");
		return;
	}
	const focused = cardForControl(document.activeElement);
	const current = focused || activeNavigationCard || activeMobileCard;
	const candidateIndex = incomplete.indexOf(current);
	let target;
	if (candidateIndex >= 0) {
		const nextIndex =
			(candidateIndex + direction + incomplete.length) % incomplete.length;
		target = incomplete[nextIndex];
	} else {
		const currentIndex = visible.indexOf(current);
		const ordered =
			direction > 0
				? [
						...incomplete.filter(
							(card) => visible.indexOf(card) > currentIndex,
						),
						...incomplete.filter(
							(card) => visible.indexOf(card) <= currentIndex,
						),
					]
				: [
						...incomplete
							.filter((card) => visible.indexOf(card) < currentIndex)
							.sort(
								(first, second) =>
									visible.indexOf(second) - visible.indexOf(first),
							),
						...incomplete
							.filter((card) => visible.indexOf(card) >= currentIndex)
							.sort(
								(first, second) =>
									visible.indexOf(second) - visible.indexOf(first),
							),
					];
		target =
			ordered[0] || incomplete[direction > 0 ? 0 : incomplete.length - 1];
	}
	activeNavigationCard = target;
	target.scrollIntoView({ behavior: "smooth", block: "center" });
	setActiveMobileCard(target);
	focusDecision(target);
	applyFilters();
}

function initializeQueueFilter() {
	if (!queueFilter) return;
	document
		.querySelectorAll('.queue[data-review-queue="true"]')
		.forEach((queue) => {
			const option = document.createElement("option");
			option.value = queue.id;
			option.textContent = queue.querySelector("h2")?.textContent || queue.id;
			queueFilter.appendChild(option);
		});
}

function setTheme(value) {
	const theme = ["light", "dark"].includes(value) ? value : "system";
	if (theme === "system")
		document.documentElement.removeAttribute("data-theme");
	else document.documentElement.dataset.theme = theme;
	document.getElementById("themeSelect").value = theme;
	if (storageAvailable) {
		try {
			localStorage.setItem(THEME_KEY, theme);
		} catch (_) {
			/* no-op */
		}
	}
}

function initializeTheme() {
	let theme = "system";
	try {
		theme = localStorage.getItem(THEME_KEY) || "system";
	} catch (_) {
		/* no-op */
	}
	setTheme(theme);
}

function restoreMobileColumn() {
	if (!activeMobileCard) return;
	const column = decisionColumn(activeMobileCard);
	if (column && column.parentElement?.id === "mobileTrayBody") {
		activeMobileCard.appendChild(column);
	}
}

function updateMobileTray(card) {
	if (!card || card !== activeMobileCard) return;
	document.getElementById("mobileTrayState").textContent =
		card.querySelector(".decision-state")?.textContent || "Needs a decision";
}

function setActiveMobileCard(card) {
	if (!window.matchMedia("(max-width: 680px)").matches || !card || card.hidden)
		return;
	if (activeMobileCard === card) {
		updateMobileTray(card);
		return;
	}
	restoreMobileColumn();
	activeMobileCard = card;
	const column = decisionColumn(card);
	if (column) document.getElementById("mobileTrayBody").appendChild(column);
	document.getElementById("mobileTrayItem").textContent =
		card.querySelector(".card-title")?.textContent || "Decision";
	updateMobileTray(card);
}

function nearestVisibleCard() {
	const cards = [...document.querySelectorAll(".card")].filter(
		(card) => !card.hidden && !card.closest(".queue").hidden,
	);
	if (!cards.length) return null;
	const targetY = window.innerHeight * 0.42;
	return cards.reduce((nearest, card) => {
		const rect = card.getBoundingClientRect();
		const distance = Math.abs(
			rect.top + Math.min(rect.height, window.innerHeight) / 2 - targetY,
		);
		return !nearest || distance < nearest.distance
			? { card, distance }
			: nearest;
	}, null)?.card;
}

function scheduleMobileCardUpdate() {
	if (!window.matchMedia("(max-width: 680px)").matches) return;
	cancelAnimationFrame(mobileRaf);
	mobileRaf = requestAnimationFrame(() =>
		setActiveMobileCard(nearestVisibleCard()),
	);
}

function toggleMobileTray() {
	mobileTrayOpen = !mobileTrayOpen;
	document.getElementById("mobileTrayBody").hidden = !mobileTrayOpen;
	const button = document.getElementById("mobileTrayToggle");
	button.setAttribute("aria-expanded", String(mobileTrayOpen));
	button.textContent = mobileTrayOpen ? "Close actions" : "Actions";
}

function handleViewportChange() {
	if (!window.matchMedia("(max-width: 1120px)").matches) closeContentsDrawer();
	if (window.matchMedia("(max-width: 680px)").matches) {
		setActiveMobileCard(nearestVisibleCard());
	} else {
		restoreMobileColumn();
		activeMobileCard = null;
		mobileTrayOpen = false;
		document.getElementById("mobileTrayBody").hidden = true;
		document
			.getElementById("mobileTrayToggle")
			.setAttribute("aria-expanded", "false");
		document.getElementById("mobileTrayToggle").textContent = "Actions";
	}
}

searchInput?.addEventListener("input", applyFilters);
queueFilter?.addEventListener("change", applyFilters);
stateFilter?.addEventListener("change", applyFilters);
document.addEventListener("focusin", (event) => {
	if (stateFilter?.value !== "all" && !cardForControl(event.target))
		applyFilters();
});
document
	.getElementById("prevIncomplete")
	?.addEventListener("click", () => moveToIncomplete(-1));
document
	.getElementById("nextIncomplete")
	?.addEventListener("click", () => moveToIncomplete(1));
document
	.getElementById("mobilePrevious")
	.addEventListener("click", () => moveToIncomplete(-1));
document
	.getElementById("mobileNext")
	.addEventListener("click", () => moveToIncomplete(1));
document
	.getElementById("mobileTrayToggle")
	.addEventListener("click", toggleMobileTray);
document
	.getElementById("themeSelect")
	.addEventListener("change", (event) => setTheme(event.target.value));
const aboutReview = document.getElementById("aboutReview");
const aboutTrigger = document.getElementById("aboutTrigger");
const tocLauncher = document.getElementById("tocLauncher");
const tocDrawer = document.getElementById("tocDrawer");
const tocDrawerClose = document.getElementById("tocDrawerClose");
aboutTrigger.addEventListener("click", (event) => {
	event.stopPropagation();
	const pinned = aboutReview.classList.toggle("pinned");
	aboutTrigger.setAttribute("aria-expanded", String(pinned));
});
document.addEventListener("click", (event) => {
	if (!aboutReview.contains(event.target)) {
		aboutReview.classList.remove("pinned");
		aboutTrigger.setAttribute("aria-expanded", "false");
	}
	if (
		tocDrawer &&
		!tocDrawer.hidden &&
		!tocDrawer.contains(event.target) &&
		!tocLauncher?.contains(event.target)
	) {
		closeContentsDrawer();
	}
});
const queueLinks = [...document.querySelectorAll("[data-queue-target]")];
const queueTargets = queueLinks
	.map((link) => document.getElementById(link.dataset.queueTarget))
	.filter(Boolean);
const tocLinks = [...document.querySelectorAll(".toc-link")];
const tocTargets = [...new Set(tocLinks.map((link) => link.dataset.tocTarget))]
	.map((id) => document.getElementById(id))
	.filter(Boolean);
let navigationRaf = 0;

function openContentsDrawer() {
	if (!tocDrawer || !tocLauncher) return;
	tocDrawer.hidden = false;
	tocLauncher.setAttribute("aria-expanded", "true");
	tocDrawerClose?.focus();
}

function closeContentsDrawer(returnFocus = false) {
	if (!tocDrawer || !tocLauncher) return;
	tocDrawer.hidden = true;
	tocLauncher.setAttribute("aria-expanded", "false");
	if (returnFocus) tocLauncher.focus();
}

function toggleContentsDrawer() {
	if (tocDrawer?.hidden) openContentsDrawer();
	else closeContentsDrawer();
}

tocLauncher?.addEventListener("click", toggleContentsDrawer);
tocDrawerClose?.addEventListener("click", () => closeContentsDrawer(true));

function updateDocumentToc() {
	if (!tocTargets.length) return;
	const headerOffset =
		(document.querySelector(".app-header")?.getBoundingClientRect().height ||
			0) + 28;
	let active = tocTargets[0];
	tocTargets.forEach((target) => {
		if (target.getBoundingClientRect().top <= headerOffset) active = target;
	});
	tocLinks.forEach((link) => {
		if (link.dataset.tocTarget === active.id)
			link.setAttribute("aria-current", "location");
		else link.removeAttribute("aria-current");
	});
}

function updateQueueNavigation() {
	if (!queueTargets.length) return;
	const headerOffset =
		(document.querySelector(".app-header")?.getBoundingClientRect().height ||
			0) + 28;
	let active = queueTargets.find((target) => !target.hidden) || queueTargets[0];
	queueTargets.forEach((target) => {
		if (!target.hidden && target.getBoundingClientRect().top <= headerOffset)
			active = target;
	});
	queueLinks.forEach((link) => {
		if (link.dataset.queueTarget === active.id)
			link.setAttribute("aria-current", "location");
		else link.removeAttribute("aria-current");
	});
}

function scheduleNavigationUpdate() {
	cancelAnimationFrame(navigationRaf);
	navigationRaf = requestAnimationFrame(() => {
		updateDocumentToc();
		updateQueueNavigation();
	});
}

tocLinks.forEach((link) => {
	link.addEventListener("click", () => {
		if (tocDrawer?.contains(link)) closeContentsDrawer();
		const target = document.getElementById(link.dataset.tocTarget);
		setTimeout(() => target?.focus({ preventScroll: true }), 0);
	});
});

window.addEventListener(
	"scroll",
	() => {
		scheduleMobileCardUpdate();
		scheduleNavigationUpdate();
	},
	{ passive: true },
);
window.addEventListener("resize", () => {
	handleViewportChange();
	scheduleNavigationUpdate();
});

document.addEventListener("keydown", (event) => {
	const editing = document.activeElement?.matches?.(
		'textarea, select, input:not([type="checkbox"]):not([type="radio"]), [contenteditable="true"]',
	);
	if (
		event.key === "Escape" &&
		!document.getElementById("summaryPanel").hidden
	) {
		closeSummary();
	}
	if (event.key === "Escape" && aboutReview.classList.contains("pinned")) {
		aboutReview.classList.remove("pinned");
		aboutTrigger.setAttribute("aria-expanded", "false");
		aboutTrigger.focus();
	}
	if (event.key === "Escape" && tocDrawer && !tocDrawer.hidden) {
		closeContentsDrawer(true);
	}
	if (event.altKey && event.key === "/" && !editing && searchInput) {
		event.preventDefault();
		searchInput.focus();
	}
	if (event.altKey && !editing && event.key.toLowerCase() === "j") {
		event.preventDefault();
		moveToIncomplete(1);
	}
	if (event.altKey && !editing && event.key.toLowerCase() === "k") {
		event.preventDefault();
		moveToIncomplete(-1);
	}
});

initializeQueueFilter();
initializeTheme();
applyExisting();
applyExistingDocumentAnnotations();
updateStorageStatus();
updateProgress();
applyFilters();
handleViewportChange();
updateDocumentToc();
updateQueueNavigation();
