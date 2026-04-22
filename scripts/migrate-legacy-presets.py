#!/usr/bin/env python3
"""Legacy project_templates -> Preset/Collection V1 migration script."""

# ruff: noqa: E402

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "packages" / "api"))

from vibesmith_api.preset_collection_migration import LegacyPresetMigrationService


def _print_summary(summary: dict) -> None:
    print("")
    print("Preset/Collection migration summary")
    print("===================================")
    print(f"mode: {summary.get('mode')}")
    print(f"run_id: {summary.get('run_id')}")
    print(f"started_at: {summary.get('started_at')}")
    print(f"finished_at: {summary.get('finished_at')}")
    print("")
    print("Counters:")
    for key in (
        "templates_scanned",
        "templates_migrated",
        "templates_skipped",
        "collections_created",
        "collections_updated",
        "collection_revisions_created",
        "collection_items_rewritten",
        "presets_created",
        "preset_revisions_created",
        "apply_logs_migrated",
        "malformed_rows",
    ):
        print(f"  - {key}: {summary.get(key, 0)}")
    print("")
    print("Before counts:")
    for key, value in (summary.get("before_counts") or {}).items():
        print(f"  - {key}: {value}")
    print("")
    print("After counts:")
    for key, value in (summary.get("after_counts") or {}).items():
        print(f"  - {key}: {value}")

    mismatches = summary.get("mismatches") or []
    if mismatches:
        print("")
        print("Mismatches:")
        for mismatch in mismatches:
            print(f"  - {mismatch}")

    warnings = summary.get("warnings") or []
    if warnings:
        print("")
        print(f"Warnings ({len(warnings)}):")
        preview = warnings[:10]
        for warning in preview:
            print(f"  - {warning}")
        if len(warnings) > len(preview):
            print(f"  - ... ({len(warnings) - len(preview)} more)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Legacy Bundle -> Preset/Collection V1 backfill")
    parser.add_argument(
        "--db-path",
        default="~/.vibesmith/vibesmith.db",
        help="VibeSmith SQLite DB path (default: ~/.vibesmith/vibesmith.db)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run migration on in-memory clone and print impact summary only",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verification only (no backfill execution)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit templates to migrate",
    )
    parser.add_argument(
        "--template-id",
        default=None,
        help="Migrate/verify single legacy template id",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print raw JSON summary",
    )
    args = parser.parse_args()

    db_path = Path(args.db_path).expanduser()
    if not db_path.is_file():
        print(f"❌ DB file not found: {db_path}")
        return 1

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    try:
        service = LegacyPresetMigrationService(conn)
        summary = service.run(
            dry_run=args.dry_run,
            verify_only=args.verify,
            limit=args.limit,
            template_id=args.template_id,
        )
    except Exception as error:
        print(f"❌ migration failed: {error}")
        return 1
    finally:
        conn.close()

    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        _print_summary(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
