#!/usr/bin/env node
/**
 * i18n 검증 스크립트
 * - 하드코딩된 한글/영문 문자열 탐지
 * - 누락된 i18n 키 탐지
 * - locale 파일 키 불일치 탐지
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '../src');
const localesDir = path.join(srcDir, 'i18n/locales');

// 검사 대상 파일 확장자
const TARGET_EXTENSIONS = ['.tsx', '.ts'];

// 제외 패턴
const EXCLUDE_PATTERNS = [
  'node_modules',
  '__tests__',
  '.test.',
  '.spec.',
  'dist/',
  'build/',
  'coverage/',
  'i18n/locales/', // locale 파일 자체는 제외
  'mock', // Mock 파일 (mockApi.ts, mockData.ts 등)
  'mocks/', // Mock 핸들러 폴더
  'Mock.ts', // 파일명에 Mock이 포함된 경우 (sampleProjectMock.ts 등)
  'constants/uiText.ts', // UI 상수 파일 (레거시, 추후 제거 예정)
];

// 하드코딩 문자열 패턴 (간단한 정규식 기반)
const HARDCODED_STRING_PATTERNS = [
  // 한글 문자열 (따옴표 안)
  /['"`]([^'"`]*[\uAC00-\uD7AF]+[^'"`]*)['"`]/g,
  // 영어 문장 패턴 (대문자 시작, 공백 포함, 6자 이상)
  /['"`]([A-Z][a-z]+(\s+[A-Za-z]+){2,}[.!?]?)['"`]/g,
];

// locale 키 구조 검증
function validateLocaleStructure() {
  console.log('\n🔍 Validating locale structure...\n');
  
  const enDir = path.join(localesDir, 'en');
  const koDir = path.join(localesDir, 'ko');
  
  if (!fs.existsSync(enDir) || !fs.existsSync(koDir)) {
    console.error('❌ Missing locale directories');
    return false;
  }
  
  const enFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));
  const koFiles = fs.readdirSync(koDir).filter(f => f.endsWith('.json'));
  
  // 파일 목록 비교
  const enSet = new Set(enFiles);
  const koSet = new Set(koFiles);
  
  const onlyEn = enFiles.filter(f => !koSet.has(f));
  const onlyKo = koFiles.filter(f => !enSet.has(f));
  
  let hasErrors = false;
  
  if (onlyEn.length > 0) {
    console.error(`❌ Files only in en/: ${onlyEn.join(', ')}`);
    hasErrors = true;
  }
  
  if (onlyKo.length > 0) {
    console.error(`❌ Files only in ko/: ${onlyKo.join(', ')}`);
    hasErrors = true;
  }
  
  // 각 파일의 키 구조 비교
  const commonFiles = enFiles.filter(f => koSet.has(f));
  
  for (const file of commonFiles) {
    const enPath = path.join(enDir, file);
    const koPath = path.join(koDir, file);
    
    try {
      const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
      const koData = JSON.parse(fs.readFileSync(koPath, 'utf-8'));
      
      const enKeys = getAllKeys(enData);
      const koKeys = getAllKeys(koData);
      
      const enSet = new Set(enKeys);
      const koSet = new Set(koKeys);
      
      const onlyEnKeys = enKeys.filter(k => !koSet.has(k));
      const onlyKoKeys = koKeys.filter(k => !enSet.has(k));
      
      if (onlyEnKeys.length > 0 || onlyKoKeys.length > 0) {
        console.error(`\n❌ Key mismatch in ${file}:`);
        if (onlyEnKeys.length > 0) {
          console.error(`  Only in en: ${onlyEnKeys.join(', ')}`);
        }
        if (onlyKoKeys.length > 0) {
          console.error(`  Only in ko: ${onlyKoKeys.join(', ')}`);
        }
        hasErrors = true;
      }
    } catch (error) {
      console.error(`❌ Error parsing ${file}: ${error.message}`);
      hasErrors = true;
    }
  }
  
  if (!hasErrors) {
    console.log('✅ Locale structure is valid');
  }
  
  return !hasErrors;
}

// 객체의 모든 키를 평탄화
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// 하드코딩된 문자열 탐지
function findHardcodedStrings() {
  console.log('\n🔍 Scanning for hardcoded strings...\n');
  
  const results = [];
  
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(srcDir, fullPath);
      
      // 제외 패턴 확인
      if (EXCLUDE_PATTERNS.some(pattern => relativePath.includes(pattern))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && TARGET_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, lineNum) => {
          // 주석 제외
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            return;
          }
          
          // t() 함수 호출 제외
          if (line.includes('t(')) {
            return;
          }
          
          // import/export 문 제외
          if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
            return;
          }
          
          // 브라우저 에러 메시지 비교 패턴 제외
          if (line.includes('error.message ===') || line.includes('error.message !==')) {
            return;
          }
          
          // throw new Error() 패턴 제외 (기술적 에러 메시지)
          if (line.includes('throw new Error(')) {
            return;
          }
          
          // 하드코딩 문자열 탐지
          for (const pattern of HARDCODED_STRING_PATTERNS) {
            const matches = [...line.matchAll(pattern)];
            for (const match of matches) {
              const str = match[1];
              
              // 너무 짧은 문자열 제외 (3자 이하)
              if (str.length <= 3) continue;
              
              // 파일명, 경로, URL 등 제외
              if (str.includes('/') || str.includes('.') && str.length < 20) continue;
              
              // 상수명 같은 것 제외
              if (/^[A-Z_]+$/.test(str)) continue;
              
              // 마크다운 헤더 패턴 제외
              if (str.startsWith('##')) continue;
              
              results.push({
                file: relativePath,
                line: lineNum + 1,
                content: str.trim(),
              });
            }
          }
        });
      }
    }
  }
  
  scanDirectory(srcDir);
  
  // 결과 요약
  const fileCount = new Set(results.map(r => r.file)).size;
  
  console.log(`Found ${results.length} hardcoded strings in ${fileCount} files\n`);
  
  if (results.length > 0) {
    // 파일별로 그룹화
    const byFile = {};
    for (const result of results) {
      if (!byFile[result.file]) {
        byFile[result.file] = [];
      }
      byFile[result.file].push(result);
    }
    
    // 상위 10개 파일만 출력
    const topFiles = Object.entries(byFile)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);
    
    console.log('Top 10 files with hardcoded strings:');
    for (const [file, items] of topFiles) {
      console.log(`\n📄 ${file} (${items.length} strings)`);
      items.slice(0, 3).forEach(item => {
        console.log(`  Line ${item.line}: "${item.content.substring(0, 60)}${item.content.length > 60 ? '...' : ''}"`);
      });
      if (items.length > 3) {
        console.log(`  ... and ${items.length - 3} more`);
      }
    }
  }
  
  return results.length === 0;
}

// 메인 실행
function main() {
  console.log('='.repeat(60));
  console.log('🌐 i18n Validation Check');
  console.log('='.repeat(60));
  
  const structureValid = validateLocaleStructure();
  const noHardcoded = findHardcodedStrings();
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Locale structure: ${structureValid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Hardcoded strings: ${noHardcoded ? '✅ NONE' : '⚠️  FOUND'}`);
  console.log('='.repeat(60));
  
  // 구조 오류만 실패로 처리 (하드코딩은 경고만)
  if (!structureValid) {
    process.exit(1);
  }
  
  if (!noHardcoded) {
    console.log('\n⚠️  Hardcoded strings detected. Please use i18n keys instead.');
    console.log('💡 Run this script regularly to track progress.');
  }
  
  process.exit(0);
}

main();
