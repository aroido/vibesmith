#!/usr/bin/env node
/**
 * API 계약 검증 스크립트
 * 
 * docs/api/spec.md에서 엔드포인트 목록을 추출하고,
 * MSW 핸들러와 비교하여 누락된 엔드포인트를 감지합니다.
 * 
 * Usage:
 *   node scripts/check-api-contract.js
 * 
 * Exit Codes:
 *   0: 모든 엔드포인트가 핸들러에 존재
 *   1: 누락된 엔드포인트 발견
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 색상 출력 헬퍼
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  gray: (msg) => console.log(`${colors.gray}${msg}${colors.reset}`),
};

/**
 * docs/api/spec.md에서 구현된 엔드포인트 목록 추출
 */
function parseApiSpec() {
  const specPath = path.resolve(__dirname, '../../../docs/api/spec.md');
  
  if (!fs.existsSync(specPath)) {
    log.error(`API 스펙 파일을 찾을 수 없습니다: ${specPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(specPath, 'utf-8');
  const lines = content.split('\n');
  
  const endpoints = [];
  
  // "구현 상태" 테이블 파싱
  let inTable = false;
  for (const line of lines) {
    // 테이블 시작 감지
    if (line.includes('| 엔드포인트 | 상태 | 비고 |')) {
      inTable = true;
      continue;
    }
    
    // 테이블 끝 감지
    if (inTable && (line.trim() === '' || line.startsWith('#'))) {
      break;
    }
    
    // 테이블 행 파싱
    if (inTable && line.startsWith('|')) {
      const match = line.match(/\|\s*`([A-Z]+)\s+([^`]+)`\s*\|\s*✅/);
      if (match) {
        const [, method, path] = match;
        endpoints.push({ method, path: path.trim() });
      }
    }
  }
  
  return endpoints;
}

/**
 * MSW 핸들러에서 구현된 엔드포인트 목록 추출
 */
function parseHandlers() {
  const handlersDir = path.resolve(__dirname, '../src/mocks/handlers');
  
  if (!fs.existsSync(handlersDir)) {
    log.error(`핸들러 디렉토리를 찾을 수 없습니다: ${handlersDir}`);
    process.exit(1);
  }
  
  const endpoints = [];
  const files = fs.readdirSync(handlersDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  
  log.gray(`  → ${files.length}개 핸들러 파일 발견: ${files.join(', ')}`);
  
  for (const file of files) {
    const filePath = path.join(handlersDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // http.get, http.post 등 패턴 추출
    const methodPatterns = ['get', 'post', 'put', 'delete', 'patch'];
    
    for (const method of methodPatterns) {
      // 단순 패턴: http.get('...') 형태 매치
      const regex = new RegExp(`http\\.${method}\\(['"\`]([^'"\`]+)['"\`]`, 'g');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        let fullPath = match[1];
        
        // 와일드카드 제거
        fullPath = fullPath.replace(/^\*\//, '/');
        
        // /api/로 시작하는 것만 처리
        if (!fullPath.startsWith('/api/')) {
          continue;
        }
        
        // 파라미터 정규화 (:id → {id})
        const normalizedPath = fullPath.replace(/:(\w+)/g, '{$1}');
        
        endpoints.push({
          method: method.toUpperCase(),
          path: normalizedPath,
          file: file,
        });
        log.gray(`    → ${file}: ${method.toUpperCase()} ${normalizedPath}`);
      }
    }
  }
  
  return endpoints;
}

/**
 * 두 엔드포인트가 일치하는지 확인
 */
function matchesEndpoint(specEndpoint, handlerEndpoint) {
  if (specEndpoint.method !== handlerEndpoint.method) {
    return false;
  }
  
  // 경로 정규화 (파라미터 무시)
  const normalizePath = (p) => {
    return p
      .replace(/\{[^}]+\}/g, '{param}') // {id}, {project_id} 등을 {param}으로 통일
      .replace(/\/+/g, '/') // 중복 슬래시 제거
      .replace(/\/$/, ''); // 끝 슬래시 제거
  };
  
  return normalizePath(specEndpoint.path) === normalizePath(handlerEndpoint.path);
}

/**
 * 메인 검증 로직
 */
function main() {
  log.info('API 계약 검증 시작...\n');
  
  // 1. API 스펙 파싱
  log.info('Step 1: API 스펙 파싱 (docs/api/spec.md)');
  const specEndpoints = parseApiSpec();
  log.success(`${specEndpoints.length}개 엔드포인트 발견\n`);
  
  // 2. MSW 핸들러 파싱
  log.info('Step 2: MSW 핸들러 파싱 (src/mocks/handlers/)');
  const handlerEndpoints = parseHandlers();
  log.success(`${handlerEndpoints.length}개 핸들러 발견\n`);
  
  // 3. 누락된 엔드포인트 감지
  log.info('Step 3: 엔드포인트 일치 검증');
  const missing = [];
  const matched = [];
  
  for (const specEp of specEndpoints) {
    const found = handlerEndpoints.some(handlerEp => matchesEndpoint(specEp, handlerEp));
    
    if (found) {
      matched.push(specEp);
      log.gray(`  ✓ ${specEp.method} ${specEp.path}`);
    } else {
      missing.push(specEp);
      log.error(`  ✗ ${specEp.method} ${specEp.path} — 핸들러 없음`);
    }
  }
  
  console.log('');
  
  // 4. 결과 요약
  if (missing.length === 0) {
    log.success(`모든 API 엔드포인트가 MSW 핸들러에 구현되어 있습니다! (${matched.length}/${specEndpoints.length})`);
    process.exit(0);
  } else {
    log.error(`${missing.length}개의 엔드포인트가 MSW 핸들러에 누락되었습니다:`);
    console.log('');
    
    for (const ep of missing) {
      console.log(`  ${colors.red}✗${colors.reset} ${ep.method} ${ep.path}`);
    }
    
    console.log('');
    log.info('다음 작업을 수행하세요:');
    console.log('  1. packages/web/src/mocks/handlers/ 에 핸들러 추가');
    console.log('  2. packages/web/src/mocks/__tests__/api-contract.test.ts 에 테스트 추가');
    console.log('  3. npm run test:contract 로 검증');
    console.log('');
    log.info('참고 문서: docs/features/api-contract-testing/implementation-guide.md');
    
    process.exit(1);
  }
}

main();
