#!/usr/bin/env python3
"""Cursor usage 재매칭 스크립트.

목표:
- legacy Cursor usage(`component_id IS NULL`, 특히 `component_name='SKILL.md'`)를 복구
- dry-run으로 변경 전/후 통계를 안전하게 비교

전략:
1) Cursor usage 세션(cursor:global) 데이터를 제거
2) 최신 state.vscdb를 다시 파싱해 usage_stats 재적재
3) backfill_component_ids()로 component_id 후속 매칭
"""

# ruff: noqa: E402

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "core"))

from vibesmith_core.usage.adapters import CURSOR_GLOBAL_PROJECT_PATH
from vibesmith_core.usage.cursor_discovery import discover_cursor_db_path
from vibesmith_core.usage.cursor_usage_parser import parse_cursor_db
from vibesmith_core.usage.repo import backfill_component_ids, save_usage_stats


def _ratio(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return round((numerator / denominator) * 100, 2)


def _collect_stats(conn: sqlite3.Connection, target_name: str) -> dict[str, int | float]:
    total = conn.execute("SELECT COUNT(*) FROM usage_stats").fetchone()[0]
    null_count = conn.execute("SELECT COUNT(*) FROM usage_stats WHERE component_id IS NULL").fetchone()[0]
    target_total = conn.execute(
        "SELECT COUNT(*) FROM usage_stats WHERE component_name = ?",
        (target_name,),
    ).fetchone()[0]
    target_null = conn.execute(
        "SELECT COUNT(*) FROM usage_stats WHERE component_name = ? AND component_id IS NULL",
        (target_name,),
    ).fetchone()[0]
    cursor_sessions = conn.execute(
        "SELECT COUNT(*) FROM usage_sessions WHERE project_path = ?",
        (CURSOR_GLOBAL_PROJECT_PATH,),
    ).fetchone()[0]
    return {
        "total": total,
        "null_count": null_count,
        "null_ratio_pct": _ratio(null_count, total),
        "target_total": target_total,
        "target_null": target_null,
        "cursor_sessions": cursor_sessions,
    }


def _delete_cursor_usage(conn: sqlite3.Connection) -> dict[str, int]:
    session_rows = conn.execute(
        "SELECT id FROM usage_sessions WHERE project_path = ?",
        (CURSOR_GLOBAL_PROJECT_PATH,),
    ).fetchall()
    session_ids = [row[0] for row in session_rows]

    deleted_stats = 0
    if session_ids:
        placeholders = ",".join(["?"] * len(session_ids))
        deleted_stats = conn.execute(
            f"DELETE FROM usage_stats WHERE session_id IN ({placeholders})",
            session_ids,
        ).rowcount

    deleted_sessions = conn.execute(
        "DELETE FROM usage_sessions WHERE project_path = ?",
        (CURSOR_GLOBAL_PROJECT_PATH,),
    ).rowcount
    deleted_parse_state = conn.execute(
        "DELETE FROM usage_parse_state WHERE project_path = ?",
        (CURSOR_GLOBAL_PROJECT_PATH,),
    ).rowcount
    conn.commit()
    return {
        "deleted_stats": deleted_stats,
        "deleted_sessions": deleted_sessions,
        "deleted_parse_state": deleted_parse_state,
    }


def _rebuild_cursor_usage(conn: sqlite3.Connection, cursor_db_path: str) -> dict[str, int]:
    parsed = parse_cursor_db(cursor_db_path)
    cleanup = _delete_cursor_usage(conn)

    sessions_saved = 0
    stats_saved = 0
    for session in parsed:
        save_usage_stats(
            conn,
            project_path=CURSOR_GLOBAL_PROJECT_PATH,
            session_file=session["session_key"],
            stats=session["stats"],
            platform="cursor",
        )
        sessions_saved += 1
        stats_saved += len(session["stats"])

    backfill_result = backfill_component_ids(conn)
    return {
        "parsed_sessions": len(parsed),
        "sessions_saved": sessions_saved,
        "stats_saved": stats_saved,
        "backfill_matched": backfill_result["matched"],
        "backfill_unmatched": backfill_result["unmatched"],
        **cleanup,
    }


def _print_stats(title: str, stats: dict[str, int | float], target_name: str) -> None:
    print(title)
    print(f"  usage_stats total: {stats['total']}")
    print(f"  component_id NULL: {stats['null_count']} ({stats['null_ratio_pct']}%)")
    print(f"  target '{target_name}' total: {stats['target_total']}")
    print(f"  target '{target_name}' NULL: {stats['target_null']}")
    print(f"  cursor sessions: {stats['cursor_sessions']}")


def _validate_required_tables(conn: sqlite3.Connection) -> None:
    required = {"usage_stats", "usage_sessions", "usage_parse_state", "components"}
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    existing = {row[0] for row in rows}
    missing = required - existing
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise RuntimeError(f"필수 테이블이 없습니다: {missing_list}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Cursor usage 재매칭(복구) 스크립트")
    parser.add_argument(
        "--db-path",
        default="~/.vibesmith/vibesmith.db",
        help="VibeSmith SQLite DB 경로 (기본값: ~/.vibesmith/vibesmith.db)",
    )
    parser.add_argument(
        "--cursor-db-path",
        default=None,
        help="Cursor state.vscdb 경로 (미지정 시 자동 탐색)",
    )
    parser.add_argument(
        "--cursor-base-dir",
        default=None,
        help="Cursor base dir (자동 탐색 보조용)",
    )
    parser.add_argument(
        "--target-name",
        default="SKILL.md",
        help="복구 우선 모니터링 대상 component_name (기본값: SKILL.md)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="실제 DB 변경 없이 결과를 시뮬레이션",
    )
    args = parser.parse_args()

    db_path = str(Path(args.db_path).expanduser())
    if not Path(db_path).is_file():
        print(f"❌ DB 파일을 찾을 수 없습니다: {db_path}")
        return 1

    cursor_db_path = args.cursor_db_path or discover_cursor_db_path(base_dir=args.cursor_base_dir)
    if not cursor_db_path:
        print("❌ Cursor state.vscdb 경로를 찾지 못했습니다. --cursor-db-path를 지정하세요.")
        return 1
    if not Path(cursor_db_path).is_file():
        print(f"❌ Cursor DB 파일이 없습니다: {cursor_db_path}")
        return 1

    source_conn = sqlite3.connect(db_path)
    try:
        _validate_required_tables(source_conn)

        if args.dry_run:
            # save_usage_stats가 내부 commit을 수행하므로, 원본 DB 보호를 위해 in-memory 복사본에서 실행
            conn = sqlite3.connect(":memory:")
            source_conn.backup(conn)
        else:
            conn = source_conn

        try:
            before = _collect_stats(conn, args.target_name)
            rebuild = _rebuild_cursor_usage(conn, cursor_db_path)
            after = _collect_stats(conn, args.target_name)

            print("")
            print("Cursor usage rematch summary")
            print("================================")
            _print_stats("Before:", before, args.target_name)
            print("")
            print("Rebuild:")
            print(f"  parsed sessions: {rebuild['parsed_sessions']}")
            print(f"  saved sessions: {rebuild['sessions_saved']}")
            print(f"  saved stats: {rebuild['stats_saved']}")
            print(f"  backfill matched: {rebuild['backfill_matched']}")
            print(f"  backfill unmatched: {rebuild['backfill_unmatched']}")
            print(f"  deleted old cursor stats: {rebuild['deleted_stats']}")
            print("")
            _print_stats("After:", after, args.target_name)
            print("")
            print(
                "Delta:",
                f"component_id NULL {before['null_count']} -> {after['null_count']}",
                f"(target '{args.target_name}' NULL {before['target_null']} -> {after['target_null']})",
            )
            print("")
            if args.dry_run:
                print("✅ dry-run 완료 (원본 DB 변경 없음)")
            else:
                print("✅ 복구 완료")
        finally:
            if args.dry_run:
                conn.close()
    except Exception as e:
        print(f"❌ 실행 실패: {e}")
        return 1
    finally:
        source_conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
