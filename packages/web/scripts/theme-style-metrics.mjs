#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');

const SOURCE_FILE_RE = /\.(ts|tsx|css)$/;
const EXCLUDE_RE = /(\.test\.|\.spec\.|\.d\.ts$|\/mocks\/|\/__tests__\/)/;

const HARD_CODED_COLOR_CLASS_RE = /\b(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|green|yellow|blue|cyan|purple|pink|emerald|amber|orange|lime|teal|sky|indigo|violet|fuchsia|rose)-\d{2,3}(?:\/\d{1,3})?\b/g;
const DARK_VARIANT_RE = /\bdark:/g;
const SEMANTIC_TOKEN_RE = /var\(--color-[a-z0-9-]+\)/g;
const INLINE_COLOR_STYLE_RE = /style\s*=\s*\{\{[^}]*\b(?:color|backgroundColor|borderColor)\b[^}]*\}\}/g;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (!SOURCE_FILE_RE.test(entry.name)) continue;
    if (EXCLUDE_RE.test(fullPath)) continue;
    files.push(fullPath);
  }

  return files;
}

function countMatches(content, re) {
  const matches = content.match(re);
  return matches ? matches.length : 0;
}

function rel(file) {
  return path.relative(process.cwd(), file);
}

function topN(list, key, n = 10) {
  return [...list]
    .filter((item) => item[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .slice(0, n);
}

async function main() {
  const files = await walk(ROOT);
  const rows = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    rows.push({
      file,
      hardcoded: countMatches(content, HARD_CODED_COLOR_CLASS_RE),
      darkVariant: countMatches(content, DARK_VARIANT_RE),
      semanticToken: countMatches(content, SEMANTIC_TOKEN_RE),
      inlineColorStyle: countMatches(content, INLINE_COLOR_STYLE_RE),
    });
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.hardcoded += row.hardcoded;
      acc.darkVariant += row.darkVariant;
      acc.semanticToken += row.semanticToken;
      acc.inlineColorStyle += row.inlineColorStyle;
      return acc;
    },
    { hardcoded: 0, darkVariant: 0, semanticToken: 0, inlineColorStyle: 0 }
  );

  console.log('Theme Style Metrics');
  console.log('===================');
  console.log(`files_scanned: ${rows.length}`);
  console.log(`hardcoded_color_classes: ${totals.hardcoded}`);
  console.log(`dark_variants: ${totals.darkVariant}`);
  console.log(`semantic_token_usages: ${totals.semanticToken}`);
  console.log(`inline_color_styles: ${totals.inlineColorStyle}`);

  console.log('\nTop hardcoded_color_classes files');
  for (const row of topN(rows, 'hardcoded')) {
    console.log(`- ${rel(row.file)}: ${row.hardcoded}`);
  }

  console.log('\nTop semantic_token_usages files');
  for (const row of topN(rows, 'semanticToken')) {
    console.log(`- ${rel(row.file)}: ${row.semanticToken}`);
  }

  console.log('\nTop dark_variants files');
  for (const row of topN(rows, 'darkVariant')) {
    console.log(`- ${rel(row.file)}: ${row.darkVariant}`);
  }

  const maxHardcoded = Number(process.env.MAX_HARDCODED_COLOR_CLASSES ?? Number.NaN);
  const maxDarkVariants = Number(process.env.MAX_DARK_VARIANTS ?? Number.NaN);
  const maxInlineColorStyles = Number(process.env.MAX_INLINE_COLOR_STYLES ?? Number.NaN);
  let hasFailure = false;

  if (!Number.isNaN(maxHardcoded) && totals.hardcoded > maxHardcoded) {
    console.error(
      `\nFAIL: hardcoded_color_classes ${totals.hardcoded} > MAX_HARDCODED_COLOR_CLASSES ${maxHardcoded}`
    );
    hasFailure = true;
  }

  if (!Number.isNaN(maxDarkVariants) && totals.darkVariant > maxDarkVariants) {
    console.error(
      `FAIL: dark_variants ${totals.darkVariant} > MAX_DARK_VARIANTS ${maxDarkVariants}`
    );
    hasFailure = true;
  }

  if (!Number.isNaN(maxInlineColorStyles) && totals.inlineColorStyle > maxInlineColorStyles) {
    console.error(
      `FAIL: inline_color_styles ${totals.inlineColorStyle} > MAX_INLINE_COLOR_STYLES ${maxInlineColorStyles}`
    );
    hasFailure = true;
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
