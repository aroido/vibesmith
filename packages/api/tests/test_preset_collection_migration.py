"""Legacy bundle migration tests."""

from __future__ import annotations

from pathlib import Path

from vibesmith_api.preset_collection_migration import LegacyPresetMigrationService
from vibesmith_api.project_templates_repo import ProjectTemplateRepository


def _snapshot_component(name: str, content: str) -> dict:
    return {
        "component_type": "skill",
        "name": name,
        "platform": "claude_code",
        "description": f"{name} description",
        "template_id": None,
        "config": {},
        "content": content,
        "frontmatter": {"name": name},
        "tags": ["migration", name],
    }


def _create_legacy_template(core, *, name: str, component_name: str = "legacy-skill") -> dict:
    repo = ProjectTemplateRepository(core.db)
    return repo.create_template(
        name=name,
        description=f"{name} template",
        tags=["legacy"],
        components=[_snapshot_component(component_name, f"---\nname: {component_name}\n---\n\nv1")],
        preset_type="snapshot",
        change_note="initial",
    )


def test_migration_dry_run_does_not_mutate_target_tables(core):
    template = _create_legacy_template(core, name="Dry Run Template", component_name="dry-skill")
    assert template["latest_revision"] == 1

    conn = core.db.get_connection()
    before = {
        "presets": conn.execute("SELECT COUNT(*) FROM presets").fetchone()[0],
        "preset_revisions": conn.execute("SELECT COUNT(*) FROM preset_revisions").fetchone()[0],
        "collections": conn.execute("SELECT COUNT(*) FROM collections").fetchone()[0],
        "collection_revisions": conn.execute("SELECT COUNT(*) FROM collection_revisions").fetchone()[0],
        "collection_items": conn.execute("SELECT COUNT(*) FROM collection_items").fetchone()[0],
        "collection_apply_logs": conn.execute("SELECT COUNT(*) FROM collection_apply_logs").fetchone()[0],
    }

    summary = LegacyPresetMigrationService(conn).run(dry_run=True)
    assert summary["mode"] == "dry-run"
    assert summary["templates_scanned"] >= 1
    assert summary["templates_migrated"] >= 1
    assert summary["mismatches"] == []

    after = {
        "presets": conn.execute("SELECT COUNT(*) FROM presets").fetchone()[0],
        "preset_revisions": conn.execute("SELECT COUNT(*) FROM preset_revisions").fetchone()[0],
        "collections": conn.execute("SELECT COUNT(*) FROM collections").fetchone()[0],
        "collection_revisions": conn.execute("SELECT COUNT(*) FROM collection_revisions").fetchone()[0],
        "collection_items": conn.execute("SELECT COUNT(*) FROM collection_items").fetchone()[0],
        "collection_apply_logs": conn.execute("SELECT COUNT(*) FROM collection_apply_logs").fetchone()[0],
    }
    assert before == after


def test_migration_real_run_and_idempotency(core, tmp_path: Path):
    repo = ProjectTemplateRepository(core.db)
    created = _create_legacy_template(core, name="Idempotent Template", component_name="idem-skill")
    template_id = created["id"]

    updated = repo.update_template(
        template_id,
        name="Idempotent Template",
        description="updated",
        tags=["legacy", "updated"],
        components=[_snapshot_component("idem-skill", "---\nname: idem-skill\n---\n\nv2")],
        change_note="v2 update",
    )
    assert updated["latest_revision"] == 2

    project_dir = tmp_path / "migration-idempotent-project"
    project_dir.mkdir(parents=True)
    project = core.projects.add_project(str(project_dir))

    repo.log_apply_result(
        project_id=project.id,
        preset_id=template_id,
        revision=1,
        policy="skip",
        status="applied",
        summary={"created": 1, "updated": 0},
    )

    conn = core.db.get_connection()
    service = LegacyPresetMigrationService(conn)

    first = service.run(dry_run=False)
    assert first["mode"] == "real-run"
    assert first["templates_migrated"] >= 1
    assert first["mismatches"] == []

    first_counts = {
        "presets": conn.execute("SELECT COUNT(*) FROM presets").fetchone()[0],
        "preset_revisions": conn.execute("SELECT COUNT(*) FROM preset_revisions").fetchone()[0],
        "collections": conn.execute("SELECT COUNT(*) FROM collections").fetchone()[0],
        "collection_revisions": conn.execute("SELECT COUNT(*) FROM collection_revisions").fetchone()[0],
        "collection_items": conn.execute("SELECT COUNT(*) FROM collection_items").fetchone()[0],
        "collection_apply_logs": conn.execute("SELECT COUNT(*) FROM collection_apply_logs").fetchone()[0],
    }

    mapped = conn.execute(
        "SELECT collection_id FROM preset_collection_template_map WHERE template_id = ?",
        (template_id,),
    ).fetchone()
    assert mapped is not None
    collection_id = mapped[0]

    collection_latest = conn.execute(
        "SELECT latest_revision FROM collections WHERE id = ?",
        (collection_id,),
    ).fetchone()
    assert collection_latest is not None
    assert int(collection_latest[0]) == 2

    migrated_log = conn.execute(
        "SELECT COUNT(*) FROM collection_apply_logs WHERE collection_id = ? AND project_id = ?",
        (collection_id, project.id),
    ).fetchone()[0]
    assert migrated_log >= 1

    second = service.run(dry_run=False)
    assert second["templates_skipped"] >= 1
    assert second["mismatches"] == []

    second_counts = {
        "presets": conn.execute("SELECT COUNT(*) FROM presets").fetchone()[0],
        "preset_revisions": conn.execute("SELECT COUNT(*) FROM preset_revisions").fetchone()[0],
        "collections": conn.execute("SELECT COUNT(*) FROM collections").fetchone()[0],
        "collection_revisions": conn.execute("SELECT COUNT(*) FROM collection_revisions").fetchone()[0],
        "collection_items": conn.execute("SELECT COUNT(*) FROM collection_items").fetchone()[0],
        "collection_apply_logs": conn.execute("SELECT COUNT(*) FROM collection_apply_logs").fetchone()[0],
    }
    assert first_counts == second_counts


def test_migration_handles_malformed_legacy_rows(core):
    created = _create_legacy_template(core, name="Malformed Template", component_name="malformed-skill")
    template_id = created["id"]
    conn = core.db.get_connection()

    revision_row = conn.execute(
        """
        SELECT r.id
        FROM project_template_revisions r
        WHERE r.template_id = ?
        ORDER BY r.revision ASC
        LIMIT 1
        """,
        (template_id,),
    ).fetchone()
    assert revision_row is not None
    revision_id = revision_row[0]

    conn.execute(
        """
        UPDATE project_template_revision_items
        SET component_type = 'invalid-type', frontmatter_json = '{bad-json', tags_json = 'not-json'
        WHERE revision_id = ?
        """,
        (revision_id,),
    )
    conn.commit()

    summary = LegacyPresetMigrationService(conn).run(dry_run=False, template_id=template_id)
    assert summary["templates_scanned"] == 1
    assert summary["malformed_rows"] >= 1
    assert len(summary["warnings"]) >= 1


def test_migration_large_fixture_smoke(core):
    repo = ProjectTemplateRepository(core.db)
    for index in range(30):
        name = f"Bulk Template {index}"
        component_name = f"bulk-skill-{index}"
        repo.create_template(
            name=name,
            description="bulk migration fixture",
            tags=["bulk"],
            components=[_snapshot_component(component_name, f"---\nname: {component_name}\n---\n\nbulk")],
            preset_type="snapshot",
            change_note="bulk",
        )

    conn = core.db.get_connection()
    summary = LegacyPresetMigrationService(conn).run(dry_run=True)
    assert summary["templates_scanned"] >= 30
    assert summary["templates_migrated"] >= 30
