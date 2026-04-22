"""dependency.py 테스트 — 컨텍스트 힌트 기반 종속성 분석."""

from vibesmith_core.components.models import DependencyType, Skill, Subagent
from vibesmith_core.dependencies.analyzer import (
    DependencyAnalyzer,
    _extract_candidate_refs,
    _parse_context_to_names,
)


def _make_skill(id_: str, name: str, context_files=None, content=None):
    return Skill(
        id=id_,
        name=name,
        project_id="proj-1",
        path=f"/path/{name}",
        context_files=context_files,
        content=content,
        created_at="2026-02-10",
        updated_at="2026-02-10",
        platform="claude_code",
    )


def _make_agent(id_: str, name: str, agents=None, content=None):
    return Subagent(
        id=id_,
        name=name,
        project_id="proj-1",
        path=f"/path/{name}",
        agents=agents,
        content=content,
        created_at="2026-02-10",
        updated_at="2026-02-10",
        platform="claude_code",
    )


class TestExtractCandidateRefs:
    """마커 기반 후보 추출 테스트."""

    def test_backtick_extraction(self):
        text = "Use `pydantic-model` for validation."
        assert _extract_candidate_refs(text) == {"pydantic-model"}

    def test_slash_command_extraction(self):
        text = "Run /check command to verify."
        assert _extract_candidate_refs(text) == {"check"}

    def test_double_quote_extraction(self):
        text = 'Please use "fastapi-route" skill.'
        assert _extract_candidate_refs(text) == {"fastapi-route"}

    def test_single_quote_extraction(self):
        text = "Call 'pytest-write' to generate tests."
        assert _extract_candidate_refs(text) == {"pytest-write"}

    def test_skills_prefix_extraction(self):
        text = "This depends on skills/pydantic-model and skills/fastapi-route."
        assert _extract_candidate_refs(text) == {"pydantic-model", "fastapi-route"}

    def test_agents_prefix_extraction(self):
        text = "Run agents/planner and then agents/code-reviewer."
        assert _extract_candidate_refs(text) == {"planner", "code-reviewer"}

    def test_mixed_markers(self):
        text = "Use `foo`, /bar, and skills/baz together."
        assert _extract_candidate_refs(text) == {"foo", "bar", "baz"}

    def test_no_markers(self):
        text = "Please check the output carefully."
        assert _extract_candidate_refs(text) == set()

    def test_url_not_extracted(self):
        # URL 경로는 추출되지 않아야 함
        text = "Visit /api/v1/check endpoint."
        # '/api', '/v1', '/check'가 아닌 빈 set이어야 함 (슬래시 패턴 경계 처리)
        result = _extract_candidate_refs(text)
        # URL 내부 경로는 negative lookbehind로 제외됨
        assert "api" not in result
        assert "v1" not in result

    def test_case_insensitive(self):
        text = "Use `Foo-Bar` and `foo-bar`."
        result = _extract_candidate_refs(text)
        # 모두 소문자로 정규화됨
        assert result == {"foo-bar"}

    def test_empty_text(self):
        assert _extract_candidate_refs("") == set()
        assert _extract_candidate_refs(None) == set()  # type: ignore


class TestParseContextToNames:
    """context 필드 파싱 테스트."""

    def test_skill_path_parsing(self):
        context = ["skills/pydantic-model/SKILL.md", "skills/fastapi-route/SKILL.md"]
        assert _parse_context_to_names(context) == ["pydantic-model", "fastapi-route"]

    def test_agent_path_parsing(self):
        context = ["agents/planner.md", "agents/code-reviewer.md"]
        assert _parse_context_to_names(context) == ["planner", "code-reviewer"]

    def test_mixed_paths(self):
        context = ["skills/foo/SKILL.md", "agents/bar.md"]
        assert _parse_context_to_names(context) == ["foo", "bar"]

    def test_non_component_paths_ignored(self):
        context = ["readme.txt", "config.json", "skills/valid/SKILL.md"]
        assert _parse_context_to_names(context) == ["valid"]

    def test_none_context(self):
        assert _parse_context_to_names(None) == []

    def test_empty_context(self):
        assert _parse_context_to_names([]) == []


class TestAnalyzeAll:
    """analyze_all() 종속성 분석 테스트."""

    def test_context_dependency(self):
        """CONTEXT 타입: Skill의 context 필드 참조."""
        s1 = _make_skill("s1", "base")
        s2 = _make_skill("s2", "child", context_files=["skills/base/SKILL.md"])

        analyzer = DependencyAnalyzer([s1, s2])
        deps = analyzer.analyze_all()

        assert len(deps) == 1
        assert deps[0].source_id == "s2"
        assert deps[0].target_id == "s1"
        assert deps[0].dep_type == DependencyType.CONTEXT

    def test_agents_field_dependency(self):
        """AGENTS_FIELD 타입: Subagent의 agents 필드 참조."""
        a1 = _make_agent("a1", "planner")
        a2 = _make_agent("a2", "orchestrator", agents=["planner"])

        analyzer = DependencyAnalyzer([a1, a2])
        deps = analyzer.analyze_all()

        assert len(deps) == 1
        assert deps[0].source_id == "a2"
        assert deps[0].target_id == "a1"
        assert deps[0].dep_type == DependencyType.AGENTS_FIELD

    def test_body_reference_dependency(self):
        """BODY_REFERENCE 타입: 본문 마커 기반 참조."""
        s1 = _make_skill("s1", "pydantic-model")
        s2 = _make_skill("s2", "api-route", content="Use `pydantic-model` for validation.")

        analyzer = DependencyAnalyzer([s1, s2])
        deps = analyzer.analyze_all()

        assert len(deps) == 1
        assert deps[0].source_id == "s2"
        assert deps[0].target_id == "s1"
        assert deps[0].dep_type == DependencyType.BODY_REFERENCE

    def test_ignores_unknown_names(self):
        """알려지지 않은 이름은 무시."""
        s1 = _make_skill("s1", "known", content="Use `unknown-skill` here.")

        analyzer = DependencyAnalyzer([s1])
        deps = analyzer.analyze_all()

        assert len(deps) == 0

    def test_ignores_self_reference(self):
        """자기 참조는 무시."""
        s1 = _make_skill("s1", "self-ref", content="This is `self-ref` skill.")

        analyzer = DependencyAnalyzer([s1])
        deps = analyzer.analyze_all()

        assert len(deps) == 0

    def test_deduplication(self):
        """중복 종속성 제거."""
        s1 = _make_skill("s1", "base")
        s2 = _make_skill(
            "s2",
            "child",
            context_files=["skills/base/SKILL.md"],
            content="Use `base` skill.",
        )

        analyzer = DependencyAnalyzer([s1, s2])
        deps = analyzer.analyze_all()

        # CONTEXT 1개 + BODY_REFERENCE 1개 = 2개
        assert len(deps) == 2
        dep_types = {d.dep_type for d in deps}
        assert dep_types == {DependencyType.CONTEXT, DependencyType.BODY_REFERENCE}

    def test_multiple_dependencies(self):
        """여러 종속성 동시 분석."""
        s1 = _make_skill("s1", "base")
        s2 = _make_skill("s2", "utils")
        s3 = _make_skill(
            "s3",
            "complex",
            context_files=["skills/base/SKILL.md"],
            content="Use `utils` for helpers.",
        )

        analyzer = DependencyAnalyzer([s1, s2, s3])
        deps = analyzer.analyze_all()

        assert len(deps) == 2
        # s3 → s1 (CONTEXT), s3 → s2 (BODY_REFERENCE)
        sources = {d.source_id for d in deps}
        targets = {d.target_id for d in deps}
        assert sources == {"s3"}
        assert targets == {"s1", "s2"}

    def test_empty_components(self):
        """빈 컴포넌트 목록."""
        analyzer = DependencyAnalyzer([])
        deps = analyzer.analyze_all()

        assert len(deps) == 0


class TestDetectCycles:
    """순환참조 감지 테스트."""

    def test_simple_cycle(self):
        """A → B → A 순환."""
        s1 = _make_skill("s1", "alpha", content="Use `beta` skill.")
        s2 = _make_skill("s2", "beta", content="Use `alpha` skill.")

        analyzer = DependencyAnalyzer([s1, s2])
        cycles = analyzer.detect_cycles()

        assert len(cycles) >= 1
        # NetworkX는 순환을 여러 형태로 반환할 수 있음
        # 최소 1개 순환 존재 확인
        assert any("s1" in cycle and "s2" in cycle for cycle in cycles)

    def test_three_way_cycle(self):
        """A → B → C → A 순환."""
        s1 = _make_skill("s1", "alpha", content="Use `beta` skill.")
        s2 = _make_skill("s2", "beta", content="Use `gamma` skill.")
        s3 = _make_skill("s3", "gamma", content="Use `alpha` skill.")

        analyzer = DependencyAnalyzer([s1, s2, s3])
        cycles = analyzer.detect_cycles()

        assert len(cycles) >= 1
        assert any("s1" in cycle and "s2" in cycle and "s3" in cycle for cycle in cycles)

    def test_no_cycle(self):
        """순환 없음."""
        s1 = _make_skill("s1", "base")
        s2 = _make_skill("s2", "child", content="Use `base` skill.")

        analyzer = DependencyAnalyzer([s1, s2])
        cycles = analyzer.detect_cycles()

        assert len(cycles) == 0

    def test_empty_graph(self):
        """빈 그래프."""
        analyzer = DependencyAnalyzer([])
        cycles = analyzer.detect_cycles()

        assert len(cycles) == 0


class TestGetDependentsAndDependencies:
    """get_dependents / get_dependencies 테스트."""

    def test_get_dependents(self):
        """s1을 참조하는 컴포넌트 목록."""
        s1 = _make_skill("s1", "base")
        s2 = _make_skill("s2", "child1", content="Use `base` skill.")
        s3 = _make_skill("s3", "child2", content="Use `base` skill.")

        analyzer = DependencyAnalyzer([s1, s2, s3])
        dependents = analyzer.get_dependents("s1")

        assert set(dependents) == {"s2", "s3"}

    def test_get_dependencies(self):
        """s2가 참조하는 컴포넌트 목록."""
        s1 = _make_skill("s1", "base")
        s2 = _make_skill("s2", "utils")
        s3 = _make_skill("s3", "complex", content="Use `base` and `utils` skills.")

        analyzer = DependencyAnalyzer([s1, s2, s3])
        dependencies = analyzer.get_dependencies("s3")

        assert set(dependencies) == {"s1", "s2"}

    def test_no_dependents(self):
        """아무도 참조하지 않음."""
        s1 = _make_skill("s1", "isolated")
        s2 = _make_skill("s2", "other")

        analyzer = DependencyAnalyzer([s1, s2])
        dependents = analyzer.get_dependents("s1")

        assert len(dependents) == 0

    def test_no_dependencies(self):
        """아무것도 참조하지 않음."""
        s1 = _make_skill("s1", "base")

        analyzer = DependencyAnalyzer([s1])
        dependencies = analyzer.get_dependencies("s1")

        assert len(dependencies) == 0
