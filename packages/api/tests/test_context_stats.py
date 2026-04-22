"""컨텍스트 최적화 API 테스트."""

from fastapi.testclient import TestClient


def test_estimate_tokens_cjk():
    """CJK 가중치 적용 토큰 추정 테스트."""
    from vibesmith_api.routes.dashboard import _estimate_tokens

    # 순수 ASCII: 4글자 = 1토큰
    assert _estimate_tokens("a" * 400) == 100

    # 순수 한국어: 1글자 = 2.5토큰
    assert _estimate_tokens("가" * 100) == 250

    # 혼합: ASCII 200자(50토큰) + 한국어 100자(250토큰)
    assert _estimate_tokens("a" * 200 + "가" * 100) == 300

    # 빈값
    assert _estimate_tokens("") == 0
    assert _estimate_tokens(None) == 0


def test_estimate_tokens_strips_frontmatter():
    """frontmatter 제거 후 토큰 추정."""
    from vibesmith_api.routes.dashboard import _estimate_tokens

    content_with_fm = "---\nname: test\ndescription: hello\n---\n" + "a" * 400
    content_without_fm = "a" * 400

    # frontmatter가 제거되므로 본문만 계산
    assert _estimate_tokens(content_with_fm) == _estimate_tokens(content_without_fm)


def test_estimate_catalog_tokens():
    """catalog tier 토큰 추정 (name + description)."""
    from vibesmith_api.routes.dashboard import _estimate_catalog_tokens

    class FakeComp:
        def __init__(self, name, description=None):
            self.name = name
            self.description = description

    comp = FakeComp("my-skill", "A useful skill for coding")
    tokens = _estimate_catalog_tokens(comp)
    # "my-skill A useful skill for coding" = 35 chars → 35 // 4 = 8
    assert tokens == 8

    comp_no_desc = FakeComp("my-skill")
    tokens_no_desc = _estimate_catalog_tokens(comp_no_desc)
    # "my-skill" = 8 chars → 8 // 4 = 2
    assert tokens_no_desc == 2


def test_platform_tier_config():
    """플랫폼별 tier 설정이 존재하는지 확인."""
    from vibesmith_api.routes.dashboard import PLATFORM_LIMITS, PLATFORM_TIERS

    assert "claude_code" in PLATFORM_TIERS
    cc_tiers = PLATFORM_TIERS["claude_code"]
    cc_names = [t["name"] for t in cc_tiers]
    assert "always" in cc_names
    assert "catalog" in cc_names
    assert "excluded" in cc_names

    assert "cursor" in PLATFORM_TIERS
    cursor_tiers = PLATFORM_TIERS["cursor"]
    cursor_names = [t["name"] for t in cursor_tiers]
    assert "always" in cursor_names
    assert "conditional" in cursor_names
    assert "manual" in cursor_names

    assert PLATFORM_LIMITS["claude_code"]["recommended"] == 12000
    assert PLATFORM_LIMITS["cursor"]["recommended"] == 8000


def test_classify_claude_code():
    """Claude Code 구성요소 tier 분류."""
    from vibesmith_api.routes.dashboard import _classify_component

    class FakeComp:
        def __init__(self, type, frontmatter=None):
            self.type = type
            self.frontmatter = frontmatter

    assert _classify_component(FakeComp("rule"), "claude_code") == "always"
    assert _classify_component(FakeComp("skill"), "claude_code") == "catalog"
    assert _classify_component(FakeComp("command"), "claude_code") == "catalog"
    assert _classify_component(FakeComp("agent"), "claude_code") == "catalog"
    assert _classify_component(FakeComp("hook"), "claude_code") == "excluded"


def test_classify_cursor():
    """Cursor 구성요소 tier 분류."""
    from vibesmith_api.routes.dashboard import _classify_component

    class FakeComp:
        def __init__(self, type, frontmatter=None):
            self.type = type
            self.frontmatter = frontmatter

    assert _classify_component(FakeComp("rule", {"alwaysApply": True}), "cursor") == "always"
    assert _classify_component(FakeComp("rule", {"globs": "*.py"}), "cursor") == "conditional"
    assert _classify_component(FakeComp("rule"), "cursor") == "manual"
    assert _classify_component(FakeComp("rule", {}), "cursor") == "manual"


def test_oversized_tier_based():
    """tier별 차등 임계값 적용."""
    from vibesmith_api.routes.dashboard import _analyze_oversized

    class FakeComp:
        def __init__(self, id, name, content, type="rule", frontmatter=None):
            self.id = id
            self.name = name
            self.content = content
            self.type = type
            self.frontmatter = frontmatter

    components = [
        FakeComp("1", "small-rule", "a" * 4000, "rule"),  # 1000 tokens < 3000
        FakeComp("2", "big-rule", "a" * 16000, "rule"),  # 4000 tokens > 3000
        FakeComp("3", "big-skill", "a" * 20000, "skill"),  # catalog — oversized 미적용
    ]

    suggestions = _analyze_oversized(components, "claude_code")
    assert len(suggestions) == 1
    assert suggestions[0].component_id == "2"


def test_tech_mismatch_file_based(tmp_path):
    """실제 파일 기반 기술 스택 감지."""
    from vibesmith_api.routes.dashboard import _detect_project_stack

    (tmp_path / "pyproject.toml").write_text("[project]")
    stack = _detect_project_stack(str(tmp_path))
    assert "python" in stack

    (tmp_path / "package.json").write_text("{}")
    stack = _detect_project_stack(str(tmp_path))
    assert "python" in stack
    assert "typescript" in stack


def test_tech_mismatch_no_false_positive_monorepo(tmp_path):
    """모노레포에서 양쪽 스택 스킬 모두 미스매치 아님."""
    from vibesmith_api.routes.dashboard import _analyze_tech_mismatch

    (tmp_path / "pyproject.toml").write_text("[project]")
    (tmp_path / "package.json").write_text("{}")

    class FakeComp:
        def __init__(self, id, name, type, tags):
            self.id = id
            self.name = name
            self.type = type
            self.tags = tags

    components = [
        FakeComp("1", "python-lint", "skill", ["python"]),
        FakeComp("2", "react-hook", "skill", ["typescript", "react"]),
    ]

    suggestions = _analyze_tech_mismatch(components, str(tmp_path))
    assert len(suggestions) == 0


def test_global_overuse_absolute_path():
    """절대경로 감지 기반 글로벌 과다."""
    from vibesmith_api.routes.dashboard import _analyze_global_overuse

    class FakeComp:
        def __init__(self, id, name, content, tags=None, is_global=True):
            self.id = id
            self.name = name
            self.content = content
            self.tags = tags or []
            self.is_global = is_global

    components = [
        FakeComp("1", "project-deploy", "Run /Users/john/myproject/deploy.sh"),
        FakeComp("2", "react-helper", "A react helper", tags=["react"]),
        FakeComp("3", "git-commit", "Commit changes"),
        FakeComp("4", "local-rule", "Local content", is_global=False),
    ]

    suggestions = _analyze_global_overuse(components)
    ids = {s.component_id for s in suggestions}
    assert "1" in ids
    assert "2" in ids
    assert "3" not in ids
    assert "4" not in ids


def test_duplicate_content_verification():
    """이름 유사 + content 유사도 이중 검증."""
    from vibesmith_api.routes.dashboard import _analyze_duplicates

    class FakeComp:
        def __init__(self, id, name, content=""):
            self.id = id
            self.name = name
            self.content = content

    components = [
        FakeComp("1", "git-commit-helper", "git commit with conventional format and validation"),
        FakeComp("2", "git-commit-helper-v2", "git commit with conventional format and lint check"),
        FakeComp("3", "git-push-helper", "push changes to remote with force option"),
    ]

    suggestions = _analyze_duplicates(components)
    assert len(suggestions) == 1
    assert suggestions[0].component_id == "2"
    assert "git-commit-helper" in suggestions[0].reason


def test_schema_exists():
    """스키마 클래스가 존재하고 필드가 올바른지 확인."""
    from vibesmith_api.schemas import (
        ContextStatsResponse,
        PlatformContextStats,
        TierStats,
    )

    tier = TierStats(
        name="always",
        label="상시 로드",
        description="매 대화 시작 시 전문 주입",
        components=[],
        total_tokens=0,
        count=0,
        counts_toward_limit=True,
    )
    assert tier.counts_toward_limit is True

    platform = PlatformContextStats(
        platform="claude_code",
        tiers=[tier],
        recommended_max_tokens=12000,
        effective_tokens=0,
        status="ok",
    )
    assert platform.effective_tokens == 0

    resp = ContextStatsResponse(platforms=[platform], suggestions=[])
    assert len(resp.platforms) == 1


def test_global_returns_average_effective_tokens(client: TestClient, core, tmp_path):
    """project_id 없이 호출 시 effective_tokens가 프로젝트별 평균."""
    # 프로젝트 A: rule 2개 (always tier)
    proj_a = tmp_path / "proj-a"
    skill_dir_a = proj_a / ".claude" / "rules"
    skill_dir_a.mkdir(parents=True)
    (skill_dir_a / "rule-a1.md").write_text("a" * 400)  # 100 tokens
    (skill_dir_a / "rule-a2.md").write_text("a" * 800)  # 200 tokens
    pa = core.projects.add_project(str(proj_a))
    client.post("/api/scan", json={"project_id": pa.id})

    # 프로젝트 B: rule 1개 (always tier)
    proj_b = tmp_path / "proj-b"
    skill_dir_b = proj_b / ".claude" / "rules"
    skill_dir_b.mkdir(parents=True)
    (skill_dir_b / "rule-b1.md").write_text("a" * 1200)  # 300 tokens
    pb = core.projects.add_project(str(proj_b))
    client.post("/api/scan", json={"project_id": pb.id})

    # 개별 프로젝트별 effective_tokens 확인
    resp_a = client.get(f"/api/stats/context?project_id={pa.id}")
    resp_b = client.get(f"/api/stats/context?project_id={pb.id}")
    assert resp_a.status_code == 200
    assert resp_b.status_code == 200

    data_a = resp_a.json()
    data_b = resp_b.json()

    # 각 플랫폼에서 effective_tokens 추출
    cc_a = next((p for p in data_a["platforms"] if p["platform"] == "claude_code"), None)
    cc_b = next((p for p in data_b["platforms"] if p["platform"] == "claude_code"), None)

    # 둘 다 값이 있어야 함
    if cc_a is None or cc_b is None:
        import pytest

        pytest.skip("claude_code platform not found in responses")

    eff_a = cc_a["effective_tokens"]
    eff_b = cc_b["effective_tokens"]
    expected_avg = (eff_a + eff_b) // 2

    # 글로벌 호출
    resp_global = client.get("/api/stats/context")
    assert resp_global.status_code == 200
    data_global = resp_global.json()
    cc_global = next(p for p in data_global["platforms"] if p["platform"] == "claude_code")

    # 평균이어야 함 (합산이 아님)
    assert cc_global["effective_tokens"] == expected_avg
    # 합산이 아닌지 확인
    assert cc_global["effective_tokens"] < eff_a + eff_b or eff_a == 0 or eff_b == 0

    # tier별 total_tokens/count도 프로젝트 평균이어야 함
    always_a = next(t for t in cc_a["tiers"] if t["name"] == "always")
    always_b = next(t for t in cc_b["tiers"] if t["name"] == "always")
    always_global = next(t for t in cc_global["tiers"] if t["name"] == "always")

    expected_tier_tokens = (always_a["total_tokens"] + always_b["total_tokens"]) // 2
    expected_tier_count = (always_a["count"] + always_b["count"]) // 2

    assert always_global["total_tokens"] == expected_tier_tokens, (
        f"tier total_tokens should be avg: {expected_tier_tokens}, got {always_global['total_tokens']}"
    )
    assert always_global["count"] == expected_tier_count, (
        f"tier count should be avg: {expected_tier_count}, got {always_global['count']}"
    )


def test_get_context_stats_empty(client: TestClient):
    """빈 상태에서 컨텍스트 통계 조회."""
    response = client.get("/api/stats/context")
    assert response.status_code == 200

    data = response.json()
    assert "platforms" in data
    assert "suggestions" in data
    assert isinstance(data["platforms"], list)


def test_get_context_stats_with_components(client: TestClient, sample_project):
    """구성요소가 있는 상태에서 통계 조회."""
    client.post("/api/scan", json={"project_id": sample_project["id"]})

    response = client.get("/api/stats/context")
    assert response.status_code == 200

    data = response.json()
    assert len(data["platforms"]) >= 1

    # 각 플랫폼에 tiers, effective_tokens, status 필드 확인
    for platform in data["platforms"]:
        assert "platform" in platform
        assert "tiers" in platform
        assert "effective_tokens" in platform
        assert "recommended_max_tokens" in platform
        assert platform["status"] in ["ok", "warning", "critical"]

        # 각 tier에 필수 필드 확인
        for tier in platform["tiers"]:
            assert "name" in tier
            assert "label" in tier
            assert "total_tokens" in tier
            assert "count" in tier
            assert "counts_toward_limit" in tier
            assert "components" in tier

        # effective_tokens = counts_toward_limit=True인 tier 합산
        expected_effective = sum(t["total_tokens"] for t in platform["tiers"] if t["counts_toward_limit"])
        assert platform["effective_tokens"] == expected_effective


def test_suggestions_priority_order(client: TestClient):
    """제안 우선순위 정렬 테스트."""
    response = client.get("/api/stats/context")
    assert response.status_code == 200

    data = response.json()
    suggestions = data["suggestions"]

    # 우선순위가 high -> medium -> low 순서로 정렬되어야 함
    priority_order = {"high": 0, "medium": 1, "low": 2}

    for i in range(len(suggestions) - 1):
        current_priority = priority_order[suggestions[i]["priority"]]
        next_priority = priority_order[suggestions[i + 1]["priority"]]
        assert current_priority <= next_priority


# ── #749: v1 제거 및 v2 통합 검증 테스트 ──────────────────────────


def test_v1_endpoint_removed(client: TestClient):
    """#749: v1 엔드포인트 /stats/context/old가 제거되었는지 확인."""
    response = client.get("/api/stats/context/old")
    assert response.status_code == 404


def test_estimate_tokens_uses_cjk_weighting():
    """#749: _estimate_tokens가 CJK 가중치를 적용하는지 확인 (v2 동작)."""
    from vibesmith_api.routes.dashboard import _estimate_tokens

    # 한국어 100자: 1글자 = 2.5 토큰 → 250 토큰
    assert _estimate_tokens("가" * 100) == 250
    # ASCII 400자: 4글자 = 1 토큰 → 100 토큰
    assert _estimate_tokens("a" * 400) == 100


def test_analyze_duplicates_verifies_content():
    """#749: _analyze_duplicates가 이름+내용 이중 검증하는지 확인 (v2 동작)."""
    from vibesmith_api.routes.dashboard import _analyze_duplicates

    class FakeComp:
        def __init__(self, id, name, content=""):
            self.id = id
            self.name = name
            self.content = content

    # 이름은 유사하지만 내용이 완전히 다른 경우 → 중복 아님
    components = [
        FakeComp("1", "git-commit-helper", "aaa bbb ccc ddd eee fff ggg hhh"),
        FakeComp("2", "git-commit-helper-pro", "zzz yyy xxx www vvv uuu ttt sss"),
    ]
    suggestions = _analyze_duplicates(components)
    assert len(suggestions) == 0  # v2: 내용이 다르면 중복으로 잡지 않음


def test_context_stats_response_is_v2_format():
    """#749: ContextStatsResponse가 v2 형식(platforms 필드)인지 확인."""
    from vibesmith_api.schemas import ContextStatsResponse

    fields = set(ContextStatsResponse.model_fields.keys())
    assert "platforms" in fields
    assert "suggestions" in fields
    # v1 전용 필드가 없어야 함
    assert "per_component" not in fields
    assert "estimated_total_tokens" not in fields


def test_v2_suffix_functions_removed():
    """#749: _v2 접미사 함수들이 제거되었는지 확인."""
    import vibesmith_api.routes.dashboard as dashboard

    assert not hasattr(dashboard, "_analyze_oversized_v2")
    assert not hasattr(dashboard, "_analyze_duplicates_v2")
    assert not hasattr(dashboard, "_analyze_tech_mismatch_v2")
    assert not hasattr(dashboard, "_analyze_global_overuse_v2")
    assert not hasattr(dashboard, "_estimate_tokens_v2")
    assert not hasattr(dashboard, "get_context_stats_v2")


def test_v2_suffix_schema_removed():
    """#749: ContextStatsResponseV2 스키마가 제거되었는지 확인."""
    import vibesmith_api.schemas as schemas

    assert not hasattr(schemas, "ContextStatsResponseV2")


# ── #749: 유사도 비교 고도화 테스트 ──────────────────────────


def test_name_similarity_uses_sequence_matcher():
    """#749: 이름 유사도가 SequenceMatcher 기반으로 부분 매칭을 감지한다."""
    from vibesmith_api.routes.dashboard import _analyze_duplicates

    class FakeComp:
        def __init__(self, id, name, content="", type="rule", scope="global"):
            self.id = id
            self.name = name
            self.content = content
            self.type = type
            self.scope = scope

    # "python-style" vs "python-conventions" — word Jaccard=0.5 (미달), SequenceMatcher≈0.64 (통과)
    components = [
        FakeComp("1", "python-style", "use snake_case for functions and variables always"),
        FakeComp("2", "python-conventions", "use snake_case for functions and variables always"),
    ]
    suggestions = _analyze_duplicates(components)
    assert len(suggestions) >= 1, "SequenceMatcher가 부분 문자열 매칭을 감지해야 함"
    assert suggestions[0].component_id == "2"


def test_duplicate_priority_dynamic():
    """#749: 유사도 점수에 따라 priority가 동적으로 결정된다."""
    from vibesmith_api.routes.dashboard import _analyze_duplicates

    class FakeComp:
        def __init__(self, id, name, content="", type="rule", scope="global"):
            self.id = id
            self.name = name
            self.content = content
            self.type = type
            self.scope = scope

    # 거의 동일한 쌍 → high
    components_high = [
        FakeComp("1", "git-commit-helper", "git commit with conventional format and validation checks"),
        FakeComp("2", "git-commit-helper-v2", "git commit with conventional format and validation checks"),
    ]
    suggestions = _analyze_duplicates(components_high)
    assert len(suggestions) >= 1
    assert suggestions[0].priority == "high", f"거의 동일한 쌍은 high여야 함, got {suggestions[0].priority}"


def test_duplicate_priority_medium():
    """#749: 중간 수준 유사도는 medium priority."""
    from vibesmith_api.routes.dashboard import _analyze_duplicates

    class FakeComp:
        def __init__(self, id, name, content="", type="rule", scope="global"):
            self.id = id
            self.name = name
            self.content = content
            self.type = type
            self.scope = scope

    # 이름 유사, 내용 부분 유사 → medium
    components = [
        FakeComp("1", "deploy-script", "deploy to production server with docker compose and nginx"),
        FakeComp("2", "deploy-scripts", "deploy to staging server with kubernetes and helm charts"),
    ]
    suggestions = _analyze_duplicates(components)
    assert len(suggestions) >= 1
    assert suggestions[0].priority in ("medium", "low"), "중간 유사도는 medium 또는 low여야 함"


def test_structure_metadata_boosts_similarity():
    """#749: 같은 type+scope인 경우 구조 가산점으로 감지 확률이 높아진다."""
    from vibesmith_api.routes.dashboard import _analyze_duplicates

    class FakeComp:
        def __init__(self, id, name, content="", type="rule", scope="global"):
            self.id = id
            self.name = name
            self.content = content
            self.type = type
            self.scope = scope

    # 같은 type+scope: 구조 가산점으로 감지됨
    same_structure = [
        FakeComp("1", "lint-check", "run eslint on all source files", type="rule", scope="global"),
        FakeComp("2", "lint-verify", "run eslint on all source files", type="rule", scope="global"),
    ]
    suggestions_same = _analyze_duplicates(same_structure)

    # 다른 type+scope: 구조 감점으로 감지 안 됨 또는 낮은 priority
    diff_structure = [
        FakeComp("3", "lint-check", "run eslint on all source files", type="rule", scope="global"),
        FakeComp("4", "lint-verify", "run eslint on all source files", type="skill", scope="project"),
    ]
    suggestions_diff = _analyze_duplicates(diff_structure)

    # 같은 구조가 더 높은 점수를 받아야 함
    assert len(suggestions_same) >= 1
    if len(suggestions_diff) >= 1 and len(suggestions_same) >= 1:
        assert suggestions_same[0].similarity_score >= suggestions_diff[0].similarity_score


def test_similarity_score_field_exists():
    """#749: OptimizationSuggestion에 similarity_score 필드가 존재한다."""
    from vibesmith_api.schemas import OptimizationSuggestion

    fields = set(OptimizationSuggestion.model_fields.keys())
    assert "similarity_score" in fields, "similarity_score 필드가 OptimizationSuggestion에 있어야 함"


def test_duplicate_returns_similarity_score():
    """#749: 중복 제안에 similarity_score 값이 포함된다."""
    from vibesmith_api.routes.dashboard import _analyze_duplicates

    class FakeComp:
        def __init__(self, id, name, content="", type="rule", scope="global"):
            self.id = id
            self.name = name
            self.content = content
            self.type = type
            self.scope = scope

    components = [
        FakeComp("1", "git-commit-helper", "git commit with conventional format and validation"),
        FakeComp("2", "git-commit-helper-v2", "git commit with conventional format and lint check"),
    ]
    suggestions = _analyze_duplicates(components)
    assert len(suggestions) >= 1
    assert suggestions[0].similarity_score is not None
    assert 0.0 < suggestions[0].similarity_score <= 1.0


def test_non_duplicate_suggestions_have_no_similarity_score():
    """#749: 중복이 아닌 제안(oversized 등)은 similarity_score가 None이다."""
    from vibesmith_api.schemas import OptimizationSuggestion

    suggestion = OptimizationSuggestion(
        type="oversized",
        component_id="1",
        component_name="big-rule",
        reason="too large",
        action="split",
        priority="high",
    )
    assert suggestion.similarity_score is None
