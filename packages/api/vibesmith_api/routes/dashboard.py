"""Dashboard 관련 엔드포인트."""

import re
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from fastapi import APIRouter, Depends
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.watcher import FileWatcher
from vibesmith_core.usage.scanner import UsageScanner

from vibesmith_api.deps import get_core, get_usage_scanner, get_watcher
from vibesmith_api.schemas import (
    ActiveWorkersResponse,
    ComponentTokenInfo,
    ContextStatsResponse,
    DashboardStatsResponse,
    OptimizationSuggestion,
    PlatformContextStats,
    SystemStatusResponse,
    TierStats,
    TrendInfo,
)

router = APIRouter(prefix="/api", tags=["dashboard"])

# ── 플랫폼별 Tier 설정 ──────────────────────────────────────────

PLATFORM_TIERS: dict[str, list[dict]] = {
    "claude_code": [
        {
            "name": "always",
            "label": "상시 로드",
            "description": "매 대화 시작 시 전문 주입",
            "counts_toward_limit": True,
        },
        {
            "name": "catalog",
            "label": "카탈로그",
            "description": "name+description 목록 노출",
            "counts_toward_limit": True,
        },
        {
            "name": "excluded",
            "label": "컨텍스트 외",
            "description": "컨텍스트에 포함되지 않음",
            "counts_toward_limit": False,
        },
    ],
    "cursor": [
        {
            "name": "always",
            "label": "상시 로드",
            "description": "alwaysApply 규칙",
            "counts_toward_limit": True,
        },
        {
            "name": "conditional",
            "label": "조건부 로드",
            "description": "glob 패턴 매칭 시 로드",
            "counts_toward_limit": False,
        },
        {
            "name": "manual",
            "label": "수동 호출",
            "description": "@멘션으로 수동 호출",
            "counts_toward_limit": False,
        },
    ],
}

PLATFORM_LIMITS: dict[str, dict] = {
    "claude_code": {"recommended": 12000, "warning_ratio": 1.5},
    "cursor": {"recommended": 8000, "warning_ratio": 1.5},
}

OVERSIZED_THRESHOLDS: dict[str, dict[str, int]] = {
    "claude_code": {"always": 3000},
    "cursor": {"always": 2000},
}


def _parse_last_scanned(s: str | None) -> datetime | None:
    """last_scanned_at 문자열을 timezone-aware UTC datetime으로 변환.

    naive datetime(예: 2026-02-10T00:00:00)은 UTC로 보정.
    파싱 실패 또는 빈 문자열 시 None 반환.
    """
    if s is None or not str(s).strip():
        return None
    try:
        normalized = str(s).replace("Z", "+00:00").strip()
        parsed = datetime.fromisoformat(normalized)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed
    except (ValueError, AttributeError, TypeError):
        return None


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="대시보드 통계 조회",
    response_description="전체 구성요소 통계 (타입별 개수, 활성화 현황, 트렌드)",
)
def get_dashboard_stats(core: VibeSmithCore = Depends(get_core)):
    """대시보드에 표시할 전체 통계를 반환합니다.

    **포함 정보:**
    - **타입별 개수**: Skill, Agent, Command, Hook, Rule 각각의 총 개수
    - **활성화 현황**: 전체/활성/비활성 구성요소 수
    - **트렌드**: 각 타입의 증감 추이 (변화량, 백분율, 방향)
    """
    # 모든 구성요소 조회 (숨긴 프로젝트 제외)
    all_components = core.operations.list_all({}, exclude_hidden_projects=True)

    # 타입별 개수 계산
    type_counts = {
        "skill": 0,
        "agent": 0,
        "command": 0,
        "hook": 0,
        "rule": 0,
    }

    active_count = 0
    inactive_count = 0

    for comp in all_components:
        comp_type = str(comp.type).lower()
        if comp_type in type_counts:
            type_counts[comp_type] += 1

        if comp.enabled:
            active_count += 1
        else:
            inactive_count += 1

    # 트렌드 계산 (더미 데이터 - Phase 2에서 실제 구현)
    # TODO: localStorage 또는 DB에 이전 스냅샷 저장하여 실제 트렌드 계산
    trends = {
        "skills": TrendInfo(value=0, percentage=0.0, direction="neutral"),
        "agents": TrendInfo(value=0, percentage=0.0, direction="neutral"),
        "commands": TrendInfo(value=0, percentage=0.0, direction="neutral"),
        "hooks": TrendInfo(value=0, percentage=0.0, direction="neutral"),
        "rules": TrendInfo(value=0, percentage=0.0, direction="neutral"),
    }

    return DashboardStatsResponse(
        total_skills=type_counts["skill"],
        total_agents=type_counts["agent"],
        total_commands=type_counts["command"],
        total_hooks=type_counts["hook"],
        total_rules=type_counts["rule"],
        active_count=active_count,
        inactive_count=inactive_count,
        total_count=len(all_components),
        trends=trends,
    )


@router.get(
    "/system/status",
    response_model=SystemStatusResponse,
    summary="시스템 상태 조회",
    response_description="시스템 활성 여부, 스캔 시간, 건강도 점수",
)
def get_system_status(
    core: VibeSmithCore = Depends(get_core),
    watcher: FileWatcher = Depends(get_watcher),
    usage_scanner: UsageScanner = Depends(get_usage_scanner),
):
    """VibeSmith 시스템의 현재 상태를 반환합니다.

    **포함 정보:**
    - **is_live**: API 서버 정상 동작 여부 (응답 시 항상 true, #810)
    - **last_scan_at**: 가장 최근에 실행된 스캔 시각 (ISO 8601)
    - **active_workers**: 백그라운드 워커(FileWatcher, UsageScanner) 실행 상태
    - **health_score**: 시스템 건강도 (0~100). 스캔 완료된 프로젝트 비율로 계산
    """
    # 가장 최근 스캔된 프로젝트의 시간 조회
    projects = core.projects.list_all()

    if not projects:
        # 프로젝트가 없는 경우
        now = datetime.now(UTC).isoformat()
        return SystemStatusResponse(
            is_live=True,
            last_scan_at=now,
            active_workers=ActiveWorkersResponse(
                watcher=watcher.is_running,
                usage_scanner=usage_scanner.is_running,
            ),
            health_score=0,
        )

    # 실제 스캔 완료된 프로젝트만 대상 (last_scanned_at 비어있으면 미스캔)
    parsed_times = [dt for p in projects if (dt := _parse_last_scanned(p.last_scanned_at)) is not None]
    total_projects = len(projects)

    # 미스캔만 있으면 health_score=0 (is_live는 API 응답 자체가 서버 alive 증거)
    if not parsed_times:
        now = datetime.now(UTC)
        return SystemStatusResponse(
            is_live=True,
            last_scan_at=now.isoformat().replace("+00:00", "Z"),
            active_workers=ActiveWorkersResponse(
                watcher=watcher.is_running,
                usage_scanner=usage_scanner.is_running,
            ),
            health_score=0,
        )

    # 가장 최근 스캔 시간 (실제 스캔된 프로젝트만)
    last_scan = max(parsed_times)

    # 건강도: 스캔 완료된 프로젝트 비율
    scanned_count = len(parsed_times)
    health_score = int((scanned_count / total_projects) * 100) if total_projects > 0 else 0

    return SystemStatusResponse(
        is_live=True,  # API 응답 자체가 서버 alive 증거 (#810)
        last_scan_at=last_scan.isoformat().replace("+00:00", "Z"),
        active_workers=ActiveWorkersResponse(
            watcher=watcher.is_running,
            usage_scanner=usage_scanner.is_running,
        ),
        health_score=health_score,
    )


def _is_cjk(char: str) -> bool:
    """CJK (한중일) 문자 여부를 판별한다."""
    cp = ord(char)
    return (
        0x4E00 <= cp <= 0x9FFF  # CJK Unified Ideographs
        or 0x3400 <= cp <= 0x4DBF  # CJK Extension A
        or 0xAC00 <= cp <= 0xD7AF  # Hangul Syllables
        or 0x3040 <= cp <= 0x30FF  # Hiragana + Katakana
    )


def _strip_frontmatter(content: str) -> str:
    """YAML frontmatter(---...---)를 제거한다."""
    if content.startswith("---"):
        end = content.find("---", 3)
        if end != -1:
            return content[end + 3 :].lstrip("\n")
    return content


def _estimate_tokens(content: str | None) -> int:
    """CJK 가중치를 적용한 토큰 추정.

    - CJK 문자: 1글자 ≈ 2.5 토큰
    - ASCII 문자: 4글자 ≈ 1 토큰
    - YAML frontmatter는 제외
    """
    if not content:
        return 0
    body = _strip_frontmatter(content)
    cjk_count = sum(1 for c in body if _is_cjk(c))
    ascii_count = len(body) - cjk_count
    return int(cjk_count * 2.5) + (ascii_count // 4)


def _estimate_catalog_tokens(comp) -> int:
    """catalog tier용 토큰 추정 (name + description만)."""
    text = comp.name or ""
    if comp.description:
        text += " " + comp.description
    return _estimate_tokens(text)


def _classify_component(comp, platform: str) -> str | None:
    """구성요소를 플랫폼별 tier로 분류한다. None이면 컨텍스트 제외."""
    comp_type = comp.type.lower() if isinstance(comp.type, str) else str(comp.type).lower()

    if platform == "claude_code":
        if comp_type == "rule":
            return "always"
        if comp_type == "hook":
            return "excluded"
        # skill, command, agent 및 기타
        return "catalog"

    if platform == "cursor":
        fm = comp.frontmatter if hasattr(comp, "frontmatter") else None
        fm = fm or {}
        if isinstance(fm, str):
            fm = {}
        if fm.get("alwaysApply") is True:
            return "always"
        if fm.get("globs"):
            return "conditional"
        return "manual"

    return "on_demand"


def _analyze_oversized(components: list, platform: str) -> list[OptimizationSuggestion]:
    """계층별 + 플랫폼별 과대 구성요소 감지."""
    suggestions = []
    thresholds = OVERSIZED_THRESHOLDS.get(platform, {})
    for comp in components:
        tier = _classify_component(comp, platform)
        if tier is None:
            continue
        tokens = _estimate_tokens(comp.content)
        effective_tier = "on_demand" if tier == "catalog" else tier
        threshold = thresholds.get(effective_tier)
        if threshold and tokens >= threshold:
            suggestions.append(
                OptimizationSuggestion(
                    type="oversized",
                    component_id=comp.id,
                    component_name=comp.name,
                    reason=f"{tokens} tokens — {tier} 계층 임계값({threshold}) 초과, 분할 권장",
                    action="split",
                    priority="high",
                )
            )
    return suggestions


def _detect_project_stack(project_path: str) -> set[str]:
    """프로젝트 경로의 설정 파일로 기술 스택을 감지한다."""
    stack: set[str] = set()
    root = Path(project_path)
    if (root / "pyproject.toml").exists() or (root / "requirements.txt").exists():
        stack.add("python")
    if (root / "package.json").exists() or (root / "tsconfig.json").exists():
        stack.add("typescript")
    if (root / "Cargo.toml").exists():
        stack.add("rust")
    if (root / "go.mod").exists():
        stack.add("go")
    if (root / "pom.xml").exists() or (root / "build.gradle").exists():
        stack.add("java")
    return stack


_STACK_TAG_MAP: dict[str, set[str]] = {
    "python": {"python", "django", "flask", "fastapi"},
    "typescript": {"typescript", "javascript", "react", "vue", "angular", "node"},
    "rust": {"rust"},
    "go": {"go", "golang"},
    "java": {"java", "spring", "kotlin"},
}


def _analyze_tech_mismatch(components: list, project_path: str) -> list[OptimizationSuggestion]:
    """실제 파일 기반 기술 불일치 감지."""
    suggestions = []
    stack = _detect_project_stack(project_path)
    if not stack:
        return suggestions
    for comp in components:
        if comp.type.lower() != "skill":
            continue
        tags_lower = {t.lower() for t in (comp.tags or [])}
        if not tags_lower:
            continue
        comp_stacks = set()
        for stack_name, stack_tags in _STACK_TAG_MAP.items():
            if tags_lower & stack_tags:
                comp_stacks.add(stack_name)
        if not comp_stacks:
            continue
        if not (comp_stacks & stack):
            suggestions.append(
                OptimizationSuggestion(
                    type="tech_mismatch",
                    component_id=comp.id,
                    component_name=comp.name,
                    reason=(
                        f"프로젝트 스택({', '.join(sorted(stack))})과 불일치 — 태그: {', '.join(sorted(tags_lower))}"
                    ),
                    action="disable",
                    priority="medium",
                )
            )
    return suggestions


_STACK_SPECIFIC_TAGS = {"react", "vue", "angular", "django", "flask", "spring", "rails", "flutter", "fastapi", "nextjs"}


def _analyze_global_overuse(components: list) -> list[OptimizationSuggestion]:
    """절대경로 + 스택 전용 태그 기반 글로벌 과다 감지."""
    suggestions = []
    for comp in components:
        is_global = getattr(comp, "is_global", False)
        if not is_global:
            continue
        reason = None
        if comp.content and re.findall(r"(?:/[\w._-]+){3,}", comp.content):
            reason = "글로벌 구성요소에 절대경로 하드코딩됨 — 프로젝트로 이동 권장"
        if not reason:
            tags_lower = {t.lower() for t in (comp.tags or [])}
            matched = tags_lower & _STACK_SPECIFIC_TAGS
            if matched:
                reason = f"글로벌에 스택 전용 태그({', '.join(sorted(matched))}) — 프로젝트로 이동 권장"
        if reason:
            suggestions.append(
                OptimizationSuggestion(
                    type="global_overuse",
                    component_id=comp.id,
                    component_name=comp.name,
                    reason=reason,
                    action="move",
                    priority="low",
                )
            )
    return suggestions


def _ngrams(text: str, n: int) -> list[str]:
    """텍스트에서 n-gram을 추출한다."""
    return [text[i : i + n] for i in range(len(text) - n + 1)]


def _content_similarity(a: str | None, b: str | None) -> float:
    """content의 3-gram Jaccard 유사도."""
    if not a or not b:
        return 0.0
    ngrams_a = set(_ngrams(a.lower(), 3))
    ngrams_b = set(_ngrams(b.lower(), 3))
    if not ngrams_a or not ngrams_b:
        return 0.0
    return len(ngrams_a & ngrams_b) / len(ngrams_a | ngrams_b)


def _name_similarity(a: str, b: str) -> float:
    """SequenceMatcher 기반 이름 유사도."""
    from difflib import SequenceMatcher

    return SequenceMatcher(None, a, b).ratio()


def _structure_similarity(comp_a: object, comp_b: object) -> float:
    """type, scope 일치도 기반 구조 유사도."""
    type_match = 1.0 if getattr(comp_a, "type", None) == getattr(comp_b, "type", None) else 0.0
    scope_a = getattr(comp_a, "scope", None) or getattr(comp_a, "is_global", None)
    scope_b = getattr(comp_b, "scope", None) or getattr(comp_b, "is_global", None)
    scope_match = 1.0 if scope_a == scope_b else 0.0
    return (type_match + scope_match) / 2


def _compute_final_score(name_sim: float, content_sim: float, structure_sim: float) -> float:
    """가중합으로 최종 유사도 점수를 계산한다."""
    return 0.3 * name_sim + 0.5 * content_sim + 0.2 * structure_sim


def _score_to_priority(score: float) -> str:
    """유사도 점수에 따라 동적 priority를 결정한다."""
    if score >= 0.85:
        return "high"
    if score >= 0.65:
        return "medium"
    return "low"


def _analyze_duplicates(components: list) -> list[OptimizationSuggestion]:
    """다중 신호 유사도 기반 중복 감지 (이름 + 내용 + 구조)."""
    suggestions = []
    seen: list[object] = []
    for comp in components:
        name_a = comp.name.lower().replace("-", " ").replace("_", " ").strip()
        for seen_comp in seen:
            name_b = seen_comp.name.lower().replace("-", " ").replace("_", " ").strip()

            name_sim = _name_similarity(name_a, name_b)
            if name_sim < 0.5:
                continue

            content_sim = _content_similarity(comp.content, seen_comp.content)
            structure_sim = _structure_similarity(comp, seen_comp)
            final_score = _compute_final_score(name_sim, content_sim, structure_sim)

            if final_score < 0.50:
                continue

            priority = _score_to_priority(final_score)
            suggestions.append(
                OptimizationSuggestion(
                    type="duplicate",
                    component_id=comp.id,
                    component_name=comp.name,
                    reason=f"'{seen_comp.name}'와 유사 — 병합 고려",
                    action="merge",
                    priority=priority,
                    similarity_score=round(final_score, 2),
                )
            )
            break
        seen.append(comp)
    return suggestions


def _calc_avg_tiers(components: list, platform: str, tier_config: list[dict]) -> dict[str, dict[str, int]]:
    """프로젝트별 tier 데이터를 계산한 후 평균을 반환한다.

    프로젝트가 선택되지 않은 글로벌 뷰에서 사용.
    각 프로젝트의 컨텍스트는 독립적으로 로드되므로 합산이 아닌 평균이 적절.

    Returns:
        {tier_name: {"total_tokens": avg, "count": avg}} 형태의 딕셔너리
    """
    by_project: dict[str, list] = {}
    for comp in components:
        pid = comp.project_id or "__global__"
        by_project.setdefault(pid, []).append(comp)

    tier_names = [t["name"] for t in tier_config]

    if not by_project:
        return {name: {"total_tokens": 0, "count": 0} for name in tier_names}

    # 프로젝트별 tier 토큰/카운트 수집
    per_project_tiers: list[dict[str, dict[str, int]]] = []
    for _pid, proj_comps in by_project.items():
        tier_buckets: dict[str, list] = {name: [] for name in tier_names}
        for comp in proj_comps:
            tier_name = _classify_component(comp, platform)
            if tier_name and tier_name in tier_buckets:
                tier_buckets[tier_name].append(comp)

        proj_tier_data: dict[str, dict[str, int]] = {}
        for tc in tier_config:
            name = tc["name"]
            comps = tier_buckets.get(name, [])
            tokens = 0
            for comp in comps:
                if name == "catalog":
                    tokens += _estimate_catalog_tokens(comp)
                else:
                    tokens += _estimate_tokens(comp.content)
            proj_tier_data[name] = {"total_tokens": tokens, "count": len(comps)}
        per_project_tiers.append(proj_tier_data)

    # 평균 계산
    n = len(per_project_tiers)
    result: dict[str, dict[str, int]] = {}
    for name in tier_names:
        avg_tokens = sum(pt[name]["total_tokens"] for pt in per_project_tiers) // n
        avg_count = sum(pt[name]["count"] for pt in per_project_tiers) // n
        result[name] = {"total_tokens": avg_tokens, "count": avg_count}
    return result


@router.get(
    "/stats/context",
    response_model=ContextStatsResponse,
    summary="컨텍스트 최적화 통계 조회",
    response_description="플랫폼별 계층적 토큰 사용량 분석 및 최적화 제안",
)
def get_context_stats(
    project_id: str | None = None,
    core: VibeSmithCore = Depends(get_core),
):
    """컨텍스트 최적화 통계를 반환합니다.

    플랫폼별(Claude Code, Cursor) 계층적 토큰 계산.
    """
    filters: dict = {"enabled": True}
    if project_id:
        filters["project_id"] = project_id

    all_components = core.operations.list_all(filters, exclude_hidden_projects=True)

    # 플랫폼별 분류
    platform_components: dict[str, list] = {}
    for comp in all_components:
        plat = comp.platform or "claude_code"
        platform_components.setdefault(plat, []).append(comp)

    # 구성요소가 없으면 기본 플랫폼 설정만 반환
    if not platform_components:
        platform_components = {p: [] for p in PLATFORM_TIERS}

    platforms = []
    all_suggestions = []

    for platform, components in platform_components.items():
        tier_config = PLATFORM_TIERS.get(platform)
        if not tier_config:
            continue

        limits = PLATFORM_LIMITS.get(platform, {"recommended": 8000, "warning_ratio": 1.5})

        # tier별 구성요소 분류
        tier_buckets: dict[str, list] = {t["name"]: [] for t in tier_config}

        for comp in components:
            tier_name = _classify_component(comp, platform)
            if tier_name is None:
                continue
            if tier_name in tier_buckets:
                tier_buckets[tier_name].append(comp)

        # TierStats 빌드
        tiers = []
        for tc in tier_config:
            name = tc["name"]
            comps = tier_buckets.get(name, [])

            comp_infos = []
            total_tokens = 0
            for comp in comps:
                if name == "catalog":
                    tokens = _estimate_catalog_tokens(comp)
                else:
                    tokens = _estimate_tokens(comp.content)
                file_size = len(comp.content) if comp.content else 0
                total_tokens += tokens
                comp_infos.append(
                    ComponentTokenInfo(
                        id=comp.id,
                        name=comp.name,
                        type=comp.type if isinstance(comp.type, str) else str(comp.type),
                        estimated_tokens=tokens,
                        file_size_bytes=file_size,
                    )
                )

            tiers.append(
                TierStats(
                    name=name,
                    label=tc["label"],
                    description=tc["description"],
                    components=comp_infos,
                    total_tokens=total_tokens,
                    count=len(comp_infos),
                    counts_toward_limit=tc["counts_toward_limit"],
                )
            )

        # effective_tokens 계산
        if project_id:
            # 단일 프로젝트: 합산
            effective = sum(t.total_tokens for t in tiers if t.counts_toward_limit)
        else:
            # 글로벌: 프로젝트별 평균 (tier 데이터도 평균으로 교체)
            avg_tiers = _calc_avg_tiers(components, platform, tier_config)
            for tier in tiers:
                avg = avg_tiers.get(tier.name)
                if avg:
                    tier.total_tokens = avg["total_tokens"]
                    tier.count = avg["count"]
            effective = sum(t.total_tokens for t in tiers if t.counts_toward_limit)

        # 상태 계산
        recommended = limits["recommended"]
        warning_limit = int(recommended * limits["warning_ratio"])
        if effective <= recommended:
            status = "ok"
        elif effective <= warning_limit:
            status = "warning"
        else:
            status = "critical"

        platforms.append(
            PlatformContextStats(
                platform=platform,
                tiers=tiers,
                recommended_max_tokens=recommended,
                effective_tokens=effective,
                status=status,
            )
        )

        # 제안 생성 (플랫폼별)
        all_suggestions.extend(_analyze_oversized(components, platform))

        # 프로젝트 맵 사전 빌드 (N+1 쿼리 방지)
        project_ids = {comp.project_id for comp in components if comp.project_id}
        project_map: dict = {}
        for pid in project_ids:
            try:
                project_map[pid] = core.projects.get(pid)
            except Exception:
                project_map[pid] = None

        # tech_mismatch: project_path가 필요
        if project_id:
            project = project_map.get(project_id) or core.projects.get(project_id)
            if project:
                all_suggestions.extend(_analyze_tech_mismatch(components, project.path))

        # global_overuse: is_global 정보를 래퍼로 주입 (Pydantic 모델 직접 할당 불가)
        comps_with_global = []
        for comp in components:
            proj = project_map.get(comp.project_id)
            is_global = proj.is_global if proj else False
            comps_with_global.append(
                SimpleNamespace(
                    id=comp.id,
                    name=comp.name,
                    content=comp.content,
                    tags=comp.tags,
                    is_global=is_global,
                )
            )
        all_suggestions.extend(_analyze_global_overuse(comps_with_global))

        all_suggestions.extend(_analyze_duplicates(components))

    # 우선순위별 정렬
    priority_order = {"high": 0, "medium": 1, "low": 2}
    all_suggestions.sort(key=lambda s: priority_order.get(s.priority, 2))

    return ContextStatsResponse(platforms=platforms, suggestions=all_suggestions)
