# VibeSmith Desktop

The Electron desktop app for VibeSmith.

## What It Does

- Wraps the VibeSmith web UI in a native desktop shell
- Runs the local API server alongside the renderer
- Delivers signed macOS release artifacts with in-app update support when public GitHub releases are published
- Fetches release notes from GitHub Releases for update prompts when releases exist

## Install

Current public install paths:

- GitHub Releases: https://github.com/aroido/vibesmith/releases
- Homebrew:

```bash
brew update
brew tap aroido/vibesmith https://github.com/aroido/homebrew-vibesmith.git
brew install --cask aroido/vibesmith/vibesmith
```

Source builds remain available from the repository root:

```bash
make setup
make dev
```

Canonical public references:

- [GitHub releases page](https://github.com/aroido/vibesmith/releases)
- [Aroido product page](https://aroido.com/projects/vibesmith/)
- [Distribution policy](../../docs/distribution.md)

## Development

From the repository root:

```bash
make setup
make dev
```

Desktop-specific commands:

```bash
cd packages/desktop
npm run dev
npm run build
npm run test:readiness
```

## Packaging

Packaging and release details live in [BUILD.md](BUILD.md).

The GitHub release pipeline expects:

- a matching tag such as `vX.Y.Z` or `vX.Y.Z-alpha.N`
- release notes in the GitHub release body
- Apple signing and notarization secrets configured in GitHub
- `HOMEBREW_TAP_GITHUB_TOKEN` configured with write access to `aroido/homebrew-vibesmith` for automatic Homebrew tap sync

If `HOMEBREW_TAP_GITHUB_TOKEN` is not configured, the workflow still publishes and verifies the GitHub release assets, then skips the tap sync with a warning. Update the tap manually with `scripts/sync-homebrew-tap.mjs`.

## Links

- Product page: https://aroido.com/projects/vibesmith/
- Releases: https://github.com/aroido/vibesmith/releases
- Issues: https://github.com/aroido/vibesmith/issues
