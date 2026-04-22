#!/bin/bash
# VibeSmith Desktop 통합 빌드 스크립트
# API 실행 파일 + Electron 빌드 + 패키징

set -e # 에러 발생 시 중단

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VibeSmith Desktop 통합 빌드${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. API 실행 파일 빌드
echo -e "${BLUE}[1/5] API 실행 파일 빌드 중...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$DESKTOP_DIR")")"

cd "${PROJECT_ROOT}/packages/api"
if [ ! -f "build_api_executable.py" ]; then
    echo -e "${RED}❌ build_api_executable.py not found${NC}"
    exit 1
fi

python3 build_api_executable.py
if [ ! -f "dist/vibesmith-api" ]; then
    echo -e "${RED}❌ API executable build failed${NC}"
    exit 1
fi

API_SIZE=$(du -h dist/vibesmith-api | cut -f1)
echo -e "${GREEN}✓ API 실행 파일 빌드 완료 (${API_SIZE})${NC}"
echo ""

# 2. Web 빌드
echo -e "${BLUE}[2/5] Web 빌드 중...${NC}"
cd "${PROJECT_ROOT}/packages/web"
npm run build
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Web build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Web 빌드 완료${NC}"
echo ""

# 3. Desktop 빌드 (TypeScript → JavaScript)
echo -e "${BLUE}[3/5] Desktop 빌드 중...${NC}"
cd "${PROJECT_ROOT}/packages/desktop"
npm run build
if [ ! -d "out" ]; then
    echo -e "${RED}❌ Desktop build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Desktop 빌드 완료${NC}"
echo ""

# 4. 아티팩트 검증
echo -e "${BLUE}[4/5] 아티팩트 검증 중...${NC}"

# API 실행 파일 검증
if [ ! -f "${PROJECT_ROOT}/packages/api/dist/vibesmith-api" ]; then
    echo -e "${RED}❌ API executable not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ API executable: ${PROJECT_ROOT}/packages/api/dist/vibesmith-api${NC}"

# Web 빌드 검증
if [ ! -d "${PROJECT_ROOT}/packages/web/dist" ]; then
    echo -e "${RED}❌ Web dist not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Web dist: ${PROJECT_ROOT}/packages/web/dist${NC}"

# Desktop out 검증
if [ ! -d "out" ]; then
    echo -e "${RED}❌ Desktop out not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Desktop out: out/${NC}"

# splash.html 검증
if [ ! -f "resources/splash.html" ]; then
    echo -e "${RED}❌ Splash screen not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Splash screen: resources/splash.html${NC}"

echo ""

# 5. 패키징 (선택)
if [ "$1" = "--package" ]; then
    echo -e "${BLUE}[5/5] Electron 패키징 중...${NC}"
    
    # Platform 선택
    if [ "$2" = "mac" ]; then
        npm run dist:mac
    elif [ "$2" = "win" ]; then
        npm run dist:win
    elif [ "$2" = "linux" ]; then
        npm run dist:linux
    else
        npm run dist
    fi
    
    if [ ! -d "release" ]; then
        echo -e "${RED}❌ Packaging failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ 패키징 완료: release/${NC}"
    ls -lh release/
else
    echo -e "${YELLOW}[5/5] 패키징 건너뛰기 (--package 옵션 없음)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 빌드 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "다음 단계:"
echo "  1. 개발 모드 테스트: npm run dev"
echo "  2. 패키징: ./scripts/build.sh --package [mac|win|linux]"
echo "  3. 배포: make dist-desktop-mac (또는 win/linux)"
