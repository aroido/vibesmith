"""성능 벤치마크 테스트 (Issue #40)."""

import time

import pytest

from vibesmith_core.components.models import ComponentType, Skill
from vibesmith_core.components.operations import ComponentOperations
from vibesmith_core.infra.db import DatabaseManager
from vibesmith_core.projects import ProjectManager


@pytest.fixture
def db(tmp_path):
    manager = DatabaseManager(str(tmp_path / "test.db"))
    manager.initialize_schema()
    yield manager
    manager.close()


@pytest.fixture
def ops(db):
    return ComponentOperations(db)


def _make_skill(skill_id: str, name: str, project_id: str) -> Skill:
    return Skill(
        id=skill_id,
        type=ComponentType.SKILL,
        name=name,
        description="",
        enabled=True,
        project_id=project_id,
        path=f"/tmp/{skill_id}",
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
        platform="claude_code",
    )


class TestListAllWithProjectPerformance:
    """list_all_with_project() 성능 벤치마크."""

    def test_benchmark_10_components_2_projects(self, ops, tmp_path):
        """10개 컴포넌트, 2개 프로젝트 — 1번 쿼리, 200ms 이하."""
        pm = ProjectManager(ops._db)
        p1 = pm.add_project(str(tmp_path / "p1"))
        p2 = pm.add_project(str(tmp_path / "p2"))

        # 각 프로젝트에 5개씩 생성
        for i in range(5):
            ops.create(_make_skill(f"s1-{i}", f"skill-{i}", p1.id))
            ops.create(_make_skill(f"s2-{i}", f"skill-{i}", p2.id))

        start = time.perf_counter()
        result = ops.list_all_with_project()
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(result) == 10
        assert elapsed_ms < 200  # 로컬 SQLite는 매우 빠름

    def test_benchmark_100_components_10_projects(self, ops, tmp_path):
        """100개 컴포넌트, 10개 프로젝트 — 1번 쿼리, 500ms 이하."""
        pm = ProjectManager(ops._db)
        projects = []
        for i in range(10):
            proj_path = tmp_path / f"proj-{i}"
            proj_path.mkdir()
            projects.append(pm.add_project(str(proj_path)))

        # 각 프로젝트에 10개씩 생성
        for proj_idx, proj in enumerate(projects):
            for comp_idx in range(10):
                ops.create(_make_skill(f"s-{proj_idx}-{comp_idx}", f"skill-{comp_idx}", proj.id))

        start = time.perf_counter()
        result = ops.list_all_with_project()
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert len(result) == 100
        assert elapsed_ms < 500  # 충분한 여유

    def test_result_correctness(self, ops, tmp_path):
        """결과 정합성 — project_name이 올바르게 매칭되는가."""
        pm = ProjectManager(ops._db)
        p1 = pm.add_project(str(tmp_path / "alpha"))
        p2 = pm.add_project(str(tmp_path / "beta"))

        ops.create(_make_skill("s1", "skill-1", p1.id))
        ops.create(_make_skill("s2", "skill-2", p2.id))

        result = ops.list_all_with_project()

        assert len(result) == 2
        result_dict = {c.id: pn for c, pn in result}
        assert result_dict["s1"] == "alpha"
        assert result_dict["s2"] == "beta"
