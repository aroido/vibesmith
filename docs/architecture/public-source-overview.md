# Public Source Overview

This repository is a clean public mirror for shipped VibeSmith source snapshots
and public release automation.

## Included

- Python core and API packages
- React web UI and Electron desktop shell
- Landing page source
- Public GitHub Actions workflows
- Public build, verification, release, and Homebrew helper scripts
- Public docs needed to build, inspect, install, and verify the snapshot

## Omitted

- Maintainer agent workspaces and local runtime state
- Internal planning, review, design, and marketing source material
- Historical public pull request, branch, tag, and release history from before
  the clean-history cutover
- Secret values and local environment files

## Release Surface

The public release surface is:

- repository: `aroido/vibesmith`
- latest release: `v0.5.4-alpha.16`
- Homebrew tap: `aroido/homebrew-vibesmith`

Use `./scripts/ai-verify --mode full` before publishing a new source snapshot or
release tag.
