#!/usr/bin/env node

/**
 * i18n 키 존재 검증 스크립트
 *
 * t('ns:key') / t("ns:key") / i18n.t('ns:key') 호출을 파싱하여
 * 해당 키가 ko/en locale JSON에 모두 존재하는지 검증합니다.
 *
 * 사용: node scripts/check-i18n-keys.mjs
 * 실패 시 exit 1 (CI 차단)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = join(__dirname, '../src');
const LOCALES_DIR = join(__dirname, '../src/i18n/locales');
const NAMESPACES = ['common', 'navigation', 'dashboard', 'components', 'settings', 'trash', 'dependencyGraph', 'scan', 'projectDetail', 'globalSearch'];

/**
 * JSON 파일을 재귀적으로 평탄화 (ns.key.path 형식)
 */
function flattenObj(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function') {
      Object.assign(result, flattenObj(v, key));
    } else {
      result[key] = v;
    }
  }
  return result;
}

/**
 * locale 폴더에서 모든 키 로드 (namespace.key 형식)
 */
function loadLocaleKeys(lang) {
  const langDir = join(LOCALES_DIR, lang);
  const keys = {};
  for (const ns of NAMESPACES) {
    const filePath = join(langDir, `${ns}.json`);
    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const flat = flattenObj(data);
      for (const k of Object.keys(flat)) {
        keys[`${ns}:${k}`] = true;
      }
    } catch (e) {
      console.error(`Failed to load ${lang}/${ns}.json:`, e.message);
      process.exit(1);
    }
  }
  return keys;
}

/**
 * 소스 파일에서 t('key') / t("key") / i18n.t('key') 호출 추출
 */
function extractTKeys(content) {
  const keys = new Set();
  // t('ns:key') t("ns:key") t(`ns:key`)
  const patterns = [
    /\bt\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\bi18n\.t\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const re of patterns) {
    let m;
    const copy = new RegExp(re.source, re.flags);
    while ((m = copy.exec(content)) !== null) {
      let key = m[1];
      // 동적 키(템플릿 리터럴 보간) 제외 — 정적 검증 불가
      if (key.includes('${')) continue;
      if (key.includes('{{')) continue;
      // 옵션 객체가 있는 경우: t('key', { ... }) - key만 추출
      if (key.includes(',')) key = key.split(',')[0].trim();
      if (key && (key.includes(':') || key.startsWith('common.') || key.startsWith('dashboard.'))) {
        keys.add(key);
      } else if (key && !key.startsWith('{{')) {
        keys.add(key);
      }
    }
  }
  return keys;
}

const PLURAL_SUFFIXES = ['_one', '_other', '_zero', '_few', '_many', '_two'];

/**
 * 키 존재 여부 (복수형 포함 - i18next pluralization)
 */
function keyExists(keys, fullKey) {
  if (keys[fullKey]) return true;
  const lastDot = fullKey.lastIndexOf('.');
  if (lastDot < 0) return false;
  const base = fullKey.slice(0, lastDot);
  const leaf = fullKey.slice(lastDot + 1);
  for (const suffix of PLURAL_SUFFIXES) {
    if (leaf.endsWith(suffix)) return false;
    if (keys[`${base}.${leaf}${suffix}`]) return true;
  }
  return false;
}

/**
 * 키가 ko, en 모두에 존재하는지 검증
 * namespace가 없으면(useTranslation ns 사용) 모든 ns 후보 탐색
 */
function validateKey(key, koKeys, enKeys) {
  const normalized = key.includes(':') ? key : null;
  if (normalized) {
    const inKo = keyExists(koKeys, normalized) || !!koKeys[normalized];
    const inEn = keyExists(enKeys, normalized) || !!enKeys[normalized];
    return { normalized, inKo, inEn };
  }
  for (const ns of NAMESPACES) {
    const candidate = `${ns}:${key}`;
    const inKo = keyExists(koKeys, candidate) || !!koKeys[candidate];
    const inEn = keyExists(enKeys, candidate) || !!enKeys[candidate];
    if (inKo && inEn) return { normalized: candidate, inKo: true, inEn: true };
  }
  const fallback = `common:${key}`;
  return {
    normalized: fallback,
    inKo: keyExists(koKeys, fallback) || !!koKeys[fallback],
    inEn: keyExists(enKeys, fallback) || !!enKeys[fallback],
  };
}

/**
 * src 내 ts/tsx 파일 재귀 수집 (테스트/스토리북 제외 옵션)
 */
function getSourceFiles(dir, includeTests = true) {
  const files = [];
  const entries = readdirSync(dir);
  for (const e of entries) {
    const full = join(dir, e);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!e.startsWith('.') && e !== 'node_modules' && e !== 'dist') {
        files.push(...getSourceFiles(full, includeTests));
      }
    } else if (/\.(tsx?|jsx?|mts|mjs)$/.test(e)) {
      if (includeTests || !/(\.test\.|\.spec\.|__tests__|__mocks__)/.test(full)) {
        files.push(full);
      }
    }
  }
  return files;
}

/** 테스트/스펙에서 의도적으로 사용하는 키 (누락 허용) */
const ALLOWED_MISSING_KEYS = new Set([
  'common:nonexistent.key', // i18n fallback 테스트
]);

function main() {
  const koKeys = loadLocaleKeys('ko');
  const enKeys = loadLocaleKeys('en');

  const files = getSourceFiles(SRC_DIR, true);
  const errors = [];
  const checked = new Set();

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const keys = extractTKeys(content);
    const relPath = file.replace(SRC_DIR + '/', '');

    for (const key of keys) {
      if (checked.has(key)) continue;
      const { normalized, inKo, inEn } = validateKey(key, koKeys, enKeys);
      checked.add(key);

      if (ALLOWED_MISSING_KEYS.has(normalized)) continue;
      if (!inKo) {
        errors.push({ file: relPath, key: normalized, lang: 'ko' });
      }
      if (!inEn) {
        errors.push({ file: relPath, key: normalized, lang: 'en' });
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ i18n 키 검증 실패 (CI 차단)\n');
    const byKey = {};
    for (const e of errors) {
      const k = e.key;
      if (!byKey[k]) byKey[k] = { langs: [], files: [] };
      if (!byKey[k].langs.includes(e.lang)) byKey[k].langs.push(e.lang);
      if (!byKey[k].files.includes(e.file)) byKey[k].files.push(e.file);
    }
    for (const [key, info] of Object.entries(byKey)) {
      console.error(`  키 누락: ${key}`);
      console.error(`    locale: ${info.langs.join(', ')}`);
      console.error(`    사용처: ${info.files.slice(0, 3).join(', ')}${info.files.length > 3 ? '...' : ''}`);
      console.error('');
    }
    console.error(`총 ${errors.length}건 키 누락`);
    process.exit(1);
  }

  console.log('✅ i18n 키 검증 통과 (모든 t() 키가 ko/en locale에 존재)');
}

main();
