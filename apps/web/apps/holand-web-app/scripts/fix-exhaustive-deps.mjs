/**
 * Add missing hook dependencies reported by eslint for common stable identifiers.
 * Usage: node scripts/fix-exhaustive-deps.mjs
 */
import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const ROOT = process.cwd();

function runLintJson() {
  const lintFile = path.join(ROOT, 'lint.json');
  try {
    execSync('pnpm exec eslint src --format json -o lint.json', {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch {
    // eslint exits non-zero when warnings/errors exist
  }
  if (!fs.existsSync(lintFile)) return [];
  const raw = fs.readFileSync(lintFile, 'utf8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function findDepArrayClose(lines, startLine) {
  const idx = startLine - 1;
  let depth = 0;
  let inHook = false;
  for (let i = idx; i < lines.length; i++) {
    const line = lines[i];
    if (/use(Effect|Callback|Memo|LayoutEffect|ImperativeHandle)\s*\(/.test(line)) inHook = true;
    if (!inHook) continue;
    for (const ch of line) {
      if (ch === '[') depth++;
      if (ch === ']') {
        depth--;
        if (depth === 0) return i;
      }
    }
    if (i > idx + 80) break;
  }
  return -1;
}

function addDepToArray(line, dep) {
  if (!line.includes('[')) return line;
  // already has dep as whole token
  const depRe = new RegExp(`['"]?${dep}['"]?`);
  if (depRe.test(line)) return line;

  if (/\[\s*\]/.test(line)) {
    return line.replace(/\[\s*\]/, `[${dep}]`);
  }
  return line.replace(/\]\s*\)\s*;?\s*$/, `, ${dep}]$1`).replace(/,\s*\]/, `, ${dep}]`);
}

const results = runLintJson();
const fixes = new Map();

for (const file of results) {
  const filePath = path.join(ROOT, file.filePath.replace(/^\.\//, ''));
  for (const msg of file.messages) {
    if (msg.ruleId !== 'react-hooks/exhaustive-deps') continue;
    const missing = [...msg.message.matchAll(/missing dependencies?: '([^']+)'/g)].map((x) => x[1]);
    if (!missing.length) continue;
    if (!fixes.has(filePath)) fixes.set(filePath, []);
    for (const dep of missing) {
      fixes.get(filePath).push({ line: msg.line, dep });
    }
  }
}

let total = 0;
for (const [filePath, items] of fixes) {
  if (!fs.existsSync(filePath)) continue;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const byLine = new Map();
  for (const item of items) {
    if (!byLine.has(item.line)) byLine.set(item.line, new Set());
    byLine.get(item.line).add(item.dep);
  }

  for (const [startLine, deps] of byLine) {
    const closeIdx = findDepArrayClose(lines, startLine);
    if (closeIdx < 0) {
      console.warn('skip (no dep array):', filePath, startLine, [...deps]);
      continue;
    }
    const old = lines[closeIdx];
    let next = old;
    for (const dep of deps) {
      next = addDepToArray(next, dep);
    }
    if (next !== old) {
      lines[closeIdx] = next;
      total++;
      console.log('fixed:', path.relative(ROOT, filePath), closeIdx + 1, [...deps].join(', '));
    }
  }
  fs.writeFileSync(filePath, lines.join('\n'));
}

console.log(`Applied ${total} dependency array fix(es)`);
