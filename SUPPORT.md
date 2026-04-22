# Support

Use the public GitHub repository for VibeSmith support.

| Channel | Purpose |
| --- | --- |
| [GitHub Issues](https://github.com/aroido/vibesmith/issues) | Bug reports and release regressions |
| [GitHub Discussions](https://github.com/aroido/vibesmith/discussions) | Questions, ideas, and usage notes |
| [GitHub Releases](https://github.com/aroido/vibesmith/releases) | Downloads and release notes |

## Installation

```bash
brew update
brew tap aroido/vibesmith https://github.com/aroido/homebrew-vibesmith.git
brew install --cask aroido/vibesmith/vibesmith
```

You can also download release artifacts directly from
[GitHub Releases](https://github.com/aroido/vibesmith/releases).

## From Source

```bash
make setup
make dev
```

If setup fails, confirm Python 3.11+ and Node.js 20+ are installed, then run:

```bash
make clean-all
make setup
```
