#!/bin/bash
# 코드 서명 설정 확인 스크립트

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}코드 서명 설정 확인${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 인증서 확인
echo -e "${BLUE}[1/4] 코드 서명 인증서 확인...${NC}"
CERT_COUNT=$(security find-identity -v -p codesigning | grep "Developer ID Application" | wc -l)

if [ $CERT_COUNT -eq 0 ]; then
  echo -e "${RED}❌ Developer ID Application 인증서를 찾을 수 없습니다${NC}"
  echo ""
  echo "해결 방법:"
  echo "  1. ./scripts/create-csr.sh 실행"
  echo "  2. https://developer.apple.com/account/resources/certificates/add"
  echo "  3. CSR 파일 업로드 후 .cer 파일 다운로드"
  echo "  4. .cer 파일 더블클릭하여 Keychain에 설치"
  exit 1
else
  echo -e "${GREEN}✓ Developer ID Application 인증서 발견${NC}"
  security find-identity -v -p codesigning | grep "Developer ID Application"
fi
echo ""

# 2. 환경변수 확인
echo -e "${BLUE}[2/4] 환경변수 확인...${NC}"

if [ ! -f ".env.local" ]; then
  echo -e "${RED}❌ .env.local 파일이 없습니다${NC}"
  echo ""
  echo "해결 방법:"
  echo "  cp .env.local.example .env.local"
  echo "  vi .env.local  # 실제 값 입력"
  exit 1
fi

source .env.local

APPLE_NOTARIZE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-${APPLE_ID_PASSWORD:-}}"

if [ -z "$APPLE_ID" ]; then
  echo -e "${RED}❌ APPLE_ID가 설정되지 않았습니다${NC}"
  exit 1
else
  echo -e "${GREEN}✓ APPLE_ID: $APPLE_ID${NC}"
fi

if [ -z "$APPLE_NOTARIZE_PASSWORD" ]; then
  echo -e "${RED}❌ APPLE_APP_SPECIFIC_PASSWORD 또는 APPLE_ID_PASSWORD가 설정되지 않았습니다${NC}"
  exit 1
else
  echo -e "${GREEN}✓ Apple app-specific password: ****-****-****-****${NC}"
fi

if [ -z "$APPLE_TEAM_ID" ]; then
  echo -e "${RED}❌ APPLE_TEAM_ID가 설정되지 않았습니다${NC}"
  exit 1
else
  echo -e "${GREEN}✓ APPLE_TEAM_ID: $APPLE_TEAM_ID${NC}"
fi
echo ""

# 3. Entitlements 파일 확인
echo -e "${BLUE}[3/4] Entitlements 파일 확인...${NC}"

if [ ! -f "resources/entitlements.mac.plist" ]; then
  echo -e "${RED}❌ entitlements.mac.plist 파일이 없습니다${NC}"
  exit 1
else
  echo -e "${GREEN}✓ entitlements.mac.plist 존재${NC}"
fi
echo ""

# 4. Notarize 스크립트 확인
echo -e "${BLUE}[4/4] Notarize 스크립트 확인...${NC}"

if [ ! -f "scripts/notarize.cjs" ]; then
  echo -e "${RED}❌ notarize.cjs 파일이 없습니다${NC}"
  exit 1
else
  echo -e "${GREEN}✓ notarize.cjs 존재${NC}"
fi

# @electron/notarize 패키지 확인
if ! npm list @electron/notarize >/dev/null 2>&1; then
  echo -e "${RED}❌ @electron/notarize 패키지가 설치되지 않았습니다${NC}"
  echo ""
  echo "해결 방법:"
  echo "  npm install --save-dev @electron/notarize"
  exit 1
else
  echo -e "${GREEN}✓ @electron/notarize 설치됨${NC}"
fi
echo ""

# 성공
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 코드 서명 설정 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "다음 단계:"
echo "  1. 환경변수 로드: source .env.local"
echo "  2. API 빌드: make build-api-executable"
echo "  3. Desktop 빌드: make dist-desktop-mac"
echo ""
echo "예상 소요 시간:"
echo "  - 빌드: 5-10분"
echo "  - Notarization: 5-30분 (Apple 서버 상태에 따라)"
