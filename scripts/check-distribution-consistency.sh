#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "README.md"
  "SUPPORT.md"
  "docs/distribution.md"
  "packages/desktop/README.md"
  "packages/landing/src/app/download/page.tsx"
  ".github/workflows/release-desktop.yml"
  "scripts/sync-homebrew-tap.mjs"
)

for file in "${required_files[@]}"; do
  test -f "$file"
done

grep -q -F "https://github.com/aroido/homebrew-vibesmith.git" README.md SUPPORT.md packages/desktop/README.md packages/landing/src/app/download/page.tsx docs/distribution.md
grep -q -F "HOMEBREW_TAP_GITHUB_TOKEN" docs/distribution.md .github/workflows/release-desktop.yml packages/desktop/README.md
grep -q -F "scripts/sync-homebrew-tap.mjs" .github/workflows/release-desktop.yml

stale_patterns=(
  "Public binary downloads are temporarily unavailable"
  "Homebrew installation will return after the public release pipeline is restored"
  "Public Homebrew and direct downloads are temporarily unavailable"
  "public signed releases are not currently published"
  "first published binary release"
  "re-established"
)

for pattern in "${stale_patterns[@]}"; do
  if grep -q -F "$pattern" README.md packages/desktop/README.md packages/landing/src/app/download/page.tsx; then
    echo "Found stale distribution copy: $pattern" >&2
    exit 1
  fi
done
