"""Unit tests for ScanProgressRegistry."""

import threading

from vibesmith_core.infra.scan_progress import ScanProgressRegistry


class TestScanProgressRegistry:
    """Verifies state transitions and thread safety of ScanProgressRegistry."""

    def test_initial_state_not_scanning(self):
        registry = ScanProgressRegistry()
        snapshot = registry.get_progress()
        assert snapshot["scanning"] is False
        assert snapshot["projects"] == []

    def test_start_scan_registers_pending_projects(self):
        registry = ScanProgressRegistry()
        registry.start_scan(
            scan_type="filesystem",
            project_ids=["p1", "p2"],
            project_names={"p1": "Project 1", "p2": "Project 2"},
        )
        snapshot = registry.get_progress()
        assert snapshot["scanning"] is True
        assert len(snapshot["projects"]) == 2
        for p in snapshot["projects"]:
            assert p["status"] == "pending"
            assert p["progress"] == 0

    def test_mark_scanning_transitions_state(self):
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"], {"p1": "P1"})
        registry.mark_scanning("p1")
        snapshot = registry.get_progress()
        proj = snapshot["projects"][0]
        assert proj["status"] == "scanning"
        assert proj["progress"] == 0

    def test_mark_done_transitions_state(self):
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"], {"p1": "P1"})
        registry.mark_scanning("p1")
        registry.mark_done("p1")
        snapshot = registry.get_progress()
        proj = snapshot["projects"][0]
        assert proj["status"] == "done"
        assert proj["progress"] == 100

    def test_finish_scan_keeps_done_projects(self):
        """finish_scan transitions all projects to done and preserves state."""
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1", "p2"], {"p1": "P1", "p2": "P2"})
        registry.mark_scanning("p1")
        registry.mark_done("p1")
        # p2 is still pending
        registry.finish_scan()
        snapshot = registry.get_progress()
        assert snapshot["scanning"] is False
        # Project list is preserved and all done
        assert len(snapshot["projects"]) == 2
        assert all(p["status"] == "done" for p in snapshot["projects"])

    def test_start_scan_clears_previous_results(self):
        """New start_scan overwrites previous results."""
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"], {"p1": "P1"})
        registry.mark_done("p1")
        registry.finish_scan()
        # Start new scan while previous results remain
        registry.start_scan("usage", ["p2"], {"p2": "P2"})
        snapshot = registry.get_progress()
        assert len(snapshot["projects"]) == 1
        assert snapshot["projects"][0]["id"] == "p2"

    def test_scanning_true_when_any_pending_or_scanning(self):
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1", "p2"], {"p1": "P1", "p2": "P2"})
        registry.mark_scanning("p1")
        registry.mark_done("p1")
        # p2 is still pending
        snapshot = registry.get_progress()
        assert snapshot["scanning"] is True

    def test_unknown_project_id_ignored(self):
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"], {"p1": "P1"})
        # Should not raise
        registry.mark_scanning("unknown")
        registry.mark_done("unknown")
        snapshot = registry.get_progress()
        assert len(snapshot["projects"]) == 1

    def test_start_scan_overwrites_previous(self):
        """Nested start_scan overwrites previous state."""
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"], {"p1": "P1"})
        registry.mark_scanning("p1")
        # Start new scan — clear previous state
        registry.start_scan("usage", ["p2", "p3"], {"p2": "P2", "p3": "P3"})
        snapshot = registry.get_progress()
        assert len(snapshot["projects"]) == 2
        assert all(p["status"] == "pending" for p in snapshot["projects"])

    def test_project_names_default_to_ids(self):
        """Uses id as name when project_names is not provided."""
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"])
        snapshot = registry.get_progress()
        assert snapshot["projects"][0]["name"] == "p1"

    def test_get_progress_returns_correct_structure(self):
        registry = ScanProgressRegistry()
        registry.start_scan("filesystem", ["p1"], {"p1": "My Project"})
        registry.mark_scanning("p1")
        snapshot = registry.get_progress()
        proj = snapshot["projects"][0]
        assert "id" in proj
        assert "name" in proj
        assert "status" in proj
        assert "progress" in proj
        assert proj["id"] == "p1"
        assert proj["name"] == "My Project"

    def test_thread_safety(self):
        """No exception during concurrent multi-thread read/write."""
        registry = ScanProgressRegistry()
        ids = [f"p{i}" for i in range(20)]
        registry.start_scan("filesystem", ids)
        errors = []

        def mark_and_read(pid: str):
            try:
                registry.mark_scanning(pid)
                registry.get_progress()
                registry.mark_done(pid)
                registry.get_progress()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=mark_and_read, args=(pid,)) for pid in ids]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == []
        snapshot = registry.get_progress()
        assert all(p["status"] == "done" for p in snapshot["projects"])
