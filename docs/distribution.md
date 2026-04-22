# Distribution Policy

VibeSmith uses one public release source of truth and one public package manager
source of truth.

## Canonical Public Channels

- GitHub repository: `https://github.com/aroido/vibesmith`
- GitHub releases: `https://github.com/aroido/vibesmith/releases`
- Homebrew tap: `https://github.com/aroido/homebrew-vibesmith`
- Product page: `https://aroido.com/projects/vibesmith/`

## Current Public Install Paths

- Direct download: latest non-draft GitHub release, including prereleases
- Homebrew:

```bash
brew update
brew tap aroido/vibesmith https://github.com/aroido/homebrew-vibesmith.git
brew install --cask aroido/vibesmith/vibesmith
```

## Release Automation

- Tagging `vX.Y.Z` or `vX.Y.Z-alpha.N` publishes signed desktop assets to
  GitHub Releases.
- After release verification passes, the workflow syncs
  `aroido/homebrew-vibesmith` with the matching version, SHA256, and GitHub
  release asset URL.
- Automatic Homebrew tap sync requires `HOMEBREW_TAP_GITHUB_TOKEN` with write
  access to `aroido/homebrew-vibesmith`.
- If that token is unavailable, the release workflow publishes and verifies
  GitHub release assets, skips tap sync with a warning, and the tap can be
  updated manually with `scripts/sync-homebrew-tap.mjs`.
