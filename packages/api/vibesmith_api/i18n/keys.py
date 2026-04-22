"""API 응답 메시지 i18n 키 표준화.

키 네이밍 규칙:
- errors.* : HTTP 4xx/5xx 에러 메시지
- common.* : 공통 성공/일반 메시지
- 도메인.행동 형식 예: errors.project_not_found
"""


class KEYS:
    """i18n 표준 키 상수."""

    # ---- errors ----
    PROJECT_NOT_FOUND = "errors.project_not_found"
    PROJECT_ALREADY_EXISTS = "errors.project_already_exists"
    PROJECT_PATH_NOT_ABSOLUTE = "errors.project_path_not_absolute"
    PROJECT_PATH_NOT_WRITABLE = "errors.project_path_not_writable"
    PROJECT_PATH_NOT_EMPTY = "errors.project_path_not_empty"
    GLOBAL_PROJECT_CANNOT_DELETE = "errors.global_project_cannot_delete"
    GLOBAL_PROJECT_CANNOT_HIDE = "errors.global_project_cannot_hide"
    COMPONENT_NOT_FOUND = "errors.component_not_found"
    TEMPLATE_NOT_FOUND = "errors.template_not_found"
    PROJECT_TEMPLATE_NOT_FOUND = "errors.project_template_not_found"
    PROJECT_TEMPLATE_REVISION_NOT_FOUND = "errors.project_template_revision_not_found"
    PROJECT_TEMPLATE_SOURCE_PROJECT_NOT_FOUND = "errors.project_template_source_project_not_found"
    PROJECT_TEMPLATE_INVALID_COMPONENT_SELECTION = "errors.project_template_invalid_component_selection"
    PROJECT_TEMPLATE_CONFLICT_POLICY_INVALID = "errors.project_template_conflict_policy_invalid"
    PROJECT_TEMPLATE_CONTENT_TOO_LARGE = "errors.project_template_content_too_large"
    PROJECT_TEMPLATE_COMPONENT_LIMIT_EXCEEDED = "errors.project_template_component_limit_exceeded"
    PROJECT_TEMPLATE_APPLY_CONFLICT = "errors.project_template_apply_conflict"
    PROJECT_TEMPLATE_NAME_EXISTS = "errors.project_template_name_exists"
    PROJECT_TEMPLATE_COMPONENTS_REQUIRED = "errors.project_template_components_required"
    PROJECT_TEMPLATE_SYSTEM_IMMUTABLE = "errors.project_template_system_immutable"
    TARGET_PROJECT_NOT_FOUND = "errors.target_project_not_found"
    PROJECT_NOT_FOUND_BY_ID = "errors.project_not_found_by_id"

    DUPLICATE_COMPONENT_NAME = "errors.duplicate_component_name"
    DUPLICATE_NAME_IN_TARGET = "errors.duplicate_name_in_target"
    EMAIL_ALREADY_EXISTS = "errors.email_already_exists"
    INVALID_CREDENTIALS = "errors.invalid_credentials"
    INVALID_TOKEN = "errors.invalid_token"

    INVALID_YAML_FRONTMATTER = "errors.invalid_yaml_frontmatter"
    PATH_ALREADY_EXISTS = "errors.path_already_exists"
    SAMPLE_TEMPLATE_NOT_FOUND = "errors.sample_template_not_found"
    SAMPLE_CREATE_FAILED = "errors.sample_create_failed"

    SOFT_DELETE_NOT_IMPLEMENTED = "errors.soft_delete_not_implemented"
    TEMPLATE_RENDER_FAILED = "errors.template_render_failed"
    TEMPLATES_LOAD_FAILED = "errors.templates_load_failed"
    TEMPLATE_LOAD_FAILED = "errors.template_load_failed"
    TEMPLATE_GENERATE_FAILED = "errors.template_generate_failed"
    COPY_FAILED = "errors.copy_failed"
    NOT_IMPLEMENTED = "errors.not_implemented"
    VERSION_NOT_FOUND = "errors.version_not_found"

    # license (Issue #79)
    LICENSE_INVALID = "errors.license_invalid"
    LICENSE_NOT_FOUND = "errors.license_not_found"
    STRIPE_NOT_CONFIGURED = "errors.stripe_not_configured"
    STRIPE_CHECKOUT_FAILED = "errors.stripe_checkout_failed"
    INVALID_PLAN = "errors.invalid_plan"

    # validation (422)
    VALIDATION_ERROR = "errors.validation_error"

    # feedback (Issue #85)
    FEEDBACK_TOKEN_NOT_CONFIGURED = "errors.feedback_token_not_configured"
    FEEDBACK_ISSUE_CREATE_FAILED = "errors.feedback_issue_create_failed"

    # ---- common ----
    DELETED = "common.deleted"
    PROJECT_HIDDEN = "common.project_hidden"
    PROJECT_HIDDEN_CANNOT_RESCAN = "common.project_hidden_cannot_rescan"
    PROJECT_UNHIDDEN = "common.project_unhidden"
    ROLLED_BACK = "common.rolled_back"
