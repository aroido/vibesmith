"""Dependency injection — provides core instances."""

from fastapi import Request
from vibesmith_core import VibeSmithCore
from vibesmith_core.infra.scan_progress import ScanProgressRegistry
from vibesmith_core.infra.watcher import FileWatcher
from vibesmith_core.usage.scanner import UsageScanner

from vibesmith_api.i18n import resolve_locale_from_request


def get_core(request: Request) -> VibeSmithCore:
    """Retrieve the initialized VibeSmithCore from app.state.core."""
    return request.app.state.core


def get_watcher(request: Request) -> FileWatcher:
    """Retrieve the FileWatcher from app.state.watcher."""
    return request.app.state.watcher


def get_usage_scanner(request: Request) -> UsageScanner:
    """Retrieve the UsageScanner from app.state.usage_scanner."""
    return request.app.state.usage_scanner


def get_scan_registry(request: Request) -> ScanProgressRegistry:
    """Retrieve the ScanProgressRegistry from app.state.scan_registry."""
    return request.app.state.scan_registry


def get_locale(request: Request) -> str:
    """Resolve locale from request headers (Accept-Language, X-Locale)."""
    accept = request.headers.get("Accept-Language")
    x_locale = request.headers.get("X-Locale")
    return resolve_locale_from_request(accept, x_locale)


def enable_threadsafe_db(core: VibeSmithCore) -> None:
    """Prepare the initial connection for per-thread DB usage.

    DatabaseManager manages per-thread connections internally, so no reconnection is performed.
    """
    db = core._db
    if db:
        db.get_connection()
