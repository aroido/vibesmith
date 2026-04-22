"""VibeSmith Core data models — Pydantic v2 based."""

from enum import StrEnum

from pydantic import BaseModel, Field


class ComponentType(StrEnum):
    """Managed component types."""

    SKILL = "skill"
    AGENT = "agent"
    COMMAND = "command"
    HOOK = "hook"
    RULE = "rule"


class DependencyType(StrEnum):
    """Dependency types."""

    CONTEXT = "context"
    BODY_REFERENCE = "body_reference"
    AGENTS_FIELD = "agents_field"


class Project(BaseModel):
    """Project metadata."""

    id: str
    name: str
    path: str
    is_global: bool = False
    component_count: int = 0
    last_scanned_at: str
    hidden_at: str | None = None


class ComponentBase(BaseModel):
    """Common fields for components."""

    id: str
    type: ComponentType
    name: str
    description: str | None = None
    enabled: bool = True
    tags: list[str] = Field(default_factory=list)
    project_id: str
    path: str
    content: str | None = None
    frontmatter: dict | None = None
    created_at: str
    updated_at: str
    platform: str
    last_used: str | None = None


class Skill(ComponentBase):
    """Skills — based on SKILL.md."""

    type: ComponentType = ComponentType.SKILL
    allowed_tools: list[str] | None = None
    context_files: list[str] | None = None
    agent: str | None = None


class Subagent(ComponentBase):
    """Subagents — based on agents/*.md."""

    type: ComponentType = ComponentType.AGENT
    tools: list[str] | None = None
    model: str | None = None
    permission_mode: str | None = None
    agents: list[str] | None = None


class Command(ComponentBase):
    """Commands — based on commands/*.md (no frontmatter)."""

    type: ComponentType = ComponentType.COMMAND


class HookAction(BaseModel):
    """Hook execution action."""

    type: str
    command: str
    timeout: int | None = None


class HookMatcher(BaseModel):
    """Hook matcher — tool pattern matching + list of actions to execute."""

    matcher: str
    hooks: list[HookAction]


class Hook(ComponentBase):
    """Hooks — based on settings.json hooks section (nested structure)."""

    type: ComponentType = ComponentType.HOOK
    event_type: str | None = None
    matchers: list[HookMatcher] | None = None


class Rule(ComponentBase):
    """Rules — based on rules/*.md."""

    type: ComponentType = ComponentType.RULE
    globs: list[str] | None = None


class Dependency(BaseModel):
    """Inter-component dependency."""

    source_id: str
    target_id: str
    dep_type: DependencyType


class Version(BaseModel):
    """Component version history."""

    id: str
    component_id: str
    version: int
    content: str
    created_at: str
