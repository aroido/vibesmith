"""Adapter package — per-agent path mapping."""

from vibesmith_core.scanning.adapters.base import AgentAdapter
from vibesmith_core.scanning.adapters.claude_code import ClaudeCodeAdapter
from vibesmith_core.scanning.adapters.cursor import CursorAdapter

__all__ = ["AgentAdapter", "ClaudeCodeAdapter", "CursorAdapter"]
