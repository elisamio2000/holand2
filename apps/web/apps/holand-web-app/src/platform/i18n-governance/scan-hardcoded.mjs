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

    const jsxMatch = line.match(/>\s*([A-Z][a-zA-Z]{2,}[^<{]*)/);
    if (jsxMatch) {
      hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) });
    }
  }
  return hits;
}

export function scanHardcodedStrings() {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  return files.flatMap(scanFile);
}
