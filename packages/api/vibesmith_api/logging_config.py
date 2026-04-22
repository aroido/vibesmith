"""structlog-based logging configuration."""

import logging
import os
import sys

import structlog


def setup_logging() -> structlog.stdlib.BoundLogger:
    """Configure structlog and return the root logger.

    Log level can be controlled via the LOG_LEVEL environment variable. (default: INFO)
    """
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    numeric_level = getattr(logging, log_level, logging.INFO)

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(ensure_ascii=False),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=False,
    )

    # stdlib logging setup — the base that structlog wraps
    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Remove existing handlers and add stderr handler
    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(numeric_level)
    handler.setFormatter(logging.Formatter("%(message)s"))

    # Prevent duplicate handlers
    for h in root.handlers[:]:
        root.removeHandler(h)
    root.addHandler(handler)

    return structlog.get_logger("vibesmith")


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a per-module logger."""
    return structlog.get_logger(name)
