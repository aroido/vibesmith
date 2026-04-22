"""VibeSmithCore — Unified management facade for AI coding agent components."""

from vibesmith_core.components.models import ComponentBase, Dependency
from vibesmith_core.components.operations import ComponentOperations
from vibesmith_core.components.tagging import TagManager
from vibesmith_core.components.versioning import VersionManager
from vibesmith_core.dependencies.analyzer import DependencyAnalyzer
from vibesmith_core.infra.db import DatabaseManager
from vibesmith_core.projects import ProjectManager
from vibesmith_core.scanning.scanner import FileSystemScanner
from vibesmith_core.templates.generator import ComponentGenerator as ComponentGenerator
from vibesmith_core.templates.manager import TemplateManager as TemplateManager


class VibeSmithCore:
    """Core engine facade — provides unified access to DB, scanner, parser, CRUD, tags, versions, and dependencies."""

    def __init__(
        self,
        db_path: str = "~/.vibesmith/vibesmith.db",
        global_path: str | None = None,
        adapter=None,
    ) -> None:
        self._db_path = db_path
        self._global_path = global_path
        self._adapter = adapter
        self._db: DatabaseManager | None = None
        self.operations: ComponentOperations | None = None
        self.projects: ProjectManager | None = None
        self.tags: TagManager | None = None
        self.versions: VersionManager | None = None

    @property
    def db(self) -> DatabaseManager | None:
        return self._db

    def initialize(self) -> None:
        """Initialize the DB and configure all managers."""
        self._db = DatabaseManager(self._db_path)
        self._db.initialize_schema()
        self.operations = ComponentOperations(self._db)
        scanner = FileSystemScanner(adapter=self._adapter)
        self.projects = ProjectManager(self._db, scanner=scanner)
        self.tags = TagManager(self._db)
        self.versions = VersionManager(self._db)
        # Skip ensure_global_project if adapter's global_path is None
        global_path = self._global_path
        if self._adapter and self._adapter.get_global_path() is None:
            pass  # Cursor has no global config
        else:
            self.projects.ensure_global_project(global_path)

    def analyze_dependencies(
        self,
        components: list[ComponentBase],
    ) -> list[Dependency]:
        """Analyze dependencies from a list of components."""
        analyzer = DependencyAnalyzer(components)
        return analyzer.analyze_all()

    def close(self) -> None:
        """Close the DB connection."""
        if self._db:
            self._db.close()
