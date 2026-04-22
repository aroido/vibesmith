"""AgentAdapter ABC — abstracts per-agent path conventions."""

from abc import ABC, abstractmethod
from typing import ClassVar


class AgentAdapter(ABC):
    """Abstracts path conventions for AI agents."""

    _config_dirs: ClassVar[set[str]] = set()
    _adapter_classes: ClassVar[list[type["AgentAdapter"]]] = []
    _adapter_type: ClassVar[str] = ""

    def __init_subclass__(cls, config_dir: str = "", adapter_type: str = "", **kwargs) -> None:
        super().__init_subclass__(**kwargs)
        if config_dir:
            AgentAdapter._config_dirs.add(config_dir)
        if adapter_type:
            cls._adapter_type = adapter_type
            AgentAdapter._adapter_classes.append(cls)

    @property
    def adapter_type(self) -> str:
        """Return the type identifier of this adapter."""
        return self._adapter_type

    @classmethod
    def all_config_dirs(cls) -> frozenset[str]:
        """Return config directory names of all registered adapters."""
        return frozenset(cls._config_dirs)

    @classmethod
    def all_adapters(cls) -> list["AgentAdapter"]:
        """Return a list of instances of all registered adapters."""
        return [adapter_cls() for adapter_cls in cls._adapter_classes]

    @abstractmethod
    def get_global_path(self) -> str | None:
        """Return the global config directory path."""

    @abstractmethod
    def get_project_path(self, project_root: str) -> str:
        """Return the config directory path within a project."""

    @abstractmethod
    def get_component_paths(self, base_path: str) -> dict[str, str]:
        """Return paths by component type."""

    @abstractmethod
    def get_extra_rules(self, project_path: str) -> list[str]:
        """Return additional rule file paths from the project root."""
