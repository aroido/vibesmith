#!/usr/bin/env bash
set -euo pipefail

# Quality Gate - 커밋 전 필수 검증
# 사용법: ./scripts/quality-gate.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/packages/web"

echo "🔍 Quality Gate 실행 중..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 테스트 실행
echo "📝 1/4: 테스트 실행..."
cd "$WEB_DIR"
if npm test; then
    echo "✅ 테스트 통과"
else
    echo "❌ 테스트 실패!"
    echo ""
    echo "다음 명령어로 수정 후 재시도:"
    echo "  cd packages/web && npm test"
    exit 1
fi
echo ""

# 2. 린트 검사
echo "🔍 2/4: 린트 검사..."
if npm run lint; then
    echo "✅ 린트 통과"
else
    echo "❌ 린트 에러 발견!"
    echo ""
    echo "다음 명령어로 자동 수정 시도:"
    echo "  cd packages/web && npm run lint:fix"
    exit 1
fi
echo ""

# 3. 타입 체크
echo "🔍 3/4: 타입 체크..."
if npm run type-check; then
    echo "✅ 타입 체크 통과"
else
    echo "❌ 타입 에러 발견!"
    echo ""
    echo "타입 에러를 수정한 후 재시도하세요."
    exit 1
fi
echo ""

# 4. 빌드 테스트
echo "🏗️ 4/4: 빌드 테스트..."
if npm run build; then
    echo "✅ 빌드 성공"
else
    echo "❌ 빌드 실패!"
    echo ""
    echo "빌드 에러를 수정한 후 재시도하세요."
    exit 1
fi
echo ""

# 성공
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Quality Gate 통과!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "이제 커밋 가능합니다:"
echo "  git add -A"
echo "  git commit -m 'feat: ...'"
echo ""

exit 0
