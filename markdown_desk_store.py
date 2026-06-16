"""Shared storage for the Hermes Desktop Markdown Desk feature.

The desktop UI, REST API, and agent tool all read/write the same JSON file under
HERMES_HOME so notes are profile-scoped and accessible to Hermes itself.
"""

from __future__ import annotations

import copy
import json
import time
import uuid
from pathlib import Path
from typing import Any, Literal

from hermes_constants import get_hermes_home

BlockKind = Literal["note", "markdown", "quote", "checklist"]
ColumnId = Literal["todo", "doing", "done"]

STORE_VERSION = 1
STORE_FILENAME = "markdown-desk.json"
VALID_BLOCK_KINDS = {"note", "markdown", "quote", "checklist"}
VALID_COLUMN_IDS = ("todo", "doing", "done")
COLUMN_TITLES = {"todo": "To do", "doing": "Doing", "done": "Done"}
MAX_TITLE_CHARS = 200
MAX_BODY_CHARS = 100_000
MAX_BLOCKS = 500
MAX_CARDS_PER_COLUMN = 500

DEFAULT_STATE: dict[str, Any] = {
    "version": STORE_VERSION,
    "activeBlockId": "daily-note",
    "updatedAt": None,
    "blocks": [
        {
            "id": "daily-note",
            "title": "Daily note",
            "kind": "markdown",
            "body": "# Daily note\n\n- [ ] Capture ideas\n- [ ] Turn the best ones into tasks\n\n## Notes\n\nWrite anything here. Use Markdown for headings, code, tables, quotes, and checklists.",
        },
        {
            "id": "scratchpad",
            "title": "Scratchpad",
            "kind": "note",
            "body": "## Scratchpad\n\nFast notes, links, snippets, and loose blocks go here.",
        },
    ],
    "kanban": [
        {
            "id": "todo",
            "title": "To do",
            "cards": [
                {
                    "id": "card-plan",
                    "title": "Plan feature",
                    "body": "Shape the Markdown workspace into notes + blocks + board.",
                }
            ],
        },
        {
            "id": "doing",
            "title": "Doing",
            "cards": [
                {
                    "id": "card-build",
                    "title": "Build page",
                    "body": "Implement local-first page in Hermes Desktop.",
                }
            ],
        },
        {"id": "done", "title": "Done", "cards": []},
    ],
}


def store_path() -> Path:
    return get_hermes_home() / STORE_FILENAME


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _clean_text(value: Any, max_chars: int) -> str:
    return str(value or "").strip()[:max_chars]


def _normalize_block(raw: Any, fallback_kind: str = "note") -> dict[str, str]:
    raw = raw if isinstance(raw, dict) else {}
    kind = str(raw.get("kind") or fallback_kind).strip().lower()
    if kind not in VALID_BLOCK_KINDS:
        kind = "note"
    title = _clean_text(raw.get("title") or kind.title(), MAX_TITLE_CHARS) or kind.title()
    body = _clean_text(raw.get("body"), MAX_BODY_CHARS)
    block_id = _clean_text(raw.get("id"), 120) or _new_id("block")
    return {"id": block_id, "title": title, "kind": kind, "body": body}


def _normalize_card(raw: Any) -> dict[str, str]:
    raw = raw if isinstance(raw, dict) else {}
    title = _clean_text(raw.get("title") or "Untitled", MAX_TITLE_CHARS) or "Untitled"
    body = _clean_text(raw.get("body"), MAX_BODY_CHARS)
    card_id = _clean_text(raw.get("id"), 120) or _new_id("card")
    return {"id": card_id, "title": title, "body": body}


def normalize_state(raw: Any) -> dict[str, Any]:
    data = raw if isinstance(raw, dict) else {}
    blocks = [_normalize_block(block) for block in data.get("blocks", []) if isinstance(block, dict)][:MAX_BLOCKS]
    if not blocks:
        blocks = copy.deepcopy(DEFAULT_STATE["blocks"])

    seen_block_ids: set[str] = set()
    for block in blocks:
        if block["id"] in seen_block_ids:
            block["id"] = _new_id("block")
        seen_block_ids.add(block["id"])

    columns_by_id: dict[str, Any] = {}
    for column in data.get("kanban", []):
        if not isinstance(column, dict):
            continue
        column_id = str(column.get("id") or "").strip().lower()
        if column_id in VALID_COLUMN_IDS:
            columns_by_id[column_id] = column

    kanban = []
    for column_id in VALID_COLUMN_IDS:
        raw_column = columns_by_id.get(column_id) or {}
        cards = [_normalize_card(card) for card in raw_column.get("cards", []) if isinstance(card, dict)][
            :MAX_CARDS_PER_COLUMN
        ]
        kanban.append(
            {
                "id": column_id,
                "title": _clean_text(raw_column.get("title") or COLUMN_TITLES[column_id], MAX_TITLE_CHARS)
                or COLUMN_TITLES[column_id],
                "cards": cards,
            }
        )

    active_block_id = _clean_text(data.get("activeBlockId"), 120)
    if not active_block_id or active_block_id not in {block["id"] for block in blocks}:
        active_block_id = blocks[0]["id"]

    return {
        "version": STORE_VERSION,
        "activeBlockId": active_block_id,
        "updatedAt": data.get("updatedAt"),
        "blocks": blocks,
        "kanban": kanban,
    }


def read_state() -> dict[str, Any]:
    path = store_path()
    if not path.exists():
        return normalize_state(DEFAULT_STATE)
    try:
        return normalize_state(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return normalize_state(DEFAULT_STATE)


def write_state(state: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_state(state)
    normalized["updatedAt"] = int(time.time() * 1000)
    path = store_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f"{path.suffix}.tmp")
    tmp.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)
    return normalized


def add_block(title: str, body: str, kind: str = "note", make_active: bool = True) -> dict[str, Any]:
    state = read_state()
    block = _normalize_block({"id": _new_id("block"), "title": title, "body": body, "kind": kind})
    state["blocks"].append(block)
    if make_active:
        state["activeBlockId"] = block["id"]
    state = write_state(state)
    return {"state": state, "block": block}


def add_card(title: str, body: str = "", column_id: str = "todo") -> dict[str, Any]:
    state = read_state()
    target = column_id if column_id in VALID_COLUMN_IDS else "todo"
    card = _normalize_card({"id": _new_id("card"), "title": title, "body": body})
    for column in state["kanban"]:
        if column["id"] == target:
            column["cards"].append(card)
            break
    state = write_state(state)
    return {"state": state, "card": card, "columnId": target}


def state_to_markdown(state: dict[str, Any] | None = None) -> str:
    state = normalize_state(state or read_state())
    blocks = []
    for block in state["blocks"]:
        blocks.append(f"<!-- block:{block['kind']}:{block['title']} -->\n{block['body'].strip()}")
    kanban_sections = []
    for column in state["kanban"]:
        lines = []
        for card in column["cards"]:
            body = card.get("body")
            suffix = f" — {body}" if body else ""
            lines.append(f"- [ ] **{card['title']}**{suffix}")
        cards = "\n".join(lines)
        kanban_sections.append(f"## {column['title']}\n{cards or '_No cards yet._'}")
    return "\n\n---\n\n".join(blocks) + "\n\n---\n\n# Kanban\n\n" + "\n\n".join(kanban_sections) + "\n"
