"""JSONL session log parser — extracts Skill/Hook/Subagent/Command usage from Claude Code sessions (Issue #67).

Actual Claude Code JSONL event structure:
- Skill: type="assistant" -> message.content[].type="tool_use" + name="Skill"
- Hook: type="progress" -> data.type="hook_progress" + data.hookName
- Subagent: type="assistant" -> message.content[].type="tool_use" + name in ("Task", "Agent")
- Command: type="user" (not isMeta) -> message.content contains <command-name>/xxx</command-name> pattern
"""

import json
import os
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

_TIMESTAMP_KEYS = ("timestamp", "createdAt", "created_at", "time", "ts")
_COMMAND_NAME_RE = re.compile(r"<command-name>/([^<]+)</command-name>")

# 파서 로직의 버전. 파싱 규칙을 변경한 뒤 기존에 파싱된 세션을
# 자동 재파싱시키려면 이 값을 올린다. scanner가 usage_parse_state.parser_version
# 과 비교하여 값이 낮은 세션을 byte_offset=0부터 다시 파싱한다.
# - v2: Claude Code의 subagent tool name "Task" → "Agent" 지원
PARSER_VERSION = 2


def _coerce_timestamp(value: object) -> datetime | None:
    """Normalize various timestamp formats to UTC datetime."""
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


def _extract_event_used_at(event: dict) -> tuple[datetime | None, bool]:
    """Extract usage timestamp from event payload."""
    candidates = [
        event,
        event.get("message"),
        event.get("data"),
    ]
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        for key in _TIMESTAMP_KEYS:
            parsed = _coerce_timestamp(candidate.get(key))
            if parsed is not None:
                return parsed, True
    return None, False


def _update_latest_time(bucket: dict[str, datetime], name: str, used_at: datetime) -> None:
    existing = bucket.get(name)
    if existing is None or used_at > existing:
        bucket[name] = used_at


def parse_session_file(path: str, byte_offset: int = 0) -> list[dict]:
    """Parse a single JSONL session file and return component usage statistics.

    Args:
        path: JSONL file path
        byte_offset: Start reading from this position (incremental parsing)

    Returns:
        [{"component_name": str, "component_type": str, "use_count": int, "used_at": str}, ...]
    """
    if not os.path.isfile(path):
        return []

    skill_counts: Counter = Counter()
    hook_counts: Counter = Counter()
    agent_counts: Counter = Counter()
    command_counts: Counter = Counter()
    skill_last_used: dict[str, datetime] = {}
    hook_last_used: dict[str, datetime] = {}
    agent_last_used: dict[str, datetime] = {}
    command_last_used: dict[str, datetime] = {}
    skill_has_timestamp: dict[str, bool] = {}
    hook_has_timestamp: dict[str, bool] = {}
    agent_has_timestamp: dict[str, bool] = {}
    command_has_timestamp: dict[str, bool] = {}

    now_dt = datetime.now(UTC)

    with open(path, encoding="utf-8", errors="replace") as f:
        if byte_offset > 0:
            f.seek(byte_offset)

        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except (json.JSONDecodeError, ValueError):
                continue

            if not isinstance(event, dict):
                continue

            event_type = event.get("type")
            event_used_at, has_timestamp = _extract_event_used_at(event)

            # assistant event: check tool_use blocks inside message.content[]
            if event_type == "assistant":
                content = (event.get("message") or {}).get("content")
                if not isinstance(content, list):
                    continue
                for block in content:
                    if not isinstance(block, dict) or block.get("type") != "tool_use":
                        continue
                    tool_name = block.get("name")
                    tool_input = block.get("input") or {}

                    # Skill usage
                    if tool_name == "Skill":
                        skill = tool_input.get("skill")
                        if skill:
                            skill_counts[skill] += 1
                            if has_timestamp and event_used_at is not None:
                                _update_latest_time(skill_last_used, skill, event_used_at)
                            skill_has_timestamp[skill] = skill_has_timestamp.get(skill, False) or has_timestamp

                    # Subagent usage (Task/Agent tool — Claude Code uses both names)
                    elif tool_name in ("Task", "Agent"):
                        subagent_type = tool_input.get("subagent_type")
                        if subagent_type:
                            agent_counts[subagent_type] += 1
                            if has_timestamp and event_used_at is not None:
                                _update_latest_time(agent_last_used, subagent_type, event_used_at)
                            agent_has_timestamp[subagent_type] = (
                                agent_has_timestamp.get(subagent_type, False) or has_timestamp
                            )

            # Command usage: type="user" (not isMeta) + <command-name>/xxx</command-name>
            elif event_type == "user" and not event.get("isMeta"):
                content = (event.get("message") or {}).get("content")
                text = content if isinstance(content, str) else ""
                match = _COMMAND_NAME_RE.search(text)
                if match:
                    cmd_name = match.group(1).strip()
                    if cmd_name:
                        command_counts[cmd_name] += 1
                        if has_timestamp and event_used_at is not None:
                            _update_latest_time(command_last_used, cmd_name, event_used_at)
                        command_has_timestamp[cmd_name] = command_has_timestamp.get(cmd_name, False) or has_timestamp

            # Hook usage: progress -> data.type == "hook_progress"
            # hookName is "PretoolUse:Edit" format -> part before ":" is the actual hook name
            elif event_type == "progress":
                data = event.get("data")
                if isinstance(data, dict) and data.get("type") == "hook_progress":
                    hook_name = data.get("hookName")
                    if hook_name:
                        hook_name = hook_name.split(":")[0]
                        hook_counts[hook_name] += 1
                        if has_timestamp and event_used_at is not None:
                            _update_latest_time(hook_last_used, hook_name, event_used_at)
                        hook_has_timestamp[hook_name] = hook_has_timestamp.get(hook_name, False) or has_timestamp

    stats: list[dict] = []

    for name, count in skill_counts.items():
        stats.append(
            {
                "component_name": name,
                "component_type": "skill",
                "use_count": count,
                "used_at": skill_last_used.get(name, now_dt).isoformat(),
                "has_timestamp": skill_has_timestamp.get(name, False),
            }
        )

    for name, count in hook_counts.items():
        stats.append(
            {
                "component_name": name,
                "component_type": "hook",
                "use_count": count,
                "used_at": hook_last_used.get(name, now_dt).isoformat(),
                "has_timestamp": hook_has_timestamp.get(name, False),
            }
        )

    for name, count in agent_counts.items():
        stats.append(
            {
                "component_name": name,
                "component_type": "agent",
                "use_count": count,
                "used_at": agent_last_used.get(name, now_dt).isoformat(),
                "has_timestamp": agent_has_timestamp.get(name, False),
            }
        )

    for name, count in command_counts.items():
        stats.append(
            {
                "component_name": name,
                "component_type": "command",
                "use_count": count,
                "used_at": command_last_used.get(name, now_dt).isoformat(),
                "has_timestamp": command_has_timestamp.get(name, False),
            }
        )

    return stats


def scan_project_sessions(
    session_dir: str,
    parse_states: dict[str, int] | None = None,
) -> list[dict]:
    """Scan all JSONL files in a project session directory.

    Args:
        session_dir: Directory path containing session files
        parse_states: {session_file: byte_offset} — already parsed positions

    Returns:
        [{"session_file": str, "stats": list[dict], "new_offset": int}, ...]
    """
    if parse_states is None:
        parse_states = {}

    session_path = Path(session_dir)
    if not session_path.is_dir():
        return []

    results = []

    for jsonl_file in sorted(session_path.glob("*.jsonl")):
        filename = jsonl_file.name
        offset = parse_states.get(filename, 0)

        stats = parse_session_file(str(jsonl_file), byte_offset=offset)
        if not stats:
            continue

        new_offset = jsonl_file.stat().st_size
        results.append(
            {
                "session_file": filename,
                "stats": stats,
                "new_offset": new_offset,
            }
        )

    return results
