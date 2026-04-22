# VibeSmith

VibeSmith is a local-first manager for AI coding agent assets across Claude Code
and Cursor. It scans local skills, agents, commands, hooks, and rules, then gives
them a desktop and web UI for search, editing, dependency inspection, and reuse.

## Install

- Download the latest macOS build from
  [GitHub Releases](https://github.com/aroido/vibesmith/releases).
- Install with Homebrew:

```bash
brew update
brew tap aroido/vibesmith https://github.com/aroido/homebrew-vibesmith.git
brew install --cask aroido/vibesmith/vibesmith
```

## Public Source Mirror

This repository is the public source and release mirror for shipped VibeSmith
snapshots.

- GitHub Releases and the Homebrew tap are published from this repository.
- Public snapshots are buildable from source and include the release automation
  needed for the public channel.
- Maintainer-only planning, review, design, marketing, and agent workflow
  material is intentionally omitted from this mirror.
- Historical public PRs, branches, tags, and release metadata from before the
  clean-history cutover are retained outside this mirror.

## Build From Source

Prerequisites:

- Python 3.11 or newer
- Node.js 20 or newer
- npm 8 or newer

```bash
git clone https://github.com/aroido/vibesmith.git
cd vibesmith
make setup
make dev
```

Development servers:

- API: `http://localhost:8000`
- Web: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`

Desktop build:

```bash
make dist-desktop-mac
```

Build artifacts are generated under `packages/desktop/release/`.

## Documentation

- [Docs index](docs/index.md)
- [Public source overview](docs/architecture/public-source-overview.md)
- [Distribution policy](docs/distribution.md)
- [Security policy](SECURITY.md)

## License

VibeSmith is released under the Apache License 2.0. See [LICENSE](LICENSE).
