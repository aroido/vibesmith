# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- macOS Electron app (Week 4-7)
- License system with Stripe integration (Week 8-9)
- Cloud backup and restore system (Week 10-11)
- Team collaboration features (Week 12+)
- In-app feedback and bug reporting
- Onboarding tutorial
- Command palette (Raycast-style)

### Changed
- Repository cleanup for public open-source distribution
- Release distribution consolidated on GitHub Releases and Homebrew

### Security
- Security vulnerability scanning (Dependabot, CodeQL)
- Automated dependency updates
- License compatibility checks

## [0.3.0] - 2026-02-13

### Added
- Scan UI for managing project folders (#27)
  - Add project folder form
  - Change global path form
  - Rescan button
- Settings page with scan configuration
- Security scanning system (#97)
  - Dependabot configuration
  - CodeQL security analysis
  - npm/pip audit automation
  - Trivy container scanning
  - License compatibility checks
- Design system and branding (#80)
  - Branding guidelines
  - Design tokens (colors, typography, spacing)
  - Logo and app icon specifications
  - Social media assets templates
  - AI design prompts

### Changed
- Updated API endpoints for scan management
- Improved error handling in scan operations

### Fixed
- Race conditions in scanner
- Memory leaks in dependency graph

## [0.2.0] - 2026-01-20

### Added
- Dependency graph visualization with React Flow
- Interactive node exploration
- Zoom and pan controls
- Node filtering and search
- Skill detail view with metadata
- Edit skill functionality
- Dependency list view

### Changed
- Improved scanning performance (3x faster)
- Enhanced UI with Chakra UI components
- Better error messages

### Fixed
- Circular dependency detection
- Path resolution on Windows

## [0.1.0] - 2026-01-05

### Added
- Initial release
- Core scanning engine
  - Skills scanner
  - Subagents scanner
  - Commands scanner
  - Hooks scanner
- FastAPI REST server
  - `/api/scan` endpoint
  - `/api/skills` CRUD endpoints
  - `/api/dependencies` endpoint
- React web UI
  - Dashboard with statistics
  - Skills list view
  - Basic search functionality
- SQLite database
  - Skills table
  - Dependencies table
  - Metadata storage
- Python core library
  - Markdown parser
  - Dependency resolver
  - Path utilities
- Development infrastructure
  - Makefile for automation
  - pytest test suite
  - Vitest for frontend tests
  - ESLint and Prettier
  - Ruff for Python linting

### Documentation
- README with quick start guide
- API documentation
- Architecture documentation
- Contributing guidelines

---

## Version History

- **0.3.0** (2026-02-13) - Scan UI, Security, Design System
- **0.2.0** (2026-01-20) - Dependency Graph, Skill Editor
- **0.1.0** (2026-01-05) - Initial Release

## Upgrade Guide

### From 0.2.0 to 0.3.0

No breaking changes. Simply pull the latest code and run:

```bash
git pull origin main
make install
make dev
```

### From 0.1.0 to 0.2.0

Database schema changes require migration:

```bash
# Backup your database
cp packages/api/vibesmith.db packages/api/vibesmith.db.backup

# Run migration
make migrate

# Or manually
cd packages/api
python -m alembic upgrade head
```

## Support

For questions or issues, please:
- Check [GitHub Issues](https://github.com/aroido/vibesmith/issues)
- Visit [GitHub Discussions](https://github.com/aroido/vibesmith/discussions)
- Email [support@vibesmith.com](mailto:support@vibesmith.com)
