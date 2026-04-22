"""종속성 그래프 API — Dependency Graph 페이지용."""

from fastapi import APIRouter, Depends, Query
from vibesmith_core import VibeSmithCore
from vibesmith_core.dependencies.analyzer import DependencyAnalyzer
from vibesmith_core.dependencies.repo import get_all_dependencies

from vibesmith_api.deps import get_core
from vibesmith_api.i18n import KEYS
from vibesmith_api.i18n.exceptions import I18nHTTPException
from vibesmith_api.schemas import (
    DependencyDetailItem,
    DependencyDetailResponse,
    GraphData,
    GraphEdge,
    GraphNode,
)

router = APIRouter(prefix="/api", tags=["dependencies"])


@router.get(
    "/dependencies",
    response_model=GraphData,
    summary="종속성 그래프 전체 조회",
    response_description="노드/엣지/순환참조 데이터",
)
def get_dependency_graph(
    project_id: str | None = Query(None, description="특정 프로젝트로 필터"),
    types: list[str] | None = Query(
        default=None,
        alias="type",
        description="구성요소 타입 필터 (skill, agent, command, hook, rule, 반복 전달 가능)",
    ),
    core: VibeSmithCore = Depends(get_core),
) -> GraphData:
    """전체 종속성 그래프를 노드/엣지 형태로 반환한다.

    프론트엔드 그래프 시각화에 사용한다.
    """
    conn = core.db.get_connection()

    # 1. 모든 컴포넌트 조회 (필터 적용)
    query = (
        "SELECT id, name, type, project_id, enabled, platform FROM components"
        " WHERE deleted_at IS NULL"
        " AND project_id NOT IN (SELECT id FROM projects WHERE hidden_at IS NOT NULL)"
    )
    params: list = []

    if project_id:
        query += " AND project_id = ?"
        params.append(project_id)

    if types:
        placeholders = ", ".join("?" for _ in types)
        query += f" AND type IN ({placeholders})"
        params.extend(types)

    rows = conn.execute(query, params).fetchall()

    # 노드 생성
    nodes = [
        GraphNode(
            id=row[0],
            name=row[1],
            type=row[2],
            project_id=row[3],
            enabled=bool(row[4]),
            platform=row[5] or "unknown",
        )
        for row in rows
    ]

    # 2. 종속성 조회 (필터된 컴포넌트만)
    node_ids = {node.id for node in nodes}
    deps = get_all_dependencies(conn)

    # 활성 컴포넌트 ID 집합 (삭제되지 않은 전체)
    all_active_ids = {
        row[0]
        for row in conn.execute(
            "SELECT id FROM components WHERE deleted_at IS NULL"
            " AND project_id NOT IN (SELECT id FROM projects WHERE hidden_at IS NOT NULL)"
        ).fetchall()
    }

    # 엣지 생성 (source가 필터 내에 있는 것만, target 존재 여부로 is_broken 판정)
    edges = [
        GraphEdge(
            source=dep.source_id,
            target=dep.target_id,
            type=dep.dep_type.value,
            is_broken=dep.target_id not in all_active_ids,
        )
        for dep in deps
        if dep.source_id in node_ids
    ]

    # 3. 순환참조 감지
    components = core.operations.list_all(exclude_hidden_projects=True)
    analyzer = DependencyAnalyzer(components)
    all_cycles = analyzer.detect_cycles()

    # 필터된 노드만 포함된 순환
    cycles = [cycle for cycle in all_cycles if all(c_id in node_ids for c_id in cycle)]

    return GraphData(nodes=nodes, edges=edges, cycles=cycles)


@router.get(
    "/dependencies/{component_id}",
    response_model=DependencyDetailResponse,
    summary="특정 구성요소의 종속성 조회",
    response_description="depends_on, depended_by 목록",
)
def get_component_dependencies(
    component_id: str,
    core: VibeSmithCore = Depends(get_core),
) -> DependencyDetailResponse:
    """특정 구성요소가 참조하는 것과 참조되는 것을 반환한다.

    - **depends_on**: 이 구성요소가 의존하는 다른 구성요소들
    - **depended_by**: 이 구성요소를 참조하는 다른 구성요소들

    존재하지 않는 구성요소 ID는 404를 반환한다.
    """
    comp = core.operations.read(component_id)
    if comp is None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)

    # 숨긴 프로젝트 소속이면 404
    project = core.projects.get(comp.project_id)
    if project and project.hidden_at is not None:
        raise I18nHTTPException(404, KEYS.COMPONENT_NOT_FOUND)

    conn = core.db.get_connection()

    # depends_on: 이 컴포넌트가 의존하는 것들 (LEFT JOIN으로 삭제된 대상도 포함)
    depends_on_rows = conn.execute(
        """
        SELECT d.target_id, c.name, c.type, d.dep_type, c.deleted_at
        FROM dependencies d
        LEFT JOIN components c ON d.target_id = c.id
        WHERE d.source_id = ?
        """,
        (component_id,),
    ).fetchall()

    depends_on = [
        DependencyDetailItem(
            id=row[0],
            name=row[1] or "(deleted)",
            type=row[2] or "unknown",
            dependency_type=row[3],
            is_broken=row[1] is None or row[4] is not None,
        )
        for row in depends_on_rows
    ]

    # depended_by: 이 컴포넌트를 참조하는 것들
    depended_by_rows = conn.execute(
        """
        SELECT d.source_id, c.name, c.type, d.dep_type, c.deleted_at
        FROM dependencies d
        LEFT JOIN components c ON d.source_id = c.id
        WHERE d.target_id = ?
        """,
        (component_id,),
    ).fetchall()

    depended_by = [
        DependencyDetailItem(
            id=row[0],
            name=row[1] or "(deleted)",
            type=row[2] or "unknown",
            dependency_type=row[3],
            is_broken=row[1] is None or row[4] is not None,
        )
        for row in depended_by_rows
    ]

    return DependencyDetailResponse(
        component_id=component_id,
        depends_on=depends_on,
        depended_by=depended_by,
    )
