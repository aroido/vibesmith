"""API response schemas."""

from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class ErrorResponse(BaseModel):
    """4xx/5xx error response — I18nHTTPException handler output format.

    Schema for OpenAPI documentation. Actual errors are returned by i18n_http_exception_handler.
    """

    detail: str = Field(description="Translated error message (backward compatible)")
    message_key: str = Field(description="i18n key (e.g. errors.component_not_found)")
    message: str = Field(description="Translated message (same as detail)")


# ---- Feedback schemas (Issue #85) ----


FeedbackCategory = Literal["bug", "feature", "question"]


class FeedbackCreate(BaseModel):
    """Feedback submission request — for auto-creating GitHub issues."""

    title: str = Field(description="Feedback title")
    description: str = Field(description="Feedback description")
    category: FeedbackCategory = Field(description="Feedback type (bug, feature, question)")
    email: EmailStr | None = Field(None, description="Contact email (optional)")
    system_info: dict[str, str] | None = Field(None, description="System info (optional)")
    screenshot_url: str | None = Field(None, description="Screenshot URL (optional)")


class FeedbackCreateResponse(BaseModel):
    """Feedback submission response — created GitHub issue info."""

    issue_url: str = Field(description="GitHub issue URL")
    issue_number: int = Field(description="GitHub issue number")


# ---- Auth schemas (Issue #82) ----


class UserRegister(BaseModel):
    """User registration request."""

    email: EmailStr = Field(description="Email address")
    password: str = Field(description="Password", min_length=8)
    name: str | None = Field(None, description="User name")


class UserLogin(BaseModel):
    """Login request."""

    email: EmailStr = Field(description="Email address")
    password: str = Field(description="Password")


class Token(BaseModel):
    """Token response."""

    access_token: str = Field(description="Access Token (valid for 15 minutes)")
    refresh_token: str = Field(description="Refresh Token (valid for 30 days)")
    token_type: str = Field(default="bearer", description="Token type")


class RefreshRequest(BaseModel):
    """Token refresh request."""

    refresh_token: str = Field(description="Refresh Token")


class UserMeResponse(BaseModel):
    """Current logged-in user info."""

    id: str = Field(description="User ID")
    email: str = Field(description="Email")
    name: str | None = Field(None, description="User name")


def _validate_component_name(name: str) -> str:
    """Validate component name — block path traversal/separators (Issue #335)."""
    if not name or not name.strip():
        raise ValueError("Component name cannot be empty")
    if ".." in name or "/" in name or "\\" in name:
        raise ValueError("Component name must not contain path traversal ('..') or path separators ('/', '\\')")
    if len(name) > 200:
        raise ValueError("Component name must be at most 200 characters")
    return name.strip()


class ProjectResponse(BaseModel):
    """Project summary."""

    id: str = Field(description="Unique project ID (UUID)")
    name: str = Field(description="Project name (based on directory name)")
    path: str = Field(description="Project absolute path", examples=["/Users/dev/my-project"])
    is_global: bool = Field(description="Whether this is a global project (home directory)")
    component_count: int = Field(description="Total number of components in this project")
    last_scanned_at: str = Field(description="Last scan time (ISO 8601)", examples=["2026-02-15T09:30:00Z"])
    hidden_at: str | None = Field(default=None, description="Hidden time (ISO 8601). null means active project")
    dir_exists: bool = Field(description="Whether the project directory actually exists on the filesystem")
    platforms: list[str] = Field(description="List of detected AI platforms", examples=[["claude_code", "cursor"]])


class ProjectDetailResponse(ProjectResponse):
    """Project detail — includes component count by type."""

    breakdown: dict[str, int] = Field(
        description="Component count by type",
        examples=[{"skill": 5, "agent": 2, "hook": 3, "command": 1, "rule": 4}],
    )


class ProjectCreateRequest(BaseModel):
    """Preset-based project creation request."""

    path: str = Field(description="Absolute path for the project to create", examples=["/Users/dev/projects/new-app"])
    preset_id: str = Field(description="Project preset ID to apply", examples=["preset-react-fastapi"])
    revision: int | None = Field(None, ge=1, description="Preset revision to apply (latest if omitted)")
    conflict_policy: Literal["fail", "skip", "rename", "overwrite"] = Field(
        "fail",
        description="Conflict policy (default fail)",
    )
    name: str | None = Field(None, description="Project name (uses path basename if omitted)")
    scan_after_create: bool = Field(True, description="Whether to run rescan immediately after creation")

    @field_validator("path")
    @classmethod
    def validate_absolute_path(cls, value: str) -> str:
        expanded = str(Path(value).expanduser())
        if not Path(expanded).is_absolute():
            raise ValueError("Project path must be absolute")
        if ".." in Path(expanded).parts:
            raise ValueError("Project path must not contain path traversal ('..')")
        return expanded


class AppliedPresetResponse(BaseModel):
    """Applied preset info in project creation response."""

    id: str = Field(description="Preset ID")
    name: str = Field(description="Preset name")
    version: int = Field(description="Preset version")
    revision: int = Field(description="Applied preset revision")


class ProjectCreateResponse(BaseModel):
    """Preset-based project creation response."""

    project: ProjectResponse = Field(description="Created project summary")
    applied_preset: AppliedPresetResponse = Field(description="Applied preset meta info")
    created_components: int = Field(description="Number of components created by preset")
    scanned_components: int = Field(description="Number of components counted by post-creation scan")


ProjectTemplateScope = Literal["system", "user"]
ProjectPresetType = Literal["template", "snapshot"]
ConflictPolicy = Literal["fail", "skip", "rename", "overwrite"]


class ProjectTemplateComponentBlueprint(BaseModel):
    """Project preset revision item."""

    component_type: Literal["skill", "agent", "command", "hook", "rule"] = Field(description="Component type")
    template_id: str | None = Field(None, description="Component Wizard template ID (for template preset)")
    name: str = Field(description="Component name to be created", min_length=1, max_length=200)
    description: str | None = Field(None, description="Description override on creation")
    platform: Literal["claude_code", "cursor"] = Field(description="Target platform")
    config: dict[str, object] = Field(default_factory=dict, description="Template variables")
    content: str | None = Field(None, description="Snapshot body (for snapshot preset)")
    frontmatter: dict | None = Field(default=None, description="Snapshot frontmatter")
    tags: list[str] = Field(default_factory=list, description="Snapshot item tags")
    source_component_id: str | None = Field(None, description="Source component id (for snapshot tracking)")
    order_index: int | None = Field(default=None, description="Sort order within revision")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_component_name(value)


class ProjectTemplateCreateRequest(BaseModel):
    """Project preset creation request."""

    name: str = Field(description="Preset name", min_length=1, max_length=120)
    description: str = Field(description="Preset description", min_length=1)
    tags: list[str] = Field(default_factory=list, description="Tag list")
    preset_type: ProjectPresetType = Field("template", description="Preset type")
    components: list[ProjectTemplateComponentBlueprint] = Field(description="Component blueprint list")
    change_note: str | None = Field(None, description="Revision change note")

    @field_validator("tags", mode="before")
    @classmethod
    def deduplicate_tags(cls, value: list[str] | None) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return list(dict.fromkeys(value))
        return []

    @field_validator("components")
    @classmethod
    def validate_components_non_empty(
        cls,
        value: list[ProjectTemplateComponentBlueprint],
    ) -> list[ProjectTemplateComponentBlueprint]:
        if len(value) == 0:
            raise ValueError("At least one component blueprint is required")
        return value


class ProjectTemplateUpdateRequest(ProjectTemplateCreateRequest):
    """Project preset update request (full replacement)."""


class ProjectTemplateSummaryResponse(BaseModel):
    """Project preset summary."""

    id: str = Field(description="Preset ID")
    name: str = Field(description="Preset name")
    description: str = Field(description="Preset description")
    scope: ProjectTemplateScope = Field(description="Preset scope (system=user editable or not)")
    preset_type: ProjectPresetType = Field(description="Preset type")
    version: int = Field(description="Preset version")
    latest_revision: int = Field(description="Latest revision number")
    revisions_count: int = Field(description="Total revision count")
    component_count: int = Field(description="Preset component count")
    tags: list[str] = Field(default_factory=list, description="Tag list")
    created_at: str = Field(description="Created at (ISO 8601)")
    updated_at: str = Field(description="Updated at (ISO 8601)")


class ProjectTemplateResponse(ProjectTemplateSummaryResponse):
    """Project preset detail."""

    components: list[ProjectTemplateComponentBlueprint] = Field(description="Component blueprint list")


class ProjectTemplateListResponse(BaseModel):
    """Project preset list response."""

    items: list[ProjectTemplateSummaryResponse] = Field(description="Preset list")
    total: int = Field(description="Total count")


class ProjectTemplateFromProjectRequest(BaseModel):
    """Snapshot preset creation request based on project component selection."""

    source_project_id: str = Field(description="Source project ID")
    name: str = Field(description="Preset name", min_length=1, max_length=120)
    description: str = Field(description="Preset description", min_length=1)
    tags: list[str] = Field(default_factory=list, description="Preset tags")
    component_ids: list[str] = Field(description="List of component ids to save")
    include_disabled: bool = Field(False, description="Whether to include disabled components")
    conflict_if_name_exists: bool = Field(True, description="Whether to return 409 on name conflict")

    @field_validator("component_ids")
    @classmethod
    def validate_component_ids_non_empty(cls, value: list[str]) -> list[str]:
        normalized = [component_id.strip() for component_id in value if component_id.strip()]
        if not normalized:
            raise ValueError("At least one component_id is required")
        return normalized


class ProjectTemplateRevisionSummaryResponse(BaseModel):
    """Preset revision summary."""

    revision: int = Field(description="Revision number")
    preset_type: ProjectPresetType = Field(description="revision preset type")
    created_at: str = Field(description="Created at")
    created_by: str | None = Field(default=None, description="Creator identifier")
    change_note: str = Field(description="Change note")
    item_count: int = Field(description="Revision item count")


class ProjectTemplateRevisionListResponse(BaseModel):
    """Preset revision list response."""

    items: list[ProjectTemplateRevisionSummaryResponse] = Field(description="Revision list")
    total: int = Field(description="Total count")


class ProjectTemplateRevisionResponse(ProjectTemplateRevisionSummaryResponse):
    """Preset revision detail response."""

    template_id: str = Field(description="Preset ID")
    items: list[ProjectTemplateComponentBlueprint] = Field(description="Revision component list")


class PresetPreviewRequest(BaseModel):
    """Preview request before applying preset."""

    preset_id: str = Field(description="Preset ID")
    revision: int | None = Field(None, ge=1, description="Preview target revision")
    conflict_policy: ConflictPolicy = Field("fail", description="Conflict policy")


class PresetPreviewSummary(BaseModel):
    """Preset preview summary."""

    to_create: int = Field(description="Number to create")
    to_update: int = Field(description="Number to update")
    to_skip: int = Field(description="Number to skip")
    to_rename: int = Field(description="Number to rename")
    conflicts: int = Field(description="Number of conflicts")


class PresetPreviewItem(BaseModel):
    """Preset preview item."""

    name: str = Field(description="Component name")
    type: Literal["skill", "agent", "command", "hook", "rule"] = Field(description="Component type")
    platform: Literal["claude_code", "cursor"] = Field(description="Platform")
    action: Literal["create", "update", "skip", "rename", "conflict"] = Field(description="Expected action")
    reason: str = Field(description="Action reason")
    target_component_id: str | None = Field(default=None, description="Conflicting target component id")
    renamed_to: str | None = Field(default=None, description="Final name under rename policy")


class PresetPreviewResponse(BaseModel):
    """Preset preview response."""

    project_id: str = Field(description="Target project ID")
    preset_id: str = Field(description="Preset ID")
    revision: int = Field(description="Target revision")
    policy: ConflictPolicy = Field(description="Applied conflict policy")
    summary: PresetPreviewSummary = Field(description="Summary")
    items: list[PresetPreviewItem] = Field(description="Per-item results")
    last_policy: ConflictPolicy | None = Field(default=None, description="Previous policy for this project")


class PresetApplyRequest(BaseModel):
    """Preset apply request."""

    preset_id: str = Field(description="Preset ID")
    revision: int | None = Field(None, ge=1, description="Target revision to apply")
    conflict_policy: ConflictPolicy = Field("fail", description="Conflict policy")


class PresetApplySummary(BaseModel):
    """Preset apply result summary."""

    created: int = Field(description="Number created")
    updated: int = Field(description="Number updated")
    skipped: int = Field(description="Number skipped")
    renamed: int = Field(description="Number renamed")
    failed: int = Field(description="Number failed")


class PresetApplyResponse(BaseModel):
    """Preset apply response."""

    project_id: str = Field(description="Target project ID")
    preset_id: str = Field(description="Preset ID")
    revision: int = Field(description="Applied revision")
    policy: ConflictPolicy = Field(description="Conflict policy")
    summary: PresetApplySummary = Field(description="Summary")
    items: list[PresetPreviewItem] = Field(description="Per-item processing results")


ActivityType = Literal["component_created", "component_updated", "component_deleted", "preset_applied"]


class ActivityResponse(BaseModel):
    """Per-project activity log entry (Issue #216)."""

    id: str = Field(description="Unique activity log ID (UUID)")
    activity_type: ActivityType = Field(
        description="Activity type",
        examples=["component_created", "component_updated", "component_deleted"],
    )
    component_id: str | None = Field(
        None,
        description="Related component ID (preserved even if deleted)",
    )
    component_name: str = Field(description="Component name")
    component_type: str = Field(
        description="Component type",
        examples=["skill", "agent", "command", "hook", "rule"],
    )
    created_at: str = Field(description="Activity occurrence time (ISO 8601)")


class ComponentResponse(BaseModel):
    """Component summary."""

    id: str = Field(description="Unique component ID (UUID)")
    type: str = Field(description="Component type", examples=["skill", "agent", "command", "hook", "rule"])
    name: str = Field(description="Component name", examples=["commit-helper"])
    description: str | None = Field(None, description="Component description (extracted from frontmatter)")
    enabled: bool = Field(description="Enabled state — if false, not used by AI agents")
    tags: list[str] = Field(description="User-defined tag list", examples=[["git", "automation"]])
    project_id: str = Field(description="Parent project ID (UUID)")
    path: str = Field(description="Relative path within the project", examples=["/skills/commit-helper"])
    created_at: str = Field(description="Created at (ISO 8601)")
    updated_at: str = Field(description="Last modified time (ISO 8601)")
    platform: str = Field(description="AI platform", examples=["claude_code", "cursor"])
    last_used: str | None = Field(None, description="Last used time (ISO 8601, based on Usage Tracking)")


class PaginatedComponentsResponse(BaseModel):
    """Paginated component list response."""

    items: list[ComponentResponse] = Field(description="Component list for the current page")
    total: int = Field(description="Total component count after filtering (before pagination)")


class ComponentSearchResponse(ComponentResponse):
    """Component search response — includes parent project name."""

    project_name: str = Field(description="Parent project name")


class TrashItemResponse(ComponentSearchResponse):
    """Trash item response — includes deleted_at."""

    deleted_at: str = Field(description="Time moved to trash (ISO 8601)")


class ConflictResponse(BaseModel):
    """Conflict item response (Issue #164) — global vs project components with the same name."""

    id: str = Field(description="Conflict ID (global_id|project_id)")
    name: str = Field(description="Component name")
    type: str = Field(description="Component type", examples=["skill", "agent", "command", "hook", "rule"])
    global_component_id: str = Field(description="Global component ID")
    project_component_id: str = Field(description="Project component ID")
    project_name: str = Field(description="Project name")
    priority: str = Field(description="Priority", examples=["project"])
    is_intentional: bool = Field(description="Whether intentionally overridden (ignored)")


class ConflictResolveRequest(BaseModel):
    """Conflict resolution request."""

    action: Literal["disable_global", "delete_project", "rename", "ignore"] = Field(
        description="Resolution action", examples=["disable_global", "ignore", "rename"]
    )
    new_name: str | None = Field(None, description="New name for rename")
    target: Literal["global", "project"] | None = Field(None, description="Target for rename (global | project)")


class ConflictResolveResponse(BaseModel):
    """Conflict resolution response."""

    success: bool = Field(description="Whether successful")
    conflict_id: str = Field(description="Conflict ID")
    updated_component_ids: list[str] = Field(default_factory=list, description="List of changed component IDs")


class DependencyItem(BaseModel):
    """Target component info in a dependency relation."""

    id: str = Field(description="Target component ID (UUID)")
    name: str = Field(description="Target component name")
    type: str = Field(description="Target component type", examples=["skill", "hook"])


class DependencyInfo(BaseModel):
    """Bidirectional dependency info for a component."""

    depends_on: list[DependencyItem] = Field(description="Other components this component depends on")
    depended_by: list[DependencyItem] = Field(description="Other components that depend on this component")


class ComponentDetailResponse(BaseModel):
    """Component detail — includes body, frontmatter, and dependencies."""

    id: str = Field(description="Unique component ID (UUID)")
    type: str = Field(description="Component type", examples=["skill"])
    name: str = Field(description="Component name")
    description: str | None = Field(None, description="Component description")
    enabled: bool = Field(description="Enabled state")
    tags: list[str] = Field(description="Tag list")
    project_id: str = Field(description="Parent project ID (UUID)")
    project_name: str = Field(description="Parent project name")
    path: str = Field(description="Relative path within the project")
    content: str | None = Field(None, description="Full component body text (markdown, YAML, etc.)")
    frontmatter: dict | None = Field(
        None,
        description="Metadata parsed from YAML frontmatter",
        examples=[{"name": "commit-helper", "description": "Git commit automation Skill"}],
    )
    dependencies: DependencyInfo = Field(description="Bidirectional dependency info")
    created_at: str = Field(description="Created at (ISO 8601)")
    updated_at: str = Field(description="Last modified time (ISO 8601)")
    platform: str = Field(description="AI platform")


class ComponentCreateRequest(BaseModel):
    """Component creation request."""

    type: Literal["skill", "agent", "command", "hook", "rule"] = Field(
        description="Component type", examples=["skill", "agent", "command", "hook", "rule"]
    )
    name: str = Field(
        description="Component name (unique within project, no path separators)",
        examples=["commit-helper"],
        min_length=1,
        max_length=200,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_component_name(v)

    @field_validator("tags", mode="before")
    @classmethod
    def deduplicate_tags(cls, v: list[str] | None) -> list[str] | None:
        """Issue #334: auto-deduplicate tags (prevent UNIQUE constraint violation)."""
        if v is None:
            return None
        if isinstance(v, list):
            return list(dict.fromkeys(v))  # Deduplicate while preserving order
        return v

    project_id: str = Field(description="Project ID to assign to (UUID)")
    content: str = Field(
        description="Component body — may include YAML frontmatter",
        examples=[
            (
                "---\nname: commit-helper\ndescription: Git commit automation\n---\n"
                "Automatically generates commit messages."
            )
        ],
    )
    tags: list[str] | None = Field(None, description="Tag list (optional)", examples=[["git", "automation"]])
    platform: Literal["claude_code", "cursor"] = Field(description="AI platform", examples=["claude_code", "cursor"])


class ComponentUpdateRequest(BaseModel):
    """Component update request — null fields are not changed."""

    name: str | None = Field(None, description="New name (unchanged if null)")
    description: str | None = Field(None, description="New description (unchanged if null)")
    content: str | None = Field(None, description="New body text (unchanged if null)")
    tags: list[str] | None = Field(
        None, description="New tag list (unchanged if null, empty array removes all tags)"
    )

    @field_validator("tags", mode="before")
    @classmethod
    def deduplicate_tags(cls, v: list[str] | None) -> list[str] | None:
        """Issue #334: auto-deduplicate tags (prevent UNIQUE constraint violation)."""
        if v is None:
            return None
        if isinstance(v, list):
            return list(dict.fromkeys(v))  # Deduplicate while preserving order
        return v


class ComponentDeleteResponse(BaseModel):
    """Component delete response."""

    message: str = Field(description="Deletion confirmation message (i18n applied)", examples=["Deleted"])
    message_key: str | None = Field(
        None,
        description="i18n key (for frontend multilingual display). Issue #223",
    )
    affected_dependencies: list[DependencyItem] = Field(
        description="Components with broken dependencies due to deletion (those that depended on this)"
    )


class ComponentToggleRequest(BaseModel):
    """Component enable/disable request."""

    enabled: bool | None = Field(
        None,
        description="Enabled state to set. If null or omitted, toggles current state",
    )


class ComponentToggleResponse(BaseModel):
    """Component enable/disable response."""

    id: str = Field(description="Component ID (UUID)")
    enabled: bool = Field(description="Changed enabled state")
    affected_dependencies: list[DependencyItem] = Field(
        description="Other components that depend on this one (for understanding impact scope when disabling)"
    )


class BulkToggleRequest(BaseModel):
    """Bulk toggle request."""

    component_ids: list[str] = Field(description="List of component IDs to toggle", min_length=1)
    enabled: bool = Field(description="Enabled state to set")


class BulkToggleResponse(BaseModel):
    """Bulk toggle response."""

    updated_count: int = Field(description="Number of components whose state actually changed")
    updated_ids: list[str] = Field(description="List of component IDs whose state changed")


class ComponentCopyRequest(BaseModel):
    """Component copy request."""

    target_project_id: str = Field(description="Target project ID for copy (UUID)")
    include_dependencies: bool = Field(
        False,
        description="If true, also copy other components this one depends on",
    )


class ComponentCopyItem(BaseModel):
    """Individual copy result item — original to copy mapping."""

    original_id: str = Field(description="Original component ID")
    new_id: str = Field(description="Copied new component ID")
    name: str = Field(description="Component name")
    type: str = Field(description="Component type")


# Component Wizard API schemas


class ComponentGenerateRequest(BaseModel):
    """Component Wizard — component generation (preview) request."""

    component_type: Literal["skill", "agent", "command", "hook", "rule"] = Field(
        description="Component type", examples=["skill", "agent", "command", "hook", "rule"]
    )
    template_id: str = Field(description="Template ID to use", examples=["python-dev", "code-reviewer"])
    name: str = Field(
        description="Component name",
        examples=["my-pytest-helper"],
        min_length=1,
        max_length=200,
    )
    description: str | None = Field(None, description="Component description")
    config: dict[str, object] = Field(
        default_factory=dict,
        description="Template variables (form field values)",
        examples=[{"skill_name": "my-pytest-helper", "tools": ["read", "write"]}],
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_component_name(v)


class ComponentGenerateResponse(BaseModel):
    """Component Wizard — component generation (preview) response."""

    content: str = Field(description="Full body generated from template (frontmatter + body)")
    preview_id: str = Field(description="Preview identifier ID (for temporary session)", examples=["preview-abc123"])
    expires_at: str = Field(
        description="Preview expiration time (ISO 8601)",
        examples=["2026-02-16T12:00:00Z"],
    )
    component_type: str = Field(
        description="Component type",
        examples=["skill", "agent", "command", "hook", "rule"],
    )
    file_name: str = Field(description="File name for saving", examples=["SKILL.md", "AGENT.md"])


class ComponentSaveRequest(BaseModel):
    """Component Wizard — save generated component request."""

    type: Literal["skill", "agent", "command", "hook", "rule"] = Field(
        description="Component type", examples=["skill", "agent", "command", "hook", "rule"]
    )
    name: str = Field(
        description="Component name",
        examples=["my-pytest-helper"],
        min_length=1,
        max_length=200,
    )
    project_id: str = Field(description="Project ID to save to (UUID)")
    content: str = Field(
        description="Body to save (frontmatter + body)",
        examples=["---\nname: my-pytest-helper\ndescription: ...\n---\nBody content"],
    )
    tags: list[str] | None = Field(None, description="Tag list", examples=[["python", "testing"]])
    platform: Literal["claude_code", "cursor"] = Field(description="AI platform", examples=["claude_code", "cursor"])

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_component_name(v)

    @field_validator("tags", mode="before")
    @classmethod
    def deduplicate_tags(cls, v: list[str] | None) -> list[str] | None:
        """Issue #334: auto-deduplicate tags."""
        if v is None:
            return None
        if isinstance(v, list):
            return list(dict.fromkeys(v))
        return v


class ComponentCopyResponse(BaseModel):
    """Component copy response."""

    copied: list[ComponentCopyItem] = Field(
        description="Copied component list (may contain multiple items when include_dependencies=true)"
    )


# Version History API schemas (Section 3. Versions)


class VersionHistoryItem(BaseModel):
    """Version history item — GET /api/components/{id}/versions response."""

    version: int = Field(description="Version number")
    content: str = Field(description="Component body of this version")
    created_at: str = Field(description="Saved at (ISO 8601)", examples=["2026-02-09T16:30:00Z"])


class RollbackRequest(BaseModel):
    """Version rollback request — POST /api/components/{id}/rollback."""

    version: int = Field(description="Version number to roll back to", examples=[1])


class RollbackResponse(BaseModel):
    """Version rollback response."""

    id: str = Field(description="Component ID (UUID)")
    restored_version: int = Field(description="Restored version number")
    new_version: int = Field(description="New version number backing up the current content before rollback")
    message: str = Field(description="Rollback completion message (i18n applied)")


class ScanRequest(BaseModel):
    """Filesystem scan request — scan mode determined by field combination."""

    home_path: str | None = Field(
        None,
        description="Global project (home directory) path. Replaces existing global project when specified",
        examples=["/Users/dev"],
    )
    root_path: str | None = Field(
        None,
        description="Project discovery root path. Auto-discovers and registers projects under this",
        examples=["/Users/dev/projects"],
    )
    project_id: str | None = Field(
        None,
        description="Project ID (UUID) for rescanning a specific project only",
    )


class ScanResponse(BaseModel):
    """Filesystem scan result — async scan start response."""

    status: str = Field(description="Scan status: 'started' or 'already_running'")
    scanned_projects: int = Field(0, description="Number of projects to scan (estimated)")
    total_components: int = Field(0, description="Total discovered components (0 since async)")
    message: str = Field("", description="Status message")


# Dashboard schemas


class TrendInfo(BaseModel):
    """Trend for a specific component type."""

    value: int = Field(description="Change amount (absolute)", examples=[3])
    percentage: float = Field(description="Change percentage", examples=[15.5])
    direction: str = Field(description="Change direction: 'up', 'down', 'neutral'", examples=["up"])


class DashboardStatsResponse(BaseModel):
    """Dashboard overall stats — count by type + enabled status + trends."""

    total_skills: int = Field(description="Total Skill component count")
    total_agents: int = Field(description="Total Agent component count")
    total_commands: int = Field(description="Total Command component count")
    total_hooks: int = Field(description="Total Hook component count")
    total_rules: int = Field(description="Total Rule component count")
    active_count: int = Field(description="Active (enabled=true) component count")
    inactive_count: int = Field(description="Inactive (enabled=false) component count")
    total_count: int = Field(description="Total component count")
    trends: dict[str, TrendInfo] = Field(
        description="Trend info by type (keys: skills, agents, commands, hooks, rules)"
    )


class ActiveWorkersResponse(BaseModel):
    """Background worker status."""

    watcher: bool = Field(description="Whether FileWatcher is running")
    usage_scanner: bool = Field(description="Whether UsageScanner is running")


class SystemStatusResponse(BaseModel):
    """System status — scan status and health."""

    is_live: bool = Field(description="Whether API server is operating normally (always true on response, #810)")
    last_scan_at: str = Field(description="Last scan time (ISO 8601)", examples=["2026-02-15T09:30:00Z"])
    active_workers: ActiveWorkersResponse = Field(description="Background worker status")
    health_score: int = Field(description="System health (0~100). Percentage of scanned projects", ge=0, le=100)


# Dependencies API schemas


class GraphNode(BaseModel):
    """Dependency graph node — represents a component."""

    id: str = Field(description="Component ID (UUID)")
    name: str = Field(description="Component name")
    type: str = Field(
        description="Component type",
        examples=["skill", "agent", "command", "hook", "rule"],
    )
    project_id: str = Field(description="Parent project ID")
    enabled: bool = Field(description="Enabled state")
    platform: str = Field(description="Platform (claude_code, cursor)")


class GraphEdge(BaseModel):
    """Dependency graph edge — source depends on target."""

    source: str = Field(description="Dependent component ID (source)")
    target: str = Field(description="Dependency target component ID (target)")
    type: str = Field(
        description="Dependency type",
        examples=["context", "body_reference"],
    )
    is_broken: bool = Field(
        default=False,
        description="Whether the reference is broken (target component deleted or does not exist)",
    )


class GraphData(BaseModel):
    """Full dependency graph data — for frontend visualization."""

    nodes: list[GraphNode] = Field(description="Graph node list")
    edges: list[GraphEdge] = Field(description="Graph edge list (source -> target)")
    cycles: list[list[str]] = Field(
        description="Node ID path list when circular references are detected",
        examples=[[]],
    )


class DependencyDetailItem(BaseModel):
    """Dependency detail item for a specific component — includes dependency_type."""

    id: str = Field(description="Component ID")
    name: str = Field(description="Component name")
    type: str = Field(
        description="Component type",
        examples=["skill", "agent", "command", "hook", "rule"],
    )
    dependency_type: str = Field(
        description="Dependency type",
        examples=["context", "body_reference"],
    )
    is_broken: bool = Field(
        default=False,
        description="Whether the reference is broken",
    )


class DependencyDetailResponse(BaseModel):
    """Dependency detail for a specific component — depends_on, depended_by."""

    component_id: str = Field(description="Target component ID for query")
    depends_on: list[DependencyDetailItem] = Field(description="Other components this component depends on")
    depended_by: list[DependencyDetailItem] = Field(description="Other components that reference this one")


# Templates API schemas


class TemplateFieldValidation(BaseModel):
    """Template field validation rules."""

    pattern: str | None = Field(None, description="Regex pattern")
    message: str | None = Field(None, description="Message on validation failure")
    min_length: int | None = Field(None, description="Minimum length")
    max_length: int | None = Field(None, description="Maximum length")


class TemplateField(BaseModel):
    """Template field definition — for BasicInfoStep dynamic form rendering."""

    name: str = Field(description="Field name (unique identifier)")
    label: str = Field(description="Field label (for UI display)")
    type: str = Field(
        description="Field type",
        examples=["text", "textarea", "select", "multiselect", "checkbox", "number"],
    )
    required: bool = Field(description="Whether required")
    placeholder: str | None = Field(None, description="Placeholder text")
    options: list[str] | None = Field(None, description="select/multiselect option list")
    default: str | list[str] | bool | int | None = Field(None, description="Default value")
    help_text: str | None = Field(None, description="Help text")
    validation: TemplateFieldValidation | None = Field(None, description="Validation rules")


class TemplateResponse(BaseModel):
    """Template detail."""

    id: str = Field(description="Unique template ID")
    name: str = Field(description="Template name")
    description: str = Field(description="Template description")
    component_type: str = Field(
        description="Component type",
        examples=["skill", "agent", "command", "hook", "rule"],
    )
    category: str = Field(description="Category", examples=["development", "code-quality"])
    icon: str = Field(description="Icon identifier", examples=["python", "react"])
    difficulty: str = Field(
        description="Difficulty",
        examples=["beginner", "intermediate", "advanced"],
    )
    estimated_time: str = Field(description="Estimated time", examples=["2 min", "5 min"])
    fields: list[TemplateField] = Field(description="Dynamic form field definition list")
    tags: list[str] = Field(description="Tag list", examples=[["python", "testing"]])


class TemplatesListResponse(BaseModel):
    """Template list response."""

    templates: list[TemplateResponse] = Field(description="Template list")
    total: int = Field(description="Total template count")


# Context Optimization Schemas


class ComponentTokenInfo(BaseModel):
    """Per-component token usage info."""

    id: str = Field(description="Component ID")
    name: str = Field(description="Component name")
    type: str = Field(description="Component type", examples=["skill", "agent", "command"])
    estimated_tokens: int = Field(description="Estimated token count (based on file size)")
    file_size_bytes: int = Field(description="File size (bytes)")


class OptimizationSuggestion(BaseModel):
    """Context optimization suggestion."""

    type: Literal["oversized", "tech_mismatch", "global_overuse", "duplicate"] = Field(description="Suggestion type")
    component_id: str = Field(description="Target component ID")
    component_name: str = Field(description="Component name")
    reason: str = Field(description="Suggestion reason", examples=["5000+ tokens — split recommended"])
    action: Literal["split", "disable", "move", "merge"] = Field(description="Recommended action")
    priority: Literal["high", "medium", "low"] = Field(description="Priority")
    similarity_score: float | None = Field(None, description="Similarity score on duplicate detection (0.0~1.0)")


# Context Stats


class TierStats(BaseModel):
    """Per-tier token statistics."""

    name: str = Field(description="Tier name", examples=["always", "catalog", "on_demand"])
    label: str = Field(description="Label for UI display", examples=["Always loaded"])
    description: str = Field(description="Tier description")
    components: list[ComponentTokenInfo] = Field(description="Component list")
    total_tokens: int = Field(description="Tier total token count")
    count: int = Field(description="Component count")
    counts_toward_limit: bool = Field(description="Whether included in effective_tokens calculation")


class PlatformContextStats(BaseModel):
    """Per-platform context statistics."""

    platform: str = Field(description="Platform identifier", examples=["claude_code", "cursor"])
    tiers: list[TierStats] = Field(description="Per-tier statistics")
    recommended_max_tokens: int = Field(description="Recommended max token count")
    effective_tokens: int = Field(description="Effective token count (sum of counts_toward_limit=True)")
    status: Literal["ok", "warning", "critical"] = Field(description="Status")


class ContextStatsResponse(BaseModel):
    """Context optimization statistics response."""

    platforms: list[PlatformContextStats] = Field(description="Per-platform statistics")
    suggestions: list[OptimizationSuggestion] = Field(description="Optimization suggestion list")


# License (Issue #79)


PlanType = Literal["free", "pro", "team"]


class LicenseValidateRequest(BaseModel):
    """License key validation request."""

    key: str = Field(description="License key (VS-XXXX-XXXX-XXXX-XXXX format)")


class LicenseResponse(BaseModel):
    """License validation/query response."""

    valid: bool = Field(description="Whether the license is valid")
    plan: PlanType = Field(description="Plan type (free, pro, team)")
    expires_at: datetime | None = Field(None, description="Expiration date (for subscription plans)")


# Usage Tracking (Issue #67)


class UsageRankingItem(BaseModel):
    """Usage ranking item."""

    component_id: str | None = Field(None, description="Component ID (null on matching failure)")
    component_name: str = Field(description="Component name")
    component_type: str = Field(description="Component type (skill, agent, hook)")
    use_count: int = Field(description="Use count")
    time_qualified_count: int = Field(description="Use count with time info for time-based metrics")
    count_only_count: int = Field(description="Use count without time info, only for count metrics")


class UsageUnusedItem(BaseModel):
    """Unused component item."""

    component_name: str = Field(description="Component name")
    component_type: str = Field(description="Component type")
    created_at: str = Field(description="Component creation time (ISO 8601)")


class UsageResponse(BaseModel):
    """Usage stats response."""

    ranking: list[UsageRankingItem] = Field(description="Sorted by use count descending")
    unused: list[UsageUnusedItem] = Field(description="Components never used")
    total_sessions_parsed: int = Field(description="Total sessions parsed")
    last_parsed_at: str | None = Field(None, description="Last parsed time (ISO 8601)")
    aggregation_mode: Literal["strict", "expanded"] = Field(
        description="Applied aggregation mode (strict=high confidence, expanded=includes fallback)"
    )
    dedupe_by_session: str = Field(description="Aggregation mode (auto/true/false)")
    matched_only: bool = Field(description="Whether only items matched by component_id are included")


class UsageScanResponse(BaseModel):
    """Manual scan trigger response."""

    sessions_parsed: int = Field(description="Number of sessions parsed in this scan")
    stats_saved: int = Field(description="Number of saved usage stats")


class UsageResetResponse(BaseModel):
    """Usage data reset response."""

    deleted_sessions: int = Field(description="Number of deleted sessions (file exists only)")
    deleted_parse_states: int = Field(description="Number of deleted parse states")
    preserved_sessions: int = Field(description="Number of preserved sessions (file deleted)")
    preserved_parse_states: int = Field(description="Number of preserved parse states")


class UsageTimelineEntry(BaseModel):
    """Timeline entry."""

    date: str = Field(description="Date (days>=1: YYYY-MM-DD, days=0: ISO 8601)")
    count: int = Field(description="Use count for the period")
    intensity: float = Field(description="count / max(count) normalized (0.0~1.0)")


class UsageComponentTimelineResponse(BaseModel):
    """Per-component usage trend response."""

    component_id: str = Field(description="Queried component ID (UUID)")
    component_name: str = Field(description="Queried component name")
    timeline: list[UsageTimelineEntry] = Field(description="Usage trend by time period")


class CheckoutRequest(BaseModel):
    """Stripe Checkout Session creation request."""

    plan: PlanType = Field(description="Subscription plan (pro, team)")
    email: EmailStr = Field(description="Email for payment")


# Backup (Issue #84)


class BackupItemResponse(BaseModel):
    """Backup metadata response."""

    id: str = Field(description="Backup ID (UUID)")
    version: str = Field(description="Backup format version")
    size_bytes: int = Field(description="Backup file size (bytes)")
    checksum: str = Field(description="Backup integrity checksum (SHA-256)")
    created_at: str = Field(description="Backup creation time (ISO 8601)")


class BackupDetailResponse(BackupItemResponse):
    """Backup detail response (includes payload)."""

    payload: dict = Field(description="Backup file content")


class BackupRestoreRequest(BaseModel):
    """Backup restore request."""

    backup_id: str = Field(description="Backup ID to restore")


class BackupRestoreResponse(BaseModel):
    """Backup restore result response."""

    restored_projects: int = Field(description="Number of restored projects")
    restored_components: int = Field(description="Number of restored components")
    restored_tags: int = Field(description="Number of restored tags")
    restored_dependencies: int = Field(description="Number of restored dependencies")
    restored_versions: int = Field(description="Number of restored version records")
