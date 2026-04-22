"""패키징 환경에서 FastAPI 서버를 실행하는 엔트리포인트."""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Sequence

import uvicorn


def _resolve_port(value: str) -> int:
    """환경변수 PORT를 안전하게 파싱한다."""
    try:
        return int(value)
    except ValueError:
        return 8000


def _parse_args(argv: Sequence[str]) -> argparse.Namespace:
    """CLI 인자를 파싱한다."""
    parser = argparse.ArgumentParser(
        description="Run VibeSmith API server executable.",
    )
    parser.add_argument(
        "--self-check",
        action="store_true",
        help="Run lightweight startup check and exit with code 0.",
    )
    parser.add_argument(
        "--host",
        default=os.getenv("HOST", "127.0.0.1"),
        help="Host for uvicorn server (default from HOST env).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=_resolve_port(os.getenv("PORT", "8000")),
        help="Port for uvicorn server (default from PORT env).",
    )
    parser.add_argument(
        "--log-level",
        default=os.getenv("LOG_LEVEL", "info"),
        help="Log level for uvicorn server (default from LOG_LEVEL env).",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    """Uvicorn 서버를 시작한다."""
    args = _parse_args(sys.argv[1:] if argv is None else argv)

    if args.self_check:
        # 빌드 검증 시 서버를 띄우지 않고 즉시 종료해 orphan 프로세스를 방지한다.
        print("vibesmith-api self-check ok")
        return

    from vibesmith_api.main import app

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level=args.log_level,
    )


if __name__ == "__main__":
    main()
