#!/usr/bin/env python3
"""Markdown Desk tool — lets Hermes write to the desktop note/kanban feature."""

from __future__ import annotations

import json
from typing import Any

from markdown_desk_store import add_block, add_card, read_state, state_to_markdown, write_state
from tools.registry import registry


VALID_ACTIONS = {"list", "add_note", "add_block", "add_card", "export_markdown"}


def markdown_desk_tool(
    action: str = "list",
    title: str | None = None,
    body: str | None = None,
    kind: str = "note",
    column: str = "todo",
    state: dict[str, Any] | None = None,
    **_: Any,
) -> str:
    """Read or update the shared Markdown Desk profile store."""
    action = (action or "list").strip().lower()
    if action not in VALID_ACTIONS:
        return json.dumps({"success": False, "error": f"Unsupported action: {action}"}, ensure_ascii=False)

    if action == "list":
        current = read_state()
        return json.dumps(
            {
                "success": True,
                "state": current,
                "summary": {
                    "blocks": len(current["blocks"]),
                    "cards": sum(len(column["cards"]) for column in current["kanban"]),
                },
            },
            ensure_ascii=False,
        )

    if action == "export_markdown":
        return json.dumps({"success": True, "markdown": state_to_markdown()}, ensure_ascii=False)

    if action in {"add_note", "add_block"}:
        if not body:
            return json.dumps({"success": False, "error": "body is required for add_note/add_block"}, ensure_ascii=False)
        result = add_block(title=title or "Hermes note", body=body, kind="note" if action == "add_note" else kind)
        return json.dumps({"success": True, **result}, ensure_ascii=False)

    if action == "add_card":
        if not title:
            return json.dumps({"success": False, "error": "title is required for add_card"}, ensure_ascii=False)
        result = add_card(title=title, body=body or "", column_id=column)
        return json.dumps({"success": True, **result}, ensure_ascii=False)

    if action == "replace_state":
        if state is None:
            return json.dumps({"success": False, "error": "state is required for replace_state"}, ensure_ascii=False)
        return json.dumps({"success": True, "state": write_state(state)}, ensure_ascii=False)

    return json.dumps({"success": False, "error": "Unhandled action"}, ensure_ascii=False)


def check_markdown_desk_requirements() -> bool:
    return True


MARKDOWN_DESK_SCHEMA = {
    "name": "markdown_desk",
    "description": (
        "Use Hermes Desktop's Markdown Desk: shared notes, Markdown blocks, and kanban cards. "
        "Use this when the user asks Hermes to note something down, save a note, create a Markdown block, "
        "or add a lightweight kanban card for them. Data is stored in the active Hermes profile and shown in "
        "the desktop Markdown Desk page."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list", "add_note", "add_block", "add_card", "export_markdown"],
                "description": "Operation to perform. Default list reads the current desk state.",
                "default": "list",
            },
            "title": {"type": "string", "description": "Title for a note/block/card."},
            "body": {"type": "string", "description": "Markdown body for notes/blocks, or card details."},
            "kind": {
                "type": "string",
                "enum": ["note", "markdown", "quote", "checklist"],
                "description": "Block type for add_block. add_note always uses note.",
                "default": "note",
            },
            "column": {
                "type": "string",
                "enum": ["todo", "doing", "done"],
                "description": "Kanban column for add_card.",
                "default": "todo",
            },
        },
        "required": [],
    },
}


registry.register(
    name="markdown_desk",
    toolset="markdown_desk",
    schema=MARKDOWN_DESK_SCHEMA,
    handler=lambda args, **kw: markdown_desk_tool(**args),
    check_fn=check_markdown_desk_requirements,
    emoji="📝",
)
