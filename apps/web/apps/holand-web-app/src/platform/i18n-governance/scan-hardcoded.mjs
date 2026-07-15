#!/usr/bin/env node
/**
 * Scan src/app/shared and src/components for hardcoded UI strings (heuristic).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = path.resolve(__dirname, '../..');
const SCAN_DIRS = [
  path.join(APP_SRC, 'app/shared'),
  path.join(APP_SRC, 'components'),
  // Phase F (Production Hardening / WS-F): the release-readiness target routes live
  // under app/(hydrogen)/career-guidance and were previously untouched by this scan,
  // so hardcoded strings in the actual assessment/history/report/counselor/expert-lab
  // pages went undetected. Scope the addition to career-guidance to avoid pulling in
  // unrelated template modules (chat, projects, one-search, admin-pipeline, etc.).
  path.join(APP_SRC, 'app/(hydrogen)/career-guidance'),
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      walk(full, files);
    } else if (/\.(tsx|ts)$/.test(name) && !name.endsWith('.stories.tsx')) {
      files.push(full);
    }
  }
  return files;
}

function scanFile(filePath) {
  const rel = path.relative(APP_SRC, filePath).replace(/\\/g, '/');
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('t(') || line.includes('useTranslation') || line.includes('i18n')) continue;
    if (line.trim().startsWith('//') || line.includes('import ')) continue;

    // Latin-script hardcoded JSX text (e.g. "Add new card").
    const jsxMatchLatin = line.match(/>\s*([A-Z][a-zA-Z]{2,}[^<{]*)/);
    // Persian/Arabic-script hardcoded JSX text (e.g. "مرکز آزمون‌ها"). The original
    // heuristic only matched a Latin capital start, so entire RTL pages with no i18n
    // integration at all (plain Persian strings) were previously invisible to this scan.
    const jsxMatchFa = line.match(/>\s*([\u0600-\u06FF][^<{]{2,})/);
    if (jsxMatchLatin || jsxMatchFa) {
      hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) });
    }
  }
  return hits;
}

export function scanHardcodedStrings() {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  return files.flatMap(scanFile);
}
