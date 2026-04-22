"""Tests for Cursor Usage Parser — extracts per-session usage stats from state.vscdb (Issue #566)."""

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from vibesmith_core.usage.cursor_usage_parser import parse_cursor_agentkv_db, parse_cursor_db


def _create_mock_cursor_db(db_path: str, entries: dict[str, str | bytes]) -> None:
    """Create mock Cursor state.vscdb for testing."""
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE IF NOT EXISTS cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)")
    for key, value in entries.items():
        conn.execute("INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()


def _composer_entry(
    rules: list[dict] | None = None,
    *,
    commands: list[dict] | None = None,
    subagents: list[dict] | None = None,
    mentions: dict[str, dict[str, dict]] | None = None,
    newly_created_files: list[dict] | None = None,
    added_files: list[dict] | None = None,
    created_at: int = 1708300000000,
) -> str:
    """Generate composerData entry JSON."""
    return json.dumps(
        {
            "createdAt": created_at,
            "context": {
                "cursorRules": rules or [],
                "cursorCommands": commands or [],
                "subagentSelections": subagents or [],
                "mentions": mentions or {},
            },
            "newlyCreatedFiles": newly_created_files or [],
            "addedFiles": added_files or [],
        }
    )


def _rule_ref(name: str, path: str = "") -> dict:
    """Generate rule reference within cursorRules array."""
    return {"name": name, "path": path or f"/project/.cursor/rules/{name}"}


def _agentkv_blob_entry(payload: dict) -> str:
    """Generate hex payload for agentKv:blob value."""
    return json.dumps(payload, ensure_ascii=False).encode("utf-8").hex()


def _agentkv_blob_json_entry(payload: dict) -> bytes:
    """Generate UTF-8 JSON BLOB payload for agentKv:blob value."""
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class TestParseCursorDb:
    """Tests for Cursor state.vscdb parsing."""

    def test_parse_extracts_rules_usage(self, tmp_path: Path):
        """Extracts cursorRules usage stats from composerData."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:abc123": _composer_entry(
                    [
                        _rule_ref("my-rule.mdc"),
                        _rule_ref("other-rule.mdc"),
                    ]
                ),
            },
        )

        results = parse_cursor_db(db_path)

        assert len(results) == 1
        session = results[0]
        assert session["session_key"] == "composerData:abc123"
        assert len(session["stats"]) == 2
        names = {s["component_name"] for s in session["stats"]}
        assert names == {"my-rule", "other-rule"}
        for s in session["stats"]:
            assert s["component_type"] == "rule"
            assert s["use_count"] == 1

    def test_parse_falls_back_to_filename_when_name_missing(self, tmp_path: Path):
        """Falls back to filename as component_name when name is missing."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:abc123": _composer_entry(
                    [
                        {"filename": "from-filename.mdc"},
                        {"filename": "/project/.cursor/rules/path-based-rule.mdc"},
                    ]
                ),
            },
        )

        results = parse_cursor_db(db_path)

        assert len(results) == 1
        session = results[0]
        names = {s["component_name"] for s in session["stats"]}
        assert names == {"from-filename", "path-based-rule"}

    def test_parse_normalizes_skill_command_and_disabled_paths(self, tmp_path: Path):
        """Normalizes SKILL.md/commands/rules paths and .disabled extensions to slugs."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:abc123": _composer_entry(
                    [
                        {"filename": "create-skill/SKILL.md"},
                        {"filename": r"C:\\repo\\.cursor\\skills\\my-helper\\SKILL.md.disabled"},
                        {"filename": "/repo/.cursor/commands/task-start.md"},
                        {"filename": "/repo/.cursor/rules/strict-mode.mdc.disabled"},
                        {"filename": "/repo/.cursor/rules/routing.md"},
                    ]
                ),
            },
        )

        results = parse_cursor_db(db_path)

        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("create-skill", "skill") in stats
        assert ("my-helper", "skill") in stats
        assert ("task-start", "command") in stats
        assert ("strict-mode", "rule") in stats
        assert ("routing", "rule") in stats

    def test_parse_extracts_cursor_commands_when_rules_empty(self, tmp_path: Path):
        """Parses cursorCommands as command usage even when cursorRules is empty."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:cmd-only": _composer_entry(
                    commands=[
                        {"filename": "auto-implement.md"},
                        {"path": "/repo/.cursor/commands/task-start.md"},
                    ]
                ),
            },
        )

        results = parse_cursor_db(db_path)

        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("auto-implement", "command") in stats
        assert ("task-start", "command") in stats

    def test_parse_extracts_components_from_mentions(self, tmp_path: Path):
        """Parses command/rule/subagent references in context.mentions."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:new-file": _composer_entry(
                    mentions={
                        "cursorCommands": {"work-session.md": {}},
                        "cursorRules": {"create-skill/SKILL.md": {}},
                        "subagentSelections": {"agent-task-manager.md": {}},
                    }
                ),
            },
        )

        results = parse_cursor_db(db_path)

        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("work-session", "command") in stats
        assert ("create-skill", "skill") in stats
        assert ("agent-task-manager", "agent") in stats

    def test_parse_empty_db(self, tmp_path: Path):
        """Empty DB returns empty list."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(db_path, {})

        results = parse_cursor_db(db_path)
        assert results == []

    def test_parse_nonexistent_db(self, tmp_path: Path):
        """Non-existent DB returns empty list."""
        results = parse_cursor_db(str(tmp_path / "nonexistent.vscdb"))
        assert results == []

    def test_parse_missing_table(self, tmp_path: Path):
        """Returns empty list when cursorDiskKV table is missing."""
        db_path = str(tmp_path / "state.vscdb")
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE other_table (key TEXT)")
        conn.close()

        results = parse_cursor_db(db_path)
        assert results == []

    def test_parse_multiple_sessions(self, tmp_path: Path):
        """Returns multiple composerData sessions independently."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:session1": _composer_entry(
                    [_rule_ref("shared-rule.mdc"), _rule_ref("only-in-1.mdc")],
                    created_at=1708300000000,
                ),
                "composerData:session2": _composer_entry(
                    [_rule_ref("shared-rule.mdc")],
                    created_at=1708400000000,
                ),
            },
        )

        results = parse_cursor_db(db_path)
        assert len(results) == 2

        keys = {r["session_key"] for r in results}
        assert keys == {"composerData:session1", "composerData:session2"}

    def test_parse_invalid_json_skipped(self, tmp_path: Path):
        """Skips entries with JSON parse failures."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:bad": "not valid json {{{",
                "composerData:good": _composer_entry([_rule_ref("valid-rule.mdc")]),
            },
        )

        results = parse_cursor_db(db_path)
        assert len(results) == 1
        assert results[0]["session_key"] == "composerData:good"

    def test_parse_no_rules_in_context(self, tmp_path: Path):
        """Skips session when cursorRules is missing from context."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:no-rules": json.dumps({"createdAt": 1708300000000, "context": {}}),
                "composerData:with-rules": _composer_entry([_rule_ref("present-rule.mdc")]),
            },
        )

        results = parse_cursor_db(db_path)
        assert len(results) == 1
        assert results[0]["session_key"] == "composerData:with-rules"

    def test_parse_returns_required_fields(self, tmp_path: Path):
        """Verifies required fields in returned stats."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:abc": _composer_entry([_rule_ref("test-rule.mdc")]),
            },
        )

        results = parse_cursor_db(db_path)
        assert len(results) == 1
        stat = results[0]["stats"][0]
        assert "component_name" in stat
        assert "component_type" in stat
        assert "use_count" in stat
        assert "used_at" in stat
        assert "has_timestamp" in stat

    def test_parse_ignores_non_composer_keys(self, tmp_path: Path):
        """Ignores keys without composerData: prefix."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "someOtherKey:abc": json.dumps({"data": "irrelevant"}),
                "bubbleId:abc:123": json.dumps({"text": "hello"}),
                "composerData:real": _composer_entry([_rule_ref("my-rule.mdc")]),
            },
        )

        results = parse_cursor_db(db_path)
        assert len(results) == 1
        assert results[0]["session_key"] == "composerData:real"

    def test_parse_used_at_is_iso_format(self, tmp_path: Path):
        """used_at must be in ISO 8601 format."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:abc": _composer_entry(
                    [_rule_ref("rule.mdc")],
                    created_at=1708300000000,
                ),
            },
        )

        results = parse_cursor_db(db_path)
        used_at = results[0]["stats"][0]["used_at"]
        # Must be parseable as ISO 8601 format
        datetime.fromisoformat(used_at)

    def test_parse_marks_missing_created_at_as_no_timestamp(self, tmp_path: Path):
        """Marks has_timestamp=False when composerData createdAt is missing."""
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "composerData:abc": _composer_entry(
                    [_rule_ref("rule.mdc")],
                    created_at=0,
                ),
            },
        )

        results = parse_cursor_db(db_path)
        assert len(results) == 1
        assert results[0]["stats"][0]["has_timestamp"] is False

    def test_parse_corrupt_db_returns_empty(self, tmp_path: Path):
        """Corrupted DB file returns empty list."""
        db_path = str(tmp_path / "state.vscdb")
        Path(db_path).write_bytes(b"not a sqlite database")

        results = parse_cursor_db(db_path)
        assert results == []


class TestParseCursorAgentKv:
    """Tests for Cursor agentKv:blob parsing."""

    def test_parse_agentkv_extracts_command_from_read_tool_call(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": _agentkv_blob_entry(
                    {
                        "id": "1",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolCallId": "tc1",
                                "toolName": "Read",
                                "args": {
                                    "path": "/repo/.cursor/commands/work-session.md",
                                },
                            }
                        ],
                    }
                ),
            },
        )

        results, max_rowid = parse_cursor_agentkv_db(db_path, min_rowid=0)

        assert max_rowid >= 1
        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("work-session", "command") in stats
        assert all(s["signal_quality"] == "strict" for s in results[0]["stats"])
        assert all(s["has_timestamp"] is False for s in results[0]["stats"])

    def test_parse_agentkv_extracts_rule_from_shell_command(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": _agentkv_blob_entry(
                    {
                        "id": "1",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolCallId": "tc1",
                                "toolName": "Shell",
                                "args": {
                                    "command": ("cat > /repo/.cursor/rules/spec-driven.mdc << 'EOF'\n...\nEOF\n"),
                                },
                            }
                        ],
                    }
                ),
            },
        )

        results, _ = parse_cursor_agentkv_db(db_path, min_rowid=0)

        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("spec-driven", "rule") in stats
        assert all(s["signal_quality"] == "strict" for s in results[0]["stats"])
        assert all(s["has_timestamp"] is False for s in results[0]["stats"])

    def test_parse_agentkv_respects_min_rowid(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": _agentkv_blob_entry(
                    {
                        "id": "1",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolName": "Read",
                                "args": {"path": "/repo/.cursor/commands/spec-create.md"},
                            }
                        ],
                    }
                ),
                "agentKv:blob:b": _agentkv_blob_entry(
                    {
                        "id": "2",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolName": "Read",
                                "args": {"path": "/repo/.cursor/commands/spec-review.md"},
                            }
                        ],
                    }
                ),
            },
        )

        conn = sqlite3.connect(db_path)
        first_rowid = conn.execute("SELECT rowid FROM cursorDiskKV WHERE key = 'agentKv:blob:a'").fetchone()[0]
        conn.close()

        results, _ = parse_cursor_agentkv_db(db_path, min_rowid=first_rowid)

        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("spec-review", "command") in stats
        assert all(s["signal_quality"] == "strict" for s in results[0]["stats"])
        assert all(s["has_timestamp"] is False for s in results[0]["stats"])

    def test_parse_agentkv_extracts_usage_from_utf8_blob_payload(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": _agentkv_blob_json_entry(
                    {
                        "id": "1",
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolName": "Read",
                                "args": {"path": "/repo/.cursor/commands/work-session.md"},
                            }
                        ],
                    }
                ),
            },
        )

        results, max_rowid = parse_cursor_agentkv_db(db_path, min_rowid=0)

        assert max_rowid >= 1
        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("work-session", "command") in stats
        assert all(s["signal_quality"] == "strict" for s in results[0]["stats"])
        assert all(s["has_timestamp"] is False for s in results[0]["stats"])

    def test_parse_agentkv_uses_message_timestamp_when_present(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": _agentkv_blob_json_entry(
                    {
                        "id": "1",
                        "createdAt": 1708300000000,
                        "role": "assistant",
                        "content": [
                            {
                                "type": "tool-call",
                                "toolName": "Read",
                                "args": {"path": "/repo/.cursor/commands/work-session.md"},
                            }
                        ],
                    }
                ),
            },
        )

        results, _ = parse_cursor_agentkv_db(db_path, min_rowid=0)

        assert len(results) == 1
        used_at = results[0]["stats"][0]["used_at"]
        parsed = datetime.fromisoformat(used_at.replace("Z", "+00:00")).astimezone(UTC)
        expected = datetime.fromtimestamp(1708300000, tz=UTC)
        assert parsed == expected
        assert results[0]["stats"][0]["has_timestamp"] is True

    def test_parse_agentkv_does_not_advance_checkpoint_for_unreadable_blob(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": b"\x00\x81\x82\xff",
            },
        )

        results, max_rowid = parse_cursor_agentkv_db(db_path, min_rowid=0)

        assert results == []
        assert max_rowid == 0

    def test_parse_agentkv_extracts_reference_from_non_json_hex_payload(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        non_json_text = "read /repo/.cursor/commands/task-start.md"
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": non_json_text.encode("utf-8").hex(),
            },
        )

        results, max_rowid = parse_cursor_agentkv_db(db_path, min_rowid=0)

        assert max_rowid >= 1
        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("task-start", "command") in stats
        assert all(s["signal_quality"] == "fallback" for s in results[0]["stats"])
        assert all(s["has_timestamp"] is False for s in results[0]["stats"])

    def test_parse_agentkv_extracts_reference_from_unreadable_blob_payload(self, tmp_path: Path):
        db_path = str(tmp_path / "state.vscdb")
        # Induce UTF-8 strict decode failure + include ASCII path
        payload = b"\xff\xfe\xfd /repo/.cursor/commands/work-session.md \x80"
        _create_mock_cursor_db(
            db_path,
            {
                "agentKv:blob:a": payload,
            },
        )

        results, max_rowid = parse_cursor_agentkv_db(db_path, min_rowid=0)

        assert max_rowid >= 1
        assert len(results) == 1
        stats = {(s["component_name"], s["component_type"]) for s in results[0]["stats"]}
        assert ("work-session", "command") in stats
        assert all(s["signal_quality"] == "fallback" for s in results[0]["stats"])
        assert all(s["has_timestamp"] is False for s in results[0]["stats"])
