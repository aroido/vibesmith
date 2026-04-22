"""Pydantic schemas for Preset/Collection V1 APIs."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

PresetScope = Literal["system", "user"]
PresetComponentType = Literal["skill", "agent", "command", "hook", "rule"]
PresetPlatform = Literal["claude_code", "cursor"]
PinMode = Literal["pin", "latest"]
ConflictPolicy = Literal["fail", "skip", "rename", "overwrite"]


def _validate_entity_name(name: str) -> str:
    if not name or not name.strip():
        raise ValueError("Name cannot be empty")
    if ".." in name or "/" in name or "\\" in name:
        raise ValueError("Name must not contain path traversal ('..') or path separators ('/', '\\')")
    if len(name) > 200:
        raise ValueError("Name must be at most 200 characters")
    return name.strip()


class PresetCreateRequest(BaseModel):
    """Create Preset request."""

    name: str = Field(description="Preset name", min_length=1, max_length=200)
    component_type: PresetComponentType = Field(description="Component type")
    platform: PresetPlatform = Field(description="Target platform")
    description: str = Field(default="", description="Preset description")
    scope: PresetScope = Field(default="user", description="Preset scope")
    tags: list[str] = Field(default_factory=list, description="Preset tags")
    content: str = Field(description="Preset content")
    frontmatter: dict | None = Field(default=None, description="Frontmatter object")
    change_note: str | None = Field(default=None, description="Revision change note")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_entity_name(value)


class PresetUpdateRequest(PresetCreateRequest):
    """Update Preset request (immutable revision append)."""


class PresetFromProjectRequest(BaseModel):
    """Create Preset from project component request."""

    source_project_id: str = Field(description="Source project id")
    component_id: str = Field(description="Source component id")
    name: str = Field(description="Preset name", min_length=1, max_length=200)
    description: str | None = Field(default=None, description="Override description")
    tags: list[str] = Field(default_factory=list, description="Preset tags")
    include_disabled: bool = Field(default=False, description="Include disabled component")
    conflict_if_name_exists: bool = Field(default=True, description="Raise conflict on name exists")
    scope: PresetScope = Field(default="user", description="Preset scope")

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_entity_name(value)


class PresetSummaryResponse(BaseModel):
    """Preset summary response."""

    id: str
    name: str
    component_type: PresetComponentType
    platform: PresetPlatform
    description: str
    scope: PresetScope
    tags: list[str] = Field(default_factory=list)
    latest_revision: int
    revisions_count: int
    created_at: str
    updated_at: str


class PresetResponse(PresetSummaryResponse):
    """Preset detail response (latest revision metadata)."""


class PresetListResponse(BaseModel):
    """Preset list response."""

    items: list[PresetSummaryResponse]
    total: int


class PresetRevisionSummaryResponse(BaseModel):
    """Preset revision summary."""

    revision: int
    created_at: str
    created_by: str | None = None
    change_note: str
    content_hash: str


class PresetRevisionResponse(PresetRevisionSummaryResponse):
    """Preset revision detail response."""

    preset_id: str
    content: str
    frontmatter: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class PresetRevisionListResponse(BaseModel):
    """Preset revision list response."""

    items: list[PresetRevisionSummaryResponse]
    total: int


class CollectionItemInput(BaseModel):
    """Collection item input."""

    preset_id: str
    order_index: int | None = None
    pin_mode: PinMode = "pin"
    pinned_revision: int | None = Field(default=None, ge=1)
    alias_name: str | None = Field(default=None, max_length=200)


class CollectionCreateRequest(BaseModel):
    """Create Collection request."""

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="")
    scope: PresetScope = Field(default="user")
    tags: list[str] = Field(default_factory=list)
    items: list[CollectionItemInput]
    change_note: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _validate_entity_name(value)

    @field_validator("items")
    @classmethod
    def validate_items_non_empty(cls, value: list[CollectionItemInput]) -> list[CollectionItemInput]:
        if not value:
            raise ValueError("At least one collection item is required")
        return value


class CollectionUpdateRequest(CollectionCreateRequest):
    """Update Collection request (immutable revision append)."""


class CollectionItemResolvedResponse(BaseModel):
    """Resolved collection item response."""

    order_index: int
    preset_id: str
    pin_mode: PinMode
    pinned_revision: int | None = None
    resolved_revision: int
    alias_name: str | None = None
    preset_name: str | None = None


class CollectionSummaryResponse(BaseModel):
    """Collection summary response."""

    id: str
    name: str
    description: str
    scope: PresetScope
    tags: list[str] = Field(default_factory=list)
    latest_revision: int
    revisions_count: int
    items_count: int
    created_at: str
    updated_at: str


class CollectionResponse(CollectionSummaryResponse):
    """Collection detail response (latest revision items)."""

    items: list[CollectionItemResolvedResponse] = Field(default_factory=list)


class CollectionListResponse(BaseModel):
    """Collection list response."""

    items: list[CollectionSummaryResponse]
    total: int


class CollectionRevisionSummaryResponse(BaseModel):
    """Collection revision summary response."""

    revision: int
    created_at: str
    created_by: str | None = None
    change_note: str
    item_count: int


class CollectionRevisionResponse(CollectionRevisionSummaryResponse):
    """Collection revision detail response."""

    collection_id: str
    revision_id: str
    items: list[CollectionItemResolvedResponse] = Field(default_factory=list)


class CollectionRevisionListResponse(BaseModel):
    """Collection revision list response."""

    items: list[CollectionRevisionSummaryResponse]
    total: int


class CollectionPreviewRequest(BaseModel):
    """Collection preview request."""

    project_id: str
    revision: int | None = Field(default=None, ge=1)
    conflict_policy: ConflictPolicy = "fail"
    item_overrides: dict[str, ConflictPolicy] | None = None


class CollectionPreviewSummary(BaseModel):
    """Collection preview summary."""

    to_create: int
    to_update: int
    to_skip: int
    to_rename: int
    conflicts: int


class CollectionPreviewItem(BaseModel):
    """Collection preview/apply item."""

    preset_id: str
    preset_revision: int
    name: str
    type: PresetComponentType
    platform: PresetPlatform
    action: Literal["create", "update", "skip", "rename", "conflict"]
    reason: str
    target_component_id: str | None = None
    renamed_to: str | None = None
    existing_content: str | None = None
    new_content: str | None = None


class CollectionPreviewResponse(BaseModel):
    """Collection preview response."""

    project_id: str
    collection_id: str
    collection_revision_id: str
    revision: int
    policy: ConflictPolicy
    summary: CollectionPreviewSummary
    items: list[CollectionPreviewItem]
    last_policy: ConflictPolicy | None = None


class CollectionApplyRequest(BaseModel):
    """Collection apply request."""

    project_id: str
    revision: int | None = Field(default=None, ge=1)
    conflict_policy: ConflictPolicy = "fail"
    item_overrides: dict[str, ConflictPolicy] | None = None


class CollectionApplySummary(BaseModel):
    """Collection apply summary."""

    created: int
    updated: int
    skipped: int
    renamed: int
    failed: int


class CollectionApplyResponse(BaseModel):
    """Collection apply response."""

    project_id: str
    collection_id: str
    collection_revision_id: str
    revision: int
    policy: ConflictPolicy
    summary: CollectionApplySummary
    items: list[CollectionPreviewItem]
