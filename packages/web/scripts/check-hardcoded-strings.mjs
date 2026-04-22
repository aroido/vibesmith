#!/usr/bin/env node

/**
 * 하드코딩 UI 문자열 탐지 스크립트
 *
 * - 한글: JSX/TS 소스에서 t() 없이 직접 사용된 한글 탐지
 * - 제외: locale JSON, 주석, t() 호출 내부, 테스트 expect, mock
 *
 * 사용: node scripts/check-hardcoded-strings.mjs [--strict]
 * --strict: 1건이라도 발견 시 exit 1 (CI 차단)
 * 기본: 경고만 출력, exit 0 (점진적 개선)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = join(__dirname, '../src');
const LOCALES_DIR = join(__dirname, '../src/i18n/locales');

// 한글 범위 (가-힣, ㄱ-ㅎ, ㅏ-ㅣ)
const KOREAN_REGEX = /[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]/;

/** 스캔 제외 경로 (테스트/목/상수/에러코드) */
function shouldSkip(filePath) {
  const rel = filePath.replace(SRC_DIR, '');
  if (rel.includes('locales/') || rel.includes('/locales/')) return true;
  if (rel.includes('__mocks__') || rel.includes('/mocks/')) return true;
  if (rel.endsWith('.json')) return true;
  if (/\.(test|spec)\.(tsx?|jsx?)$/.test(rel) || rel.includes('.integration.test.')) return true;
  if (rel.includes('/__tests__/') || rel.includes('i18n/__tests__')) return true;
  if (rel.includes('api-contract.test')) return true;
  if (rel.includes('common/constants/uiText') || rel.includes('common/api/client')) return true;
  if (rel.includes('common/utils/error-handler')) return true;
  if (rel.includes('services/mock') || rel.includes('Mock.ts') || rel.includes('mock-api')) return true;
  if (rel.includes('Mock.ts') || /Mock\.(ts|tsx)$/.test(rel)) return true;
  if (rel.includes('onboarding/data/')) return true;
  if (rel.includes('skill-conflict-detection/services/mock')) return true;
  // content-detection patterns (markdown section headers for diagnostics)
  if (rel.includes('diagnosticConstants')) return true;
  return false;
}

/** 주석 제거된 라인 반환 (간이) */
function stripComments(line) {
  const withoutLineComment = line.replace(/\/\/.*$/, '');
  return withoutLineComment.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 라인 내 한글 포함 여부 & t() 외부 사용 여부 */
function hasHardcodedKorean(line, lineNum) {
  if (!KOREAN_REGEX.test(line)) return null;

  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return null;

  const stripped = stripComments(line);
  if (!KOREAN_REGEX.test(stripped)) return null;

  // t('...'), i18n.t('...') 내부의 문자열은 키(보통 영문)이므로 제외
  const inTCall = /\bt\s*\(\s*['"`][^'"`]*[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f][^'"`]*['"`]/.test(line)
    || /\bi18n\.t\s*\(\s*['"`][^'"`]*[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f][^'"`]*['"`]/.test(line);
  if (inTCall) return null;

  // expect(...).toHaveTextContent('한글') 등 테스트 기대값은 허용
  if (/expect\s*\([^)]+\)\s*\.(toHaveTextContent|toContain|toEqual)\s*\(/.test(line)) return null;
  if (/\btoHaveTextContent\s*\(/.test(line) && line.includes("'") && KOREAN_REGEX.test(line)) return null;

  const snippet = line.replace(/\s+/g, ' ').slice(0, 80);
  return { lineNum, snippet };
}

/** 파일 수집 */
function getSourceFiles(dir) {
  const files = [];
  const entries = readdirSync(dir);
  for (const e of entries) {
    const full = join(dir, e);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!e.startsWith('.') && e !== 'node_modules' && e !== 'dist') {
        files.push(...getSourceFiles(full));
      }
    } else if (/\.(tsx?|jsx?)$/.test(e)) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const files = getSourceFiles(SRC_DIR).filter((f) => !shouldSkip(f));
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const relPath = file.replace(SRC_DIR + '/', '');

    for (let i = 0; i < lines.length; i++) {
      const result = hasHardcodedKorean(lines[i], i + 1);
      if (result) {
        violations.push({
          file: relPath,
          line: result.lineNum,
          snippet: result.snippet,
        });
      }
    }
  }

  const strict = process.argv.includes('--strict');

  if (violations.length > 0) {
    const header = strict ? '\n❌ 하드코딩 문자열 탐지 (CI 차단)\n' : '\n⚠️ 하드코딩 문자열 경고 (t() 권장)\n';
    console.error(header);
    const byFile = {};
    for (const v of violations) {
      if (!byFile[v.file]) byFile[v.file] = [];
      byFile[v.file].push(v);
    }
    for (const [file, items] of Object.entries(byFile)) {
      console.error(`  ${file}`);
      for (const { line, snippet } of items.slice(0, 5)) {
        console.error(`    L${line}: ${snippet}${snippet.length >= 80 ? '...' : ''}`);
      }
      if (items.length > 5) console.error(`    ... 외 ${items.length - 5}건`);
      console.error('');
    }
    console.error(`총 ${violations.length}건 하드코딩 의심`);
    console.error('\n→ t() 또는 i18n locale 키로 교체하세요.');
    if (strict) process.exit(1);
    console.error('\n(기본 모드: 경고만. CI에서 --strict 사용 시 실패)');
    return;
  }

  console.log('✅ 하드코딩 문자열 검증 통과 (한글 UI 문자열 미탐지)');
}

main();
