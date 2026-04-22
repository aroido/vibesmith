"""샘플 프로젝트 생성 API — Quick Start 기능."""

import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from vibesmith_core import VibeSmithCore

from vibesmith_api.deps import get_core
from vibesmith_api.i18n import KEYS
from vibesmith_api.i18n.exceptions import I18nHTTPException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["sample"])


class CreateSampleProjectRequest(BaseModel):
    """샘플 프로젝트 생성 요청."""

    target_path: str = Field(
        default="~/vibesmith-sample",
        description="샘플 프로젝트를 생성할 경로",
        examples=["~/vibesmith-sample", "/Users/dev/my-sample"],
    )


class SampleComponentInfo(BaseModel):
    """샘플 구성요소 정보."""

    id: str = Field(description="구성요소 고유 ID (UUID)")
    name: str = Field(description="구성요소 이름")
    type: str = Field(description="구성요소 타입")
    description: str = Field(description="구성요소 설명")


class CreateSampleProjectResponse(BaseModel):
    """샘플 프로젝트 생성 응답."""

    project_id: str = Field(description="생성된 프로젝트 ID (UUID)")
    path: str = Field(description="생성된 프로젝트 절대 경로")
    components_count: int = Field(description="생성된 구성요소 개수")
    components: list[SampleComponentInfo] = Field(description="생성된 구성요소 목록")


@router.post(
    "/sample-project",
    response_model=CreateSampleProjectResponse,
    status_code=201,
    summary="Quick Start 샘플 프로젝트 생성",
    response_description="생성된 샘플 프로젝트 정보",
)
def create_sample_project(
    req: CreateSampleProjectRequest,
    core: VibeSmithCore = Depends(get_core),
):
    """Quick Start용 샘플 프로젝트를 생성합니다.

    8개의 기본 구성요소(Skills 4개, Agents 2개, Commands 2개)를 포함한
    샘플 프로젝트를 생성하고, 자동으로 스캔하여 등록합니다.

    - **target_path**: 샘플 프로젝트를 생성할 경로 (기본값: ~/vibesmith-sample)
    """
    target_path = Path(req.target_path).expanduser().resolve()

    # 경로 검증
    if target_path.exists():
        raise I18nHTTPException(400, KEYS.PATH_ALREADY_EXISTS, path=str(target_path))

    try:
        # 샘플 템플릿 경로 찾기
        # Issue #267: templates는 core 패키지 내부에 위치
        import vibesmith_core

        core_pkg_path = Path(vibesmith_core.__file__).parent
        template_path = core_pkg_path / "templates" / "data" / "sample-project"

        if not template_path.exists():
            logger.error("샘플 템플릿을 찾을 수 없습니다. 경로=%s", template_path)
            raise I18nHTTPException(500, KEYS.SAMPLE_TEMPLATE_NOT_FOUND)

        # 샘플 템플릿 복사
        logger.info("샘플 프로젝트 생성 중. 경로=%s", target_path)
        shutil.copytree(template_path, target_path)

        # .claude 디렉토리로 인식하도록 변환
        # Issue #267: 샘플 템플릿은 Claude Code 스타일로 생성
        claude_dir = target_path / ".claude"
        claude_dir.mkdir(exist_ok=True)
        # skills, agents, commands를 .claude 하위로 이동
        for item in target_path.iterdir():
            if item.is_dir() and item.name in ("skills", "agents", "commands"):
                target = claude_dir / item.name
                if target.exists():
                    shutil.rmtree(target)
                shutil.move(str(item), str(target))

        # 프로젝트 등록 및 스캔
        project = core.projects.add_project(str(target_path))
        scan_result = core.projects.rescan(project.id)
        logger.info("샘플 프로젝트 스캔 완료. 구성요소=%d", scan_result["component_count"])

        # 구성요소 목록 조회
        components = core.operations.list_all({"project_id": project.id})

        return CreateSampleProjectResponse(
            project_id=project.id,
            path=str(target_path),
            components_count=len(components),
            components=[
                SampleComponentInfo(
                    id=c.id,
                    name=c.name,
                    type=c.type,
                    description=c.description or "",
                )
                for c in components
            ],
        )
    except I18nHTTPException:
        raise
    except Exception as e:
        logger.exception("샘플 프로젝트 생성 실패. 경로=%s", target_path)
        # 생성 실패 시 롤백 (디렉토리 삭제)
        if target_path.exists():
            try:
                shutil.rmtree(target_path)
                logger.info("생성 실패 — 디렉토리 롤백 완료. 경로=%s", target_path)
            except Exception as cleanup_error:
                logger.error("롤백 실패. 경로=%s 오류=%s", target_path, cleanup_error)
        raise I18nHTTPException(
            500,
            KEYS.SAMPLE_CREATE_FAILED,
            detail=str(e),
        ) from e
