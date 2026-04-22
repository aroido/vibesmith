"""usage.py 테스트 — JSONL 세션 로그 파싱.

실제 Claude Code JSONL 형식:
- Skill: type="assistant" → message.content[].type="tool_use" + name="Skill"
- Hook: type="progress" → data.type="hook_progress" + data.hookName
- Subagent: type="assistant" → message.content[].type="tool_use" + name="Task"
"""

import json
from datetime import UTC, datetime
from pathlib import Path

from vibesmith_core.usage import parse_session_file, scan_project_sessions


def _assistant_event(tool_uses: list[dict], *, timestamp: str | None = None) -> dict:
    """실제 Claude Code 형식의 assistant 이벤트를 생성한다."""
    event = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "content": tool_uses,
        },
    }
    if timestamp is not None:
        event["timestamp"] = timestamp
    return event


def _skill_tool_use(skill_name: str) -> dict:
    """Skill tool_use 블록."""
    return {"type": "tool_use", "name": "Skill", "input": {"skill": skill_name}}


def _task_tool_use(description: str, subagent_type: str) -> dict:
    """Task (subagent) tool_use 블록."""
    return {
        "type": "tool_use",
        "name": "Task",
        "input": {"description": description, "subagent_type": subagent_type},
    }


def _hook_progress_event(
    hook_name: str,
    hook_event: str = "PostToolUse",
    *,
    timestamp: str | None = None,
) -> dict:
    """실제 Claude Code 형식의 hook progress 이벤트."""
    event = {
        "type": "progress",
        "data": {
            "type": "hook_progress",
            "hookEvent": hook_event,
            "hookName": hook_name,
        },
    }
    if timestamp is not None:
        event["timestamp"] = timestamp
    return event


def _command_user_event(command_name: str, *, timestamp: str | None = None) -> dict:
    """사용자가 /command-name을 직접 입력한 이벤트 (Claude Code JSONL 형식)."""
    event = {
        "type": "user",
        "message": {
            "role": "user",
            "content": (
                f"<command-message>{command_name}</command-message>\n<command-name>/{command_name}</command-name>"
            ),
        },
    }
    if timestamp is not None:
        event["timestamp"] = timestamp
    return event


def _write_jsonl(path: Path, events: list[dict]) -> None:
    """JSONL 파일에 이벤트 목록을 기록한다."""
    with open(path, "w") as f:
        for event in events:
            f.write(json.dumps(event) + "\n")


class TestParseSessionFile:
    """단일 JSONL 세션 파일 파싱 테스트."""

    def test_parse_skill_usage(self, tmp_path: Path):
        """Skill 사용 이벤트 추출 — assistant → tool_use + name == 'Skill'."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _assistant_event([_skill_tool_use("commit-helper")]),
                _assistant_event([_skill_tool_use("commit-helper")]),
                _assistant_event([_skill_tool_use("test-runner")]),
                _assistant_event([{"type": "tool_use", "name": "Read", "input": {"path": "/foo"}}]),
            ],
        )

        stats = parse_session_file(str(session_file))

        assert len(stats) == 2
        by_name = {s["component_name"]: s for s in stats}
        assert by_name["commit-helper"]["use_count"] == 2
        assert by_name["commit-helper"]["component_type"] == "skill"
        assert by_name["test-runner"]["use_count"] == 1

    def test_parse_skill_multiple_in_one_message(self, tmp_path: Path):
        """한 assistant 메시지에 여러 tool_use가 있을 때."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _assistant_event(
                    [
                        _skill_tool_use("a"),
                        _skill_tool_use("b"),
                        {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}},
                    ]
                ),
            ],
        )

        stats = parse_session_file(str(session_file))
        names = {s["component_name"] for s in stats}
        assert names == {"a", "b"}

    def test_parse_hook_usage(self, tmp_path: Path):
        """Hook 사용 이벤트 추출 — hookName의 ':' 앞 부분이 실제 훅 이름."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _hook_progress_event("PostToolUse:Read"),
                _hook_progress_event("PostToolUse:Write"),
                _hook_progress_event("SessionStart:clear", "SessionStart"),
            ],
        )

        stats = parse_session_file(str(session_file))

        by_name = {s["component_name"]: s for s in stats}
        # "PostToolUse:Read" + "PostToolUse:Write" → 둘 다 "PostToolUse"로 합산
        assert by_name["PostToolUse"]["use_count"] == 2
        assert by_name["PostToolUse"]["component_type"] == "hook"
        assert by_name["SessionStart"]["use_count"] == 1

    def test_parse_subagent_usage(self, tmp_path: Path):
        """Subagent 사용 이벤트 추출 — assistant → tool_use + name == 'Task'."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _assistant_event([_task_tool_use("코드 탐색", "Explore")]),
                _assistant_event([_task_tool_use("계획 수립", "planner")]),
                _assistant_event([_task_tool_use("계획 검증", "architect")]),
            ],
        )

        stats = parse_session_file(str(session_file))

        by_type = {s["component_name"]: s for s in stats}
        assert by_type["Explore"]["component_type"] == "agent"
        assert by_type["Explore"]["use_count"] == 1
        assert by_type["planner"]["use_count"] == 1
        assert by_type["architect"]["use_count"] == 1

    def test_parse_command_invocation(self, tmp_path: Path):
        """사용자가 /command-name 을 직접 타이핑한 커맨드 호출을 감지한다."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _command_user_event("morning-marketing"),
                _command_user_event("morning-marketing"),
                _command_user_event("daily-log"),
            ],
        )

        stats = parse_session_file(str(session_file))

        by_name = {s["component_name"]: s for s in stats}
        assert by_name["morning-marketing"]["use_count"] == 2
        assert by_name["morning-marketing"]["component_type"] == "command"
        assert by_name["daily-log"]["use_count"] == 1
        assert by_name["daily-log"]["component_type"] == "command"

    def test_parse_command_not_double_counted_with_meta(self, tmp_path: Path):
        """isMeta=true 확장 메시지는 커맨드 호출로 중복 카운트하지 않는다."""
        session_file = tmp_path / "session.jsonl"
        events = [
            _command_user_event("morning-marketing", timestamp="2026-03-15T06:43:50Z"),
            # isMeta=true: 커맨드 확장 프롬프트 (이건 카운트하면 안 됨)
            {
                "type": "user",
                "isMeta": True,
                "message": {
                    "role": "user",
                    "content": [{"type": "text", "text": "커맨드 확장 내용..."}],
                },
                "timestamp": "2026-03-15T06:43:50Z",
            },
        ]
        _write_jsonl(session_file, events)

        stats = parse_session_file(str(session_file))
        by_name = {s["component_name"]: s for s in stats}
        assert by_name["morning-marketing"]["use_count"] == 1

    def test_parse_command_and_skill_separate(self, tmp_path: Path):
        """커맨드 직접 호출과 Skill 도구 호출은 별도로 집계된다."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                # 사용자가 직접 /morning-marketing 타이핑
                _command_user_event("morning-marketing"),
                # assistant가 Skill 도구로 morning-marketing 호출
                _assistant_event([_skill_tool_use("morning-marketing")]),
            ],
        )

        stats = parse_session_file(str(session_file))
        # command와 skill 타입이 별도로 집계됨
        by_type = {s["component_type"]: s for s in stats}
        assert "command" in by_type
        assert "skill" in by_type
        assert by_type["command"]["use_count"] == 1
        assert by_type["skill"]["use_count"] == 1

    def test_parse_mixed_events(self, tmp_path: Path):
        """Skill, Hook, Subagent 혼합 이벤트."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _assistant_event([_skill_tool_use("commit-helper")]),
                _hook_progress_event("PostToolUse:Write"),
                _assistant_event([_task_tool_use("코드 리뷰", "code-reviewer")]),
                _assistant_event([{"type": "tool_use", "name": "Read", "input": {"path": "/foo"}}]),
            ],
        )

        stats = parse_session_file(str(session_file))

        assert len(stats) == 3
        names = {s["component_name"] for s in stats}
        assert names == {"commit-helper", "PostToolUse", "code-reviewer"}

    def test_parse_empty_file(self, tmp_path: Path):
        """빈 파일은 빈 리스트 반환."""
        session_file = tmp_path / "session.jsonl"
        session_file.write_text("")

        stats = parse_session_file(str(session_file))
        assert stats == []

    def test_parse_invalid_json_lines_skipped(self, tmp_path: Path):
        """잘못된 JSON 라인은 건너뛰기."""
        session_file = tmp_path / "session.jsonl"
        lines = [
            json.dumps(_assistant_event([_skill_tool_use("ok")])),
            "this is not json",
            json.dumps(_assistant_event([_skill_tool_use("ok2")])),
        ]
        session_file.write_text("\n".join(lines) + "\n")

        stats = parse_session_file(str(session_file))
        assert len(stats) == 2

    def test_parse_with_byte_offset(self, tmp_path: Path):
        """byte_offset부터 파싱 (증분 파싱)."""
        session_file = tmp_path / "session.jsonl"
        line1 = json.dumps(_assistant_event([_skill_tool_use("old")])) + "\n"
        line2 = json.dumps(_assistant_event([_skill_tool_use("new")])) + "\n"
        session_file.write_text(line1 + line2)

        # 첫 번째 라인 바이트 수를 offset으로 전달
        offset = len(line1.encode("utf-8"))
        stats = parse_session_file(str(session_file), byte_offset=offset)

        assert len(stats) == 1
        assert stats[0]["component_name"] == "new"

    def test_parse_nonexistent_file(self, tmp_path: Path):
        """존재하지 않는 파일은 빈 리스트."""
        stats = parse_session_file(str(tmp_path / "no-such-file.jsonl"))
        assert stats == []

    def test_parse_stats_have_required_fields(self, tmp_path: Path):
        """반환 통계에 필수 필드가 있는지 확인."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(session_file, [_assistant_event([_skill_tool_use("my-skill")])])

        stats = parse_session_file(str(session_file))
        assert len(stats) == 1
        stat = stats[0]
        assert "component_name" in stat
        assert "component_type" in stat
        assert "use_count" in stat
        assert "used_at" in stat
        assert "has_timestamp" in stat

    def test_parse_prefers_event_timestamp_when_present(self, tmp_path: Path):
        """이벤트 timestamp가 있으면 used_at으로 반영한다."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _assistant_event(
                    [_skill_tool_use("my-skill")],
                    timestamp="2026-02-01T12:34:56Z",
                )
            ],
        )

        stats = parse_session_file(str(session_file))
        assert len(stats) == 1

        parsed_used_at = datetime.fromisoformat(stats[0]["used_at"].replace("Z", "+00:00"))
        expected = datetime.fromisoformat("2026-02-01T12:34:56+00:00").astimezone(UTC)
        assert parsed_used_at.astimezone(UTC) == expected
        assert stats[0]["has_timestamp"] is True

    def test_parse_marks_missing_timestamp(self, tmp_path: Path):
        """timestamp가 없으면 카운트는 집계하되 has_timestamp=False로 저장한다."""
        session_file = tmp_path / "session.jsonl"
        _write_jsonl(
            session_file,
            [
                _assistant_event([_skill_tool_use("my-skill")]),
            ],
        )

        stats = parse_session_file(str(session_file))

        assert len(stats) == 1
        assert stats[0]["component_name"] == "my-skill"
        assert stats[0]["use_count"] == 1
        assert stats[0]["has_timestamp"] is False


class TestScanProjectSessions:
    """프로젝트 세션 디렉토리 스캔 테스트."""

    def test_scan_finds_jsonl_files(self, tmp_path: Path):
        """JSONL 파일을 찾아서 파싱."""
        session_dir = tmp_path / "sessions"
        session_dir.mkdir()

        _write_jsonl(
            session_dir / "abc123.jsonl",
            [_assistant_event([_skill_tool_use("test-skill")])],
        )
        _write_jsonl(
            session_dir / "def456.jsonl",
            [_assistant_event([_skill_tool_use("other-skill")])],
        )

        results = scan_project_sessions(str(session_dir))

        assert len(results) == 2
        all_names = set()
        for file_result in results:
            for stat in file_result["stats"]:
                all_names.add(stat["component_name"])
        assert all_names == {"test-skill", "other-skill"}

    def test_scan_empty_directory(self, tmp_path: Path):
        """빈 디렉토리는 빈 리스트 반환."""
        session_dir = tmp_path / "sessions"
        session_dir.mkdir()

        results = scan_project_sessions(str(session_dir))
        assert results == []

    def test_scan_nonexistent_directory(self, tmp_path: Path):
        """존재하지 않는 디렉토리는 빈 리스트 반환."""
        results = scan_project_sessions(str(tmp_path / "nonexistent"))
        assert results == []

    def test_scan_respects_parse_state(self, tmp_path: Path):
        """parse_state에 기록된 파일은 offset부터 파싱."""
        session_dir = tmp_path / "sessions"
        session_dir.mkdir()

        line1 = json.dumps(_assistant_event([_skill_tool_use("old")])) + "\n"
        line2 = json.dumps(_assistant_event([_skill_tool_use("new")])) + "\n"
        (session_dir / "session1.jsonl").write_text(line1 + line2)

        # parse_state: 첫 번째 라인 이미 처리됨
        offset = len(line1.encode("utf-8"))
        parse_states = {"session1.jsonl": offset}

        results = scan_project_sessions(str(session_dir), parse_states=parse_states)

        assert len(results) == 1
        assert results[0]["stats"][0]["component_name"] == "new"
