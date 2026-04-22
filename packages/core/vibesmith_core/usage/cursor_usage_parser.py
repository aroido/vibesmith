"""Cursor state.vscdb parser — extracts Rule/Skill/Command/Agent references from Cursor sessions."""

import json
import logging
import os
import re
import sqlite3
from collections import Counter
from datetime import UTC, datetime

logger = logging.getLogger(__name__)
_SUPPORTED_CONFIG_ROOTS = ("/.cursor/", "/.codex/", "/.claude/")
_HEX_PAYLOAD_RE = re.compile(r"^[0-9a-fA-F]+$")
_FALLBACK_MAX_ROOT_OCCURRENCES = 200
_FALLBACK_SEGMENT_PREFIX = 160
_FALLBACK_SEGMENT_SUFFIX = 320
_COMPONENT_PATH_IN_TEXT = re.compile(
    r"""((?:[A-Za-z]:)?[^\s'"]+/
    (?:\.cursor|\.codex|\.claude)/
    (?:skills/[^/\s'"]+/SKILL\.md(?:\.disabled)?
    |commands/[^/\s'"]+\.md(?:\.disabled)?
    |agents/[^/\s'"]+\.md(?:\.disabled)?
    |subagents/[^/\s'"]+(?:/(?:agent|subagent)\.md|\.md)(?:\.disabled)?
    |rules/[^/\s'"]+\.(?:mdc|md)(?:\.disabled)?))""",
    re.IGNORECASE | re.VERBOSE,
)
_PATH_ARG_KEYS = {
    "path",
    "paths",
    "file",
    "files",
    "file_path",
    "filepath",
    "target_path",
    "source_path",
    "src",
    "dst",
    "directory",
    "directories",
    "target_directories",
    "cwd",
    "root",
}
_SKIP_ARG_KEYS = {
    "content",
    "new_content",
    "old_content",
    "old_str",
    "new_str",
    "query",
    "pattern",
    "prompt",
    "instruction",
    "message",
    "text",
    "result",
    "output",
    "stderr",
    "stdout",
}
_TIMESTAMP_KEYS = (
    "createdAt",
    "created_at",
    "createdAtMs",
    "created_at_ms",
    "timestamp",
    "timestampMs",
    "time",
    "ts",
)


def _coerce_timestamp(value: object) -> datetime | None:
    """Normalize numeric/string timestamp to UTC datetime."""
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric <= 0:
            return None
        seconds = numeric / 1000 if numeric >= 1_000_000_000_000 else numeric
        try:
            return datetime.fromtimestamp(seconds, tz=UTC)
        except (OverflowError, OSError, ValueError):
            return None

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.isdigit():
            return _coerce_timestamp(int(text))

        normalized = text.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return None

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        else:
            parsed = parsed.astimezone(UTC)
        return parsed

    return None


def _extract_message_used_at(
    message: dict | None,
    fallback: datetime | None = None,
) -> tuple[str, bool]:
    """Extract event timestamp from agentKv message."""
    fallback_dt = fallback or datetime.now(UTC)
    if not isinstance(message, dict):
        return fallback_dt.isoformat(), False

    candidates: list[object] = [
        message,
        message.get("metadata"),
        message.get("meta"),
        message.get("event"),
        message.get("message"),
        message.get("header"),
    ]

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        for key in _TIMESTAMP_KEYS:
            parsed = _coerce_timestamp(candidate.get(key))
            if parsed is not None:
                return parsed.isoformat(), True

    return fallback_dt.isoformat(), False


def _normalize_separators(path: str) -> str:
    """Normalize Windows/Unix path separators to '/'."""
    return re.sub(r"[\\/]+", "/", path.strip())


def _strip_disabled_suffix(name: str) -> str:
    """Strip `.disabled` suffix (e.g., foo.md.disabled -> foo.md)."""
    lower = name.lower()
    if lower.endswith(".disabled"):
        return name[: -len(".disabled")]
    return name


def _strip_known_extensions(name: str) -> str:
    """Strip component file extensions (.md/.mdc)."""
    lower = name.lower()
    if lower.endswith(".mdc"):
        return name[: -len(".mdc")]
    if lower.endswith(".md"):
        return name[: -len(".md")]
    return name


def _default_path_hint(raw_name: str, default_type: str | None) -> str | None:
    """Generate a path hint when a component type hint is available."""
    if not default_type:
        return None
    normalized = _normalize_separators(raw_name)
    basename = normalized.rsplit("/", 1)[-1]
    if not basename:
        return None
    if default_type == "command":
        if basename.lower().endswith((".md", ".md.disabled")):
            return f"commands/{basename}"
        return f"commands/{basename}.md"
    if default_type == "agent":
        if basename.lower().endswith((".md", ".md.disabled")):
            return f"agents/{basename}"
        return f"agents/{basename}.md"
    return None


def canonicalize_cursor_component(
    raw_name: str,
    raw_path: str | None = None,
    *,
    default_type: str | None = None,
) -> tuple[str, str]:
    """Normalize a Cursor reference string to a canonical component name.

    Priority:
    1) .../skills/<slug>/SKILL.md or <slug>/SKILL.md -> <slug> (type=skill)
    2) .../commands/<slug>.md -> <slug> (type=command)
    3) .../agents/<slug>.md, .../subagents/<slug>.md -> <slug> (type=agent)
    4) .../rules/<slug>.mdc or <slug>.mdc -> <slug> (type=rule)
    5) .../<name>.md -> <name> (type=rule, confirmed if under rules/ path)
    6) fallback: basename (uses default_type if provided)
    """
    candidate = raw_path or _default_path_hint(raw_name, default_type) or raw_name
    normalized = _normalize_separators(candidate)
    lower_norm = normalized.lower()

    # 1) skills/<slug>/SKILL.md(.disabled)
    m = re.search(r"(?:^|/)skills/([^/]+)/skill\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "skill"
    m = re.search(r"(?:^|/)([^/]+)/skill\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "skill"

    # 2) commands/<slug>.md(.disabled)
    m = re.search(r"(?:^|/)commands/([^/]+)\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "command"

    # 3) agents/subagents
    m = re.search(r"(?:^|/)agents/([^/]+)\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "agent"
    m = re.search(r"(?:^|/)subagents/([^/]+)\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "agent"
    m = re.search(r"(?:^|/)subagents/([^/]+)/(?:agent|subagent)\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "agent"

    # 4) rules/<slug>.mdc(.disabled) or <slug>.mdc(.disabled)
    m = re.search(r"(?:^|/)rules/([^/]+)\.mdc(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "rule"
    m = re.search(r"(?:^|/)([^/]+)\.mdc(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "rule"

    # rules/<slug>.md is also treated as rule.
    m = re.search(r"(?:^|/)rules/([^/]+)\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "rule"

    # default_type hint (corrects filename-only input for commands/subagents etc.)
    if default_type == "command":
        m = re.search(r"(?:^|/)([^/]+)\.md(?:\.disabled)?$", lower_norm)
        if m:
            return m.group(1), "command"
    if default_type == "agent":
        m = re.search(r"(?:^|/)([^/]+)\.md(?:\.disabled)?$", lower_norm)
        if m:
            return m.group(1), "agent"

    # 5) .../<name>.md(.disabled)
    m = re.search(r"(?:^|/)([^/]+)\.md(?:\.disabled)?$", lower_norm)
    if m:
        return m.group(1), "rule"

    # 6) fallback: basename
    basename = _strip_known_extensions(_strip_disabled_suffix(normalized.rsplit("/", 1)[-1]))
    if default_type in {"skill", "command", "agent", "rule"} and basename:
        return basename, default_type
    return basename, "rule"


def _build_stats_from_references(
    references: list[tuple[str, str | None, str | None]],
    used_at: str,
    *,
    signal_quality: str = "strict",
    has_timestamp: bool = True,
) -> list[dict]:
    """Aggregate reference list and convert to usage stats format."""
    aggregated: Counter[tuple[str, str]] = Counter()
    for raw_name, path_hint, default_type in references:
        name, inferred_type = canonicalize_cursor_component(
            raw_name,
            path_hint,
            default_type=default_type,
        )
        if not name:
            continue
        aggregated[(name, inferred_type)] += 1

    return [
        {
            "component_name": name,
            "component_type": component_type,
            "use_count": count,
            "used_at": used_at,
            "signal_quality": signal_quality,
            "has_timestamp": has_timestamp,
        }
        for (name, component_type), count in sorted(aggregated.items())
    ]


def _collect_strings(value: object, out: list[str]) -> None:
    """Collect only strings from nested dict/list structures."""
    if isinstance(value, str):
        out.append(value)
        return
    if isinstance(value, dict):
        for nested in value.values():
            _collect_strings(nested, out)
        return
    if isinstance(value, list):
        for nested in value:
            _collect_strings(nested, out)


def _extract_component_references_from_tool_call(
    tool_name: str,
    args: dict | None,
) -> list[tuple[str, str | None, str | None]]:
    """Extract component file paths from tool-call args.

    Cursor agentKv tool-calls are routed through Read/Write/StrReplace/Shell etc.,
    so mapping is based on .cursor/.codex/.claude component paths within args strings.
    """
    if not isinstance(args, dict):
        return []

    tool = tool_name.lower().strip()
    strings: list[str] = []

    if tool == "shell":
        command = args.get("command")
        if isinstance(command, str) and command.strip():
            # Heredoc/multiline body has high noise, so limit to header lines.
            head_lines = []
            for line in command.splitlines():
                head_lines.append(line)
                if "<<" in line:
                    break
                if len(head_lines) >= 2:
                    break
            strings.append("\n".join(head_lines) if head_lines else command)
    else:
        for key, value in args.items():
            normalized_key = str(key).lower().strip()
            if normalized_key in _SKIP_ARG_KEYS:
                continue
            if normalized_key in _PATH_ARG_KEYS:
                _collect_strings(value, strings)
                continue

            # Allow obvious file path strings even for non-path keys.
            if isinstance(value, str):
                value_norm = _normalize_separators(value)
                if any(root in value_norm.lower() for root in _SUPPORTED_CONFIG_ROOTS):
                    strings.append(value)

    references: list[tuple[str, str | None, str | None]] = []
    for raw in strings:
        normalized = _normalize_separators(raw)
        lower_norm = normalized.lower()
        if not any(root in lower_norm for root in _SUPPORTED_CONFIG_ROOTS):
            continue

        for match in _COMPONENT_PATH_IN_TEXT.finditer(normalized):
            path = match.group(1)
            references.append((path, path, None))

        # For simple path args (e.g., Read.path), try directly even if regex fails.
        if normalized.endswith(("SKILL.md", ".md", ".mdc", ".md.disabled", ".mdc.disabled")):
            references.append((normalized, normalized, None))

    # Prevent duplicate path insertion within the same tool-call
    deduped: dict[tuple[str, str | None, str | None], None] = {}
    for ref in references:
        deduped[ref] = None
    return list(deduped.keys())


def _extract_component_references_from_raw_payload(payload: str | None) -> list[tuple[str, str | None, str | None]]:
    """Directly extract component paths from agentKv raw payload text."""
    if not isinstance(payload, str):
        return []

    if not payload.strip():
        return []

    # Fix escaped slashes (inside JSON strings)
    normalized_payload = payload.replace("\\/", "/")
    lower_payload = normalized_payload.lower()

    if not any(root in lower_payload for root in _SUPPORTED_CONFIG_ROOTS):
        return []

    root_positions: list[int] = []
    for root in _SUPPORTED_CONFIG_ROOTS:
        start = 0
        while len(root_positions) < _FALLBACK_MAX_ROOT_OCCURRENCES:
            idx = lower_payload.find(root, start)
            if idx < 0:
                break
            root_positions.append(idx)
            start = idx + len(root)
        if len(root_positions) >= _FALLBACK_MAX_ROOT_OCCURRENCES:
            break

    if not root_positions:
        return []

    # Only scan segments around roots to limit regex cost on large payloads.
    root_positions.sort()
    segments: list[tuple[int, int]] = []
    for pos in root_positions:
        start = max(0, pos - _FALLBACK_SEGMENT_PREFIX)
        end = min(len(normalized_payload), pos + _FALLBACK_SEGMENT_SUFFIX)
        if not segments:
            segments.append((start, end))
            continue
        prev_start, prev_end = segments[-1]
        if start <= prev_end:
            segments[-1] = (prev_start, max(prev_end, end))
        else:
            segments.append((start, end))

    references: list[tuple[str, str | None, str | None]] = []
    for start, end in segments:
        segment = normalized_payload[start:end]
        for match in _COMPONENT_PATH_IN_TEXT.finditer(segment):
            path = _normalize_separators(match.group(1))
            references.append((path, path, None))

    deduped: dict[tuple[str, str | None, str | None], None] = {}
    for ref in references:
        deduped[ref] = None
    return list(deduped.keys())


def parse_cursor_db(db_path: str) -> list[dict]:
    """Parse Cursor state.vscdb and return per-session usage statistics.

    Args:
        db_path: state.vscdb file path

    Returns:
        [{"session_key": str, "stats": list[dict]}, ...]
        Each stats item: {"component_name": str, "component_type": str, "use_count": int, "used_at": str}
    """
    if not os.path.isfile(db_path):
        return []

    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except sqlite3.OperationalError:
        logger.warning("Failed to open Cursor DB: %s", db_path)
        return []

    try:
        # Check if cursorDiskKV table exists
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='cursorDiskKV'").fetchone()
        if not tables:
            return []

        # Query only composerData:* keys
        rows = conn.execute("SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%'").fetchall()
    except sqlite3.DatabaseError:
        logger.warning("Failed to read Cursor DB: %s", db_path)
        return []
    finally:
        conn.close()

    results: list[dict] = []
    skipped_invalid_json = 0
    skipped_no_context = 0
    skipped_no_references = 0
    skipped_invalid_reference = 0
    skipped_no_name = 0

    for key, value in rows:
        try:
            data = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            skipped_invalid_json += 1
            continue

        if not isinstance(data, dict):
            skipped_invalid_json += 1
            continue

        context = data.get("context")
        if not isinstance(context, dict):
            skipped_no_context += 1
            continue

        # Reference sources:
        # - context.cursorRules (rules/skills references)
        # - context.cursorCommands (slash command references)
        # - context.subagentSelections (agent references)
        # - context.mentions.* (commands/rules/subagents mentioned in actual conversation)
        references: list[tuple[str, str | None, str | None]] = []

        rules = context.get("cursorRules")
        if isinstance(rules, list):
            for rule in rules:
                if not isinstance(rule, dict):
                    skipped_invalid_reference += 1
                    continue
                raw_name = rule.get("name") or rule.get("filename") or rule.get("path")
                if not isinstance(raw_name, str) or not raw_name.strip():
                    skipped_no_name += 1
                    continue
                raw_path = rule.get("filename") or rule.get("path")
                path_hint = raw_path if isinstance(raw_path, str) and raw_path.strip() else None
                references.append((raw_name.strip(), path_hint, None))

        commands = context.get("cursorCommands")
        if isinstance(commands, list):
            for command in commands:
                if not isinstance(command, dict):
                    skipped_invalid_reference += 1
                    continue
                raw_name = command.get("name") or command.get("filename") or command.get("path")
                if not isinstance(raw_name, str) or not raw_name.strip():
                    skipped_no_name += 1
                    continue
                raw_path = command.get("filename") or command.get("path")
                path_hint = raw_path if isinstance(raw_path, str) and raw_path.strip() else None
                references.append((raw_name.strip(), path_hint, "command"))

        subagents = context.get("subagentSelections")
        if isinstance(subagents, list):
            for subagent in subagents:
                if not isinstance(subagent, dict):
                    skipped_invalid_reference += 1
                    continue
                raw_name = subagent.get("name") or subagent.get("filename") or subagent.get("path")
                if not isinstance(raw_name, str) or not raw_name.strip():
                    skipped_no_name += 1
                    continue
                raw_path = subagent.get("filename") or subagent.get("path")
                path_hint = raw_path if isinstance(raw_path, str) and raw_path.strip() else None
                references.append((raw_name.strip(), path_hint, "agent"))

        mentions = context.get("mentions")
        if isinstance(mentions, dict):
            mention_specs = (
                ("cursorCommands", "command"),
                ("cursorRules", None),
                ("subagentSelections", "agent"),
            )
            for mention_key, default_type in mention_specs:
                mention_map = mentions.get(mention_key)
                if not isinstance(mention_map, dict):
                    continue
                for raw_name in mention_map.keys():
                    if not isinstance(raw_name, str) or not raw_name.strip():
                        skipped_no_name += 1
                        continue
                    references.append((raw_name.strip(), None, default_type))

        if not references:
            skipped_no_references += 1
            continue

        # createdAt (ms) → ISO 8601
        created_at_ms = data.get("createdAt")
        has_timestamp = isinstance(created_at_ms, (int, float)) and created_at_ms > 0
        if has_timestamp:
            used_at = datetime.fromtimestamp(created_at_ms / 1000, tz=UTC).isoformat()
        else:
            used_at = datetime.now(UTC).isoformat()

        stats = _build_stats_from_references(
            references,
            used_at,
            signal_quality="strict",
            has_timestamp=has_timestamp,
        )
        if not stats:
            skipped_no_name += 1

        if stats:
            results.append({"session_key": key, "stats": stats})

    logger.debug(
        (
            "Cursor DB parse summary: rows=%d, sessions=%d, "
            "skipped_invalid_json=%d, skipped_no_context=%d, skipped_no_references=%d, "
            "skipped_invalid_reference=%d, skipped_no_name=%d"
        ),
        len(rows),
        len(results),
        skipped_invalid_json,
        skipped_no_context,
        skipped_no_references,
        skipped_invalid_reference,
        skipped_no_name,
    )

    return results


def parse_cursor_agentkv_db(db_path: str, *, min_rowid: int = 0) -> tuple[list[dict], int]:
    """Parse Cursor agentKv:blob events to extract tool-call based usage statistics.

    Args:
        db_path: state.vscdb file path
        min_rowid: Only parse records after this rowid (for incremental processing)

    Returns:
        (results, checkpoint_rowid)
        - results: [{"session_key": str, "stats": list[dict]}, ...]
        - checkpoint_rowid: Maximum rowid "safely processed" in this query
          (min_rowid if none processed)
    """
    if not os.path.isfile(db_path):
        return [], min_rowid

    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except sqlite3.OperationalError:
        logger.warning("Failed to open Cursor DB (agentKv): %s", db_path)
        return [], min_rowid

    try:
        table_exists = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='cursorDiskKV'").fetchone()
        if not table_exists:
            conn.close()
            return [], min_rowid

        cursor = conn.execute(
            "SELECT rowid, key, value "
            "FROM cursorDiskKV "
            "WHERE key LIKE 'agentKv:blob:%' AND rowid > ? "
            "ORDER BY rowid ASC",
            (min_rowid,),
        )
    except sqlite3.DatabaseError:
        conn.close()
        logger.warning("Failed to read Cursor DB (agentKv): %s", db_path)
        return [], min_rowid

    results: list[dict] = []
    max_seen_rowid = min_rowid
    checkpoint_rowid = min_rowid
    skipped_decode_failure = 0
    skipped_invalid_json = 0
    skipped_no_tool_calls = 0
    fallback_reference_sessions = 0

    def _decode_agentkv_message(value: object) -> tuple[dict | None, str | None, bool]:
        """Decode agentKv value into a dict message.

        Returns:
            (message, payload_text, checkpointable)
            - message: Parsed dict message (None on failure)
            - payload_text: String for fallback analysis (None if unavailable)
            - checkpointable: Whether the record can be definitively processed in the current format
              (If False, rowid checkpoint is not advanced so it can be retried in the next run)
        """
        if isinstance(value, (bytes, bytearray)):
            raw = bytes(value)
            if not raw:
                return None, None, True
            try:
                decoded = raw.decode("utf-8")
            except UnicodeDecodeError:
                salvage = raw.decode("utf-8", errors="ignore")
                return None, salvage if salvage else None, False
            try:
                payload = json.loads(decoded)
            except (json.JSONDecodeError, TypeError):
                return None, decoded, True
            if not isinstance(payload, dict):
                return None, decoded, True
            return payload, decoded, True

        if isinstance(value, str):
            text = value.strip()
            if not text:
                return None, None, True

            # legacy: text(hex-encoded json)
            if len(text) % 2 == 0 and _HEX_PAYLOAD_RE.fullmatch(text):
                try:
                    decoded = bytes.fromhex(text).decode("utf-8", errors="replace")
                    payload = json.loads(decoded)
                except (ValueError, json.JSONDecodeError, TypeError):
                    payload = None
                if isinstance(payload, dict):
                    return payload, decoded, True
                if decoded:
                    return None, decoded, True

            # modern/edge: plain JSON text
            try:
                payload = json.loads(text)
            except (json.JSONDecodeError, TypeError):
                return None, text, True
            if not isinstance(payload, dict):
                return None, text, True
            return payload, text, True

        return None, None, False

    try:
        for rowid, key, value in cursor:
            if isinstance(rowid, int) and rowid > max_seen_rowid:
                max_seen_rowid = rowid

            message, payload_text, checkpointable = _decode_agentkv_message(value)
            references: list[tuple[str, str | None, str | None]] = []
            signal_quality = "strict"

            if message is None:
                references = _extract_component_references_from_raw_payload(payload_text)
                if references:
                    signal_quality = "fallback"
                    fallback_reference_sessions += 1
                    checkpointable = True
                else:
                    has_root_hint = isinstance(payload_text, str) and any(
                        root in payload_text.lower() for root in _SUPPORTED_CONFIG_ROOTS
                    )
                    if has_root_hint:
                        checkpointable = False
                    if not checkpointable:
                        skipped_decode_failure += 1
                    else:
                        skipped_invalid_json += 1
                    if checkpointable and isinstance(rowid, int) and rowid > checkpoint_rowid:
                        checkpoint_rowid = rowid
                    continue
            else:
                if message.get("role") != "assistant":
                    if checkpointable and isinstance(rowid, int) and rowid > checkpoint_rowid:
                        checkpoint_rowid = rowid
                    continue

                content = message.get("content")
                if not isinstance(content, list):
                    skipped_invalid_json += 1
                    if checkpointable and isinstance(rowid, int) and rowid > checkpoint_rowid:
                        checkpoint_rowid = rowid
                    continue

                for block in content:
                    if not isinstance(block, dict):
                        continue
                    if block.get("type") not in ("tool-call", "tool_call"):
                        continue
                    tool_name = block.get("toolName") or block.get("name")
                    if not isinstance(tool_name, str):
                        tool_name = ""
                    args = block.get("args")
                    references.extend(_extract_component_references_from_tool_call(tool_name, args))

            if not references:
                skipped_no_tool_calls += 1
                if checkpointable and isinstance(rowid, int) and rowid > checkpoint_rowid:
                    checkpoint_rowid = rowid
                continue

            used_at, has_timestamp = _extract_message_used_at(message)
            stats = _build_stats_from_references(
                references,
                used_at,
                signal_quality=signal_quality,
                has_timestamp=has_timestamp,
            )
            if stats:
                results.append({"session_key": key, "stats": stats})

            if checkpointable and isinstance(rowid, int) and rowid > checkpoint_rowid:
                checkpoint_rowid = rowid

    finally:
        conn.close()

    logger.debug(
        (
            "Cursor agentKv parse summary: sessions=%d, checkpoint_rowid=%d, max_seen_rowid=%d, "
            "fallback_reference_sessions=%d, skipped_decode_failure=%d, "
            "skipped_invalid_json=%d, skipped_no_tool_calls=%d"
        ),
        len(results),
        checkpoint_rowid,
        max_seen_rowid,
        fallback_reference_sessions,
        skipped_decode_failure,
        skipped_invalid_json,
        skipped_no_tool_calls,
    )

    return results, checkpoint_rowid
