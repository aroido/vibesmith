#!/usr/bin/env python3
"""FastAPI OpenAPI JSON 생성 스크립트.

GitHub Actions와 로컬에서 API 문서 생성을 위해 사용.
실행 전: pip install -e packages/core -e packages/api

Usage:
    python scripts/generate-openapi.py
    # 또는 Makefile: make generate-openapi
"""
import json
from pathlib import Path

# 테스트 모드로 lifespan 초기화 건너뜀 (프로젝트 탐색 등)
import os

os.environ["VIBESMITH_TEST_MODE"] = "1"

from vibesmith_api.main import app

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "docs" / "api" / "openapi.json"


def main() -> None:
    """OpenAPI 스키마를 JSON 파일로 출력한다."""
    openapi_schema = app.openapi()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2, ensure_ascii=False)
    print(f"OpenAPI schema written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
