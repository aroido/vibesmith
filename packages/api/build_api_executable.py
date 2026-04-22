#!/usr/bin/env python3
"""FastAPI 실행 파일 빌드 스크립트

PyInstaller를 사용하여 FastAPI 앱을 단일 실행 파일로 번들링합니다.
"""

import shutil
import subprocess
import sys
from pathlib import Path


def main():
    """빌드 메인 함수"""
    print("🔨 Building FastAPI executable...")
    print()

    # 1. 이전 빌드 정리
    print("📦 Step 1/5: Cleaning previous build...")
    api_dir = Path(__file__).parent
    build_dir = api_dir / "build"
    dist_dir = api_dir / "dist"
    spec_file = api_dir / "vibesmith-api.spec"

    if build_dir.exists():
        shutil.rmtree(build_dir)
        print("   ✓ Removed build/")

    if dist_dir.exists():
        shutil.rmtree(dist_dir)
        print("   ✓ Removed dist/")

    if spec_file.exists():
        spec_file.unlink()
        print("   ✓ Removed vibesmith-api.spec")

    print()

    # 2. PyInstaller 실행
    print("📦 Step 2/5: Running PyInstaller...")
    pyinstaller_cmd = None

    preferred_pyinstaller = api_dir / ".venv-pure" / "bin" / "pyinstaller"
    if preferred_pyinstaller.exists():
        pyinstaller_cmd = [str(preferred_pyinstaller)]
    else:
        active_venv_pyinstaller = Path(sys.executable).with_name("pyinstaller")
        if active_venv_pyinstaller.exists():
            pyinstaller_cmd = [str(active_venv_pyinstaller)]
        else:
            path_pyinstaller = shutil.which("pyinstaller")
            if path_pyinstaller:
                pyinstaller_cmd = [path_pyinstaller]

    if pyinstaller_cmd is None:
        print("   ❌ PyInstaller executable not found")
        print("   Install pyinstaller in .venv-pure or the active virtualenv")
        sys.exit(1)

    cmd = pyinstaller_cmd + [
        "--onefile",
        "--name",
        "vibesmith-api",
        "--distpath",
        "dist",
        "--workpath",
        "build",
        "--specpath",
        ".",
        "--collect-all",
        "fastapi",
        "--collect-all",
        "starlette",
        "--collect-all",
        "pydantic",
        "--collect-all",
        "pydantic_core",
        "--collect-all",
        "uvicorn",
        "--collect-all",
        "slowapi",
        "--collect-all",
        "passlib",
        "--collect-all",
        "jose",
        "--collect-all",
        "structlog",
        "--collect-all",
        "watchdog",
        "--collect-all",
        "yaml",
        "--collect-all",
        "jinja2",
        "--collect-all",
        "httpx",
        "--collect-data",
        "vibesmith_api",
        "--collect-all",
        "vibesmith_core",
        "--paths",
        "../core",
        "vibesmith_api/run_server.py",
    ]

    try:
        result = subprocess.run(cmd, cwd=api_dir, check=True)
        print("   ✓ PyInstaller completed")
    except subprocess.CalledProcessError as e:
        print(f"   ❌ PyInstaller failed: {e}")
        sys.exit(1)

    print()

    # 3. 파일 크기 확인
    print("📦 Step 3/5: Checking file size...")
    executable = dist_dir / "vibesmith-api"

    if not executable.exists():
        print("   ❌ Executable not found")
        sys.exit(1)

    size_bytes = executable.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    print(f"   ✓ Size: {size_mb:.1f} MB")

    if size_mb > 100:
        print(f"   ⚠️  Warning: File size is large (>{size_mb:.1f} MB)")

    print()

    # 4. 실행 권한 설정
    print("📦 Step 4/5: Setting execute permissions...")
    executable.chmod(0o755)
    print("   ✓ chmod +x vibesmith-api")

    print()

    # 5. 간단한 실행 테스트
    print("📦 Step 5/5: Testing executable...")
    try:
        result = subprocess.run(
            [str(executable), "--self-check"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            print("   ✓ Executable runs successfully")
        else:
            print("   ⚠️  Executable started but check stderr")
            if result.stdout:
                print(f"      stdout: {result.stdout.strip()}")
            if result.stderr:
                print(f"      stderr: {result.stderr.strip()}")
    except subprocess.TimeoutExpired:
        print("   ❌ Executable self-check timed out")
        sys.exit(1)
    except Exception as e:
        print(f"   ❌ Could not test executable: {e}")
        sys.exit(1)

    print()
    print("✅ Build complete!")
    print(f"   Output: {executable}")
    print()
    print("Next steps:")
    print("   1. Test: ./dist/vibesmith-api")
    print("   2. Verify: curl http://localhost:8000/api/projects")


if __name__ == "__main__":
    main()
