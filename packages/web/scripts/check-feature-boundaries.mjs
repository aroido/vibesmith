#!/usr/bin/env node

/**
 * Feature Boundary Checker
 * 
 * Feature-based 아키텍처의 경계 규칙을 검증합니다.
 * 
 * 규칙:
 * 1. features 내부에서 다른 feature를 직접 import 금지
 * 2. pages는 feature의 루트 index만 import 가능 (@/features/{feature})
 * 3. feature 내부 경로 직접 import 금지 (@/features/{feature}/services/...)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = join(__dirname, '../src');
const FEATURES_DIR = join(SRC_DIR, 'features');
const PAGES_DIR = join(SRC_DIR, 'pages');

// 경계 위반 패턴
const VIOLATIONS = {
  CROSS_FEATURE_IMPORT: 'cross-feature-import',
  INTERNAL_PATH_IMPORT: 'internal-path-import',
};

// 결과 저장
const violations = [];

/**
 * 디렉토리 내 모든 TypeScript 파일 재귀 탐색
 */
function getAllTsFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = readdirSync(currentDir);
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // node_modules, dist 등 제외
        if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
          traverse(fullPath);
        }
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * 파일에서 import 문 추출
 */
function extractImports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const imports = [];
  
  // import 문 정규식
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
  
  let match;
  let lineNumber = 1;
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
    
    let lineMatch;
    while ((lineMatch = lineImportRegex.exec(line)) !== null) {
      imports.push({
        path: lineMatch[1],
        line: i + 1,
      });
    }
  }
  
  return imports;
}

/**
 * feature 이름 추출
 */
function getFeatureName(filePath) {
  const relativePath = relative(FEATURES_DIR, filePath);
  const parts = relativePath.split('/');
  return parts[0];
}

/**
 * features 내부 파일 검사
 */
function checkFeaturesDirectory() {
  const files = getAllTsFiles(FEATURES_DIR);
  
  for (const file of files) {
    const currentFeature = getFeatureName(file);
    const imports = extractImports(file);
    
    for (const imp of imports) {
      const importPath = imp.path;
      
      // @/features 또는 @features로 시작하는 import만 검사
      if (importPath.startsWith('@/features/') || importPath.startsWith('@features/')) {
        const cleanPath = importPath.replace(/^@\/features\/|^@features\//, '');
        const targetFeature = cleanPath.split('/')[0];
        
        // 규칙 1: 다른 feature import 금지 (공유 feature는 예외)
        const sharedFeatures = ['tag-management', 'skill-conflict-detection', 'global-search', 'document-viewer'];
        if (targetFeature !== currentFeature && !sharedFeatures.includes(targetFeature)) {
          violations.push({
            type: VIOLATIONS.CROSS_FEATURE_IMPORT,
            file: relative(SRC_DIR, file),
            line: imp.line,
            import: importPath,
            message: `Feature "${currentFeature}"에서 다른 feature "${targetFeature}"를 직접 import할 수 없습니다.`,
          });
        }
        
        // 규칙 2: feature 내부 경로 import 금지 (자기 자신 제외)
        const pathParts = cleanPath.split('/');
        if (pathParts.length > 1 && targetFeature === currentFeature) {
          // 자기 feature 내부에서는 상대 경로 사용 권장
          violations.push({
            type: VIOLATIONS.INTERNAL_PATH_IMPORT,
            file: relative(SRC_DIR, file),
            line: imp.line,
            import: importPath,
            message: `Feature 내부에서는 절대 경로 대신 상대 경로를 사용하세요. (예: './services/...')`,
          });
        }
      }
    }
  }
}

/**
 * pages 디렉토리 검사
 */
function checkPagesDirectory() {
  const files = getAllTsFiles(PAGES_DIR);
  
  for (const file of files) {
    const imports = extractImports(file);
    
    for (const imp of imports) {
      const importPath = imp.path;
      
      // @/features 또는 @features로 시작하는 import만 검사
      if (importPath.startsWith('@/features/') || importPath.startsWith('@features/')) {
        const cleanPath = importPath.replace(/^@\/features\/|^@features\//, '');
        const pathParts = cleanPath.split('/');
        
        // 규칙 3: pages는 feature 루트만 import 가능
        if (pathParts.length > 1) {
          violations.push({
            type: VIOLATIONS.INTERNAL_PATH_IMPORT,
            file: relative(SRC_DIR, file),
            line: imp.line,
            import: importPath,
            message: `Pages에서는 feature의 루트 index만 import할 수 있습니다. (예: '@/features/${pathParts[0]}')`,
          });
        }
      }
    }
  }
}

/**
 * 결과 출력
 */
function printResults() {
  if (violations.length === 0) {
    console.log('✅ Feature boundary 검사 통과! 위반 사항이 없습니다.');
    return true;
  }
  
  console.error(`❌ Feature boundary 위반 ${violations.length}건 발견:\n`);
  
  // 파일별로 그룹화
  const byFile = {};
  for (const v of violations) {
    if (!byFile[v.file]) {
      byFile[v.file] = [];
    }
    byFile[v.file].push(v);
  }
  
  // 출력
  for (const [file, fileViolations] of Object.entries(byFile)) {
    console.error(`📄 ${file}`);
    for (const v of fileViolations) {
      console.error(`  Line ${v.line}: ${v.message}`);
      console.error(`    Import: ${v.import}`);
      console.error('');
    }
  }
  
  console.error(`총 ${violations.length}건의 위반 사항을 수정해주세요.\n`);
  console.error('규칙:');
  console.error('  1. features 내부에서 다른 feature를 직접 import 금지');
  console.error('  2. feature 내부에서는 상대 경로 사용');
  console.error('  3. pages는 feature의 루트 index만 import');
  
  return false;
}

/**
 * 메인 실행
 */
function main() {
  console.log('🔍 Feature boundary 검사 시작...\n');
  
  try {
    checkFeaturesDirectory();
    checkPagesDirectory();
    
    const success = printResults();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 검사 중 오류 발생:', error.message);
    process.exit(1);
  }
}

main();
