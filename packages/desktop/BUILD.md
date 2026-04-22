# VibeSmith Desktop Build Guide

Explains how to build and distribute the VibeSmith Desktop app.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Development Build](#development-build)
- [Production Build](#production-build)
- [Distribution Packaging](#distribution-packaging)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Python Environment
- Python 3.11 or higher
- PyInstaller (for building the API executable)

```bash
# Use Homebrew Python (recommended)
which python3  # /opt/homebrew/bin/python3

# Create a venv in the API directory
cd packages/api
python3 -m venv .venv-pure
source .venv-pure/bin/activate
pip install -e ../core -e . pyinstaller
```

### 2. Node.js Environment
- Node.js 18 or higher
- npm or yarn

### 3. System Requirements
- **macOS**: Xcode Command Line Tools
- **Windows**: Visual Studio Build Tools
- **Linux**: build-essential, libsecret-1-dev

---

## Development Build

### 1. Install Dependencies

```bash
# From the project root
make install
```

### 2. Run in Development Mode

```bash
# Terminal 1: API server
cd packages/api
.venv-pure/bin/uvicorn vibesmith_api.main:app --reload

# Terminal 2: Desktop app
cd packages/desktop
npm run dev
```

**How it works**:
- In development mode, `app.isPackaged === false`
- Electron uses an external API server (`VIBESMITH_DEV_API_URL` or the default `http://127.0.0.1:8000`)
- Hot reload is supported

### 3. Internal Test Build (Auto Local Signing + Verbose Debug Logs)

For internal developer testing, use the `internal` flavor.
In this mode, `VIBESMITH_BUILD_FLAVOR=internal` is applied, so the default log level is `debug`.
By default, the internal build only generates `zip/.app` artifacts to avoid local permission issues (`hdiutil`'s `/Volumes` write restriction).
`npm run dist:mac:internal`/`npm run pack:internal` auto-detect signing certificates from the local Keychain
and produce signed internal builds when possible (not for external distribution).

```bash
# From the project root
make dist-desktop-mac-internal

# Or run directly from the desktop package
cd packages/desktop
npm run dist:mac:internal
```

Note: `npm run dist:mac:internal`/`npm run pack:internal` automatically rebuild
`packages/api/dist/vibesmith-api` before packaging to ensure the latest API is bundled.

Controlling internal build signing behavior:

```bash
# Default: auto (signs if a local certificate is found, falls back to unsigned otherwise)
VIBESMITH_INTERNAL_SIGN=auto npm run dist:mac:internal

# Certificate is required (fails if not found)
VIBESMITH_INTERNAL_SIGN=always npm run dist:mac:internal

# Always build unsigned
VIBESMITH_INTERNAL_SIGN=never npm run dist:mac:internal
# Or
npm run dist:mac:internal:unsigned

# Specify a particular certificate (enter without prefix)
VIBESMITH_INTERNAL_SIGN_IDENTITY='Your Name (XXXXXXXXXX)' npm run dist:mac:internal
```

Note: On macOS environments with strict security policies, unsigned builds may be blocked from running.

If you need to generate a DMG locally, use the following command.
(This may fail depending on macOS permission policies)

```bash
cd packages/desktop
npm run dist:mac:internal:dmg

# For an unsigned DMG
npm run dist:mac:internal:dmg:unsigned
```

Electron automated click smoke test after an internal build:

```bash
cd packages/desktop
npm run test:e2e:desktop
```

---

## Production Build

### Method 1: Integrated Build Script (Recommended)

```bash
cd packages/desktop
./scripts/build.sh
```

**Build order**:
1. Build API executable (PyInstaller)
2. Build Web (Vite)
3. Build Desktop (Electron)
4. Verify artifacts

**Output**:
```
packages/api/dist/vibesmith-api    # 29MB executable
packages/web/dist/                 # React SPA
packages/desktop/out/              # Electron build
```

### Method 2: Make Commands

```bash
# From the project root
make build-api-executable  # API executable only
make build-web             # Web build only
make build-desktop         # Desktop build (includes Web build)
```

### Method 3: Manual Build

```bash
# 1. API executable
cd packages/api
python3 build_api_executable.py

# 2. Web build
cd ../web
npm run build

# 3. Desktop build
cd ../desktop
npm run build
```

---

## Distribution Packaging

### macOS App Packaging

```bash
# Method 1: Using the script
cd packages/desktop
./scripts/build.sh --package mac

# Method 2: Using Make
cd ../../
make dist-desktop-mac

# Method 3: npm script
cd packages/desktop
npm run dist:mac
```

**Output**:
```
packages/desktop/release/
  VibeSmith-{version}.dmg
  VibeSmith-{version}.zip
  VibeSmith-{version}.zip.blockmap
```

### Windows App Packaging

```bash
make dist-desktop-win
# Or
npm run dist:win
```

**Output**:
```
packages/desktop/release/
  VibeSmith-{version}*.exe
```

### Linux App Packaging

```bash
make dist-desktop-linux
# Or
npm run dist:linux
```

**Output**:
```
packages/desktop/release/
  VibeSmith-{version}*.AppImage
```

### All Platform Build

```bash
make dist-desktop
# Or
npm run dist
```

---

## Build Structure

### electron-builder.json Configuration

```json
{
  "files": [
    "out",           // Electron build output
    "resources",     // Icons, splash.html, etc.
    "!out/**/*.map"
  ],
  "extraResources": [
    {
      "from": "../api/dist/vibesmith-api",
      "to": "api/vibesmith-api"
    }
  ]
}
```

**Packaging result**:
```
VibeSmith.app/
├── Contents/
│   ├── MacOS/
│   │   └── VibeSmith              # Electron main
│   └── Resources/
│       ├── app.asar               # Electron code (out/)
│       ├── splash.html            # Splash screen
│       └── api/
│           └── vibesmith-api      # FastAPI executable
```

### Runtime Behavior

1. **App startup**:
   - Electron Main Process starts
   - Splash screen is displayed

2. **API server startup**:
   ```typescript
   // Production mode
   const apiPath = join(process.resourcesPath, 'api', 'vibesmith-api');
   spawn(apiPath, [], { env: { VIBESMITH_DB_PATH: dbPath } });
   ```
   - Port 8000 is preferred by default
   - If port 8000 is occupied by another process, automatically falls back to an available local port

3. **Health check**:
   - `GET /api/health` with 30-second timeout
   - Retries at 500ms intervals

4. **Main window display**:
   - Closes splash screen
   - Loads React SPA

5. **App shutdown**:
   - `SIGTERM` → `SIGKILL` after 5 seconds
   - DB cleanup

---

## Troubleshooting

### 1. API Executable Build Failure

**Symptom**:
```
ModuleNotFoundError: No module named 'fastapi'
```

**Solution**:
```bash
cd packages/api
rm -rf .venv-pure build dist *.spec
python3 -m venv .venv-pure
source .venv-pure/bin/activate
pip install -e ../core -e . pyinstaller
python3 build_api_executable.py
```

### 2. Missing API File During Electron Build

**Symptom**:
```
extraResources: [../api/dist/vibesmith-api] not found
```

**Solution**:
```bash
# Build the API executable first
make build-api-executable

# Then package the Desktop app
make dist-desktop-mac
```

### 3. API Server Fails to Start in Packaged App

**Symptom**:
- App won't start
- "API server failed to start" dialog

**Debugging**:
```bash
# Check app logs (macOS)
tail -f ~/Library/Logs/VibeSmith/main.log

# Test the executable
cd VibeSmith.app/Contents/Resources/api
./vibesmith-api
```

**Possible causes**:
- API executable permission issues
- Missing Python dependencies
- Port 8000 conflict (mostly mitigated by auto fallback)

**Checking for port conflicts**:
```bash
# Check processes occupying port 8000
lsof -nP -iTCP:8000 -sTCP:LISTEN

# Check which port was actually selected in the main log
tail -f ~/Library/Logs/@vibesmith/desktop/main.log | rg "api.port.selection"
```

### 4. Code Signing Error (macOS)

**Symptom**:
```
The application "VibeSmith" can't be opened.
```

**Temporary fix** (for development):
```bash
xattr -cr /Applications/VibeSmith.app
```

**Permanent fix** (for distribution):
- Requires an Apple Developer account
- See the [Code Signing Guide](./CODESIGNING.md)

### 5. Verifying Release Artifacts

**Check artifact paths and filenames**:
```bash
ls -lh packages/desktop/release
ls -lh packages/desktop/release/VibeSmith-*.dmg
ls -lh packages/desktop/release/VibeSmith-*.zip
```

**Verify SHA256SUMS**:
```bash
cd packages/desktop/release
shasum -a 256 -c SHA256SUMS.txt
```

### 6. Improving Build Speed

**Using PyInstaller cache**:
```bash
# Only the first build is slow (2 minutes)
python3 build_api_executable.py

# Subsequent builds are fast (30 seconds)
```

**Parallelizing Web builds**:
```bash
# Parallel processing based on core count
npm run build -- --mode production
```

---

## Deployment Checklist

### Pre-release Checklist

- [ ] Update `package.json` version
- [ ] Write `CHANGELOG.md`
- [ ] Verify API executable works correctly
- [ ] Test builds on all platforms
- [ ] Test the packaged app
- [ ] Configure update server (electron-updater)
- [ ] Code sign (macOS, Windows)
- [ ] Notarization (macOS)

### GitHub Release

```bash
# Create tag
git tag v0.1.0
git push origin v0.1.0

# Create release and upload artifacts
gh release create v0.1.0 \
  packages/desktop/release/*.dmg \
  packages/desktop/release/*.zip \
  packages/desktop/release/*.exe \
  packages/desktop/release/*.AppImage
```

---

## Debug Logs

The Desktop runtime uses **JSON Lines (JSONL)** structured logging.

### Log Format

- File: `main.log` (one line = one event)
- Location: `~/Library/Logs/@vibesmith/desktop/`

### Required Fields

| Field | Type | Description |
| --- | --- | --- |
| `timestamp` | `string (ISO-8601)` | Event timestamp (UTC) |
| `level` | `error \| warn \| info \| debug` | Log level |
| `service` | `string` | Service identifier (`desktop-main`, `desktop-renderer`, `api`) |
| `process` | `string` | Process identifier (`main`, `renderer`, `api`, `updater`) |
| `event_name` | `string` | Event name (format: `{domain}.{action}.{result}`) |
| `session_id` | `string (UUID)` | Session identifier for app start-to-exit lifecycle |
| `attrs` | `object` | Additional event-specific data (`{}` if none) |

### Debug Mode

- Settings keys: `debug.enabled`, `debug.level`, `debug.expireAt`
- When Debug Mode is ON, the log level is elevated to `debug` and automatically reverts to `info` upon expiration
- Builds with `VIBESMITH_BUILD_FLAVOR=internal` default to `debug` log level

### Diagnostic Bundle

Generated as a ZIP file containing:
- `logs/main.log`, `logs/renderer.log`, `logs/api.log`, `logs/updater.log`
- `meta/system-info.json`, `meta/crash-dumps-meta.json`
- Sensitive data (`token`, `password`, `secret`, etc.) is masked with `***`; user home paths are anonymized as `${HOME}`

### Redaction Rules

The following values are never stored in plaintext in logs:
- Authentication tokens (`token`, `authorization`, `cookie`)
- Passwords/secrets (`password`, `secret`, `apiKey`)
- User home paths (masked)

---

## QA Checklist

### Automated Verification (During RC Build)

```bash
cd packages/desktop
export VIBESMITH_INTERNAL_SIGN=never
npm run type-check
npm run lint
npm run build:api-executable
npm run build
npm run pack:internal:unsigned
npm run test:e2e:desktop  # Optional
```

Success criteria: All commands exit with code 0; code signing/notarize is skipped as intended.

### Manual Verification (DMG Install)

- **Installation/First launch**: Mount DMG → Copy to Applications → Splash screen followed by main screen
- **API/Basic features**: `/api/health` responds normally, dashboard/settings render, project listing works
- **Updates**: No crash when calling `Check for updates`
- **Failure cases**: User-facing message on API launch failure, log file creation confirmed, no crash during quit/background transition

### Issue Priority Criteria

- `P0`: App cannot launch / Data loss / Repeated crashes
- `P1`: Core feature degradation (update failure, unstable API connection)
- `P2`: Non-core UI/text/minor regressions

---

## CI/CD

### Workflow Structure

```
.github/workflows/
├── ci-orchestrator.yml      # Change detection & orchestration
├── backend-ci.yml           # Python/FastAPI CI
├── frontend-ci.yml          # Reusable Workflow
└── security.yml             # Security scan (CodeQL, Safety, npm audit)
```

### Monorepo Optimization

- **Change detection**: `dorny/paths-filter` runs CI only for changed packages at the job level
- **Concurrency control**: New commits on the same PR automatically cancel previous runs
- **Caching**: Automatic pip/npm caching reduces build time by 40-80%
- **Cost**: Public repo = GitHub Actions completely free

### Security Scanning

- **CodeQL**: JavaScript, Python static analysis
- **Safety**: Python dependency vulnerability scanning
- **npm audit**: Node dependency vulnerability scanning
- Runs automatically every Monday + on PRs

### Distribution Channels

| Channel | Description |
|---------|-------------|
| GitHub Releases | Automatic build on tag push → DMG/ZIP upload |
| Homebrew Cask | Synced from the latest GitHub release to `aroido/homebrew-vibesmith` |
| Auto Update | electron-updater integrated with GitHub Releases |

### Version Management

Uses Semantic Versioning: `v{major}.{minor}.{patch}[-prerelease]`

---

## References

- [Electron Builder Official Docs](https://www.electron.build/)
- [PyInstaller Guide](https://pyinstaller.org/en/stable/)
- [electron-updater Configuration](https://www.electron.build/auto-update)
- [macOS Code Signing](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
