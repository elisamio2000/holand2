/**
 * Merge all duplicate import statements from the same module in a file.
 */
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

const IMPORT_RE = /^import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/m;

function extractImports(content) {
  const imports = [];
  const importStart = /^import\s+/;
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    if (!importStart.test(lines[i])) {
      i++;
      continue;
    }
    let start = i;
    let block = lines[i];
    while (!block.trimEnd().endsWith(';') && i + 1 < lines.length) {
      i++;
      block += '\n' + lines[i];
    }
    const sourceMatch = block.match(/\sfrom\s+['"]([^'"]+)['"]\s*;?\s*$/);
    if (sourceMatch) {
      imports.push({ start, end: i, block, source: sourceMatch[1] });
    }
    i++;
  }
  return imports;
}

function parseImportBlock(block) {
  const single = block.replace(/\n/g, ' ').trim();
  const isTypeOnly = /^import\s+type\s+/.test(single);
  const m = single.match(/^import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"]\s*;?$/);
  if (!m) return null;

  const clause = m[1].trim();
  const source = m[2];
  let defaultName = null;
  const named = new Set();
  const typeNamed = new Set();

  const addNamed = (part) => {
    const p = part.trim();
    if (!p) return;
    if (p.startsWith('type ')) typeNamed.add(p.slice(5).trim());
    else named.add(p);
  };

  if (clause.startsWith('{')) {
    clause.slice(1, -1).split(',').forEach(addNamed);
  } else if (clause.includes('{')) {
    const brace = clause.indexOf('{');
    const def = clause.slice(0, brace).replace(/,\s*$/, '').trim();
    if (def) defaultName = def;
    clause.slice(brace + 1, -1).split(',').forEach(addNamed);
  } else {
    defaultName = clause;
  }

  return { source, defaultName, named, typeNamed, isTypeOnly };
}

function formatMerged(imp) {
  const typeItems = [...imp.typeNamed].map((n) => `type ${n}`);
  const namedItems = [...imp.named, ...typeItems];
  let clause = '';
  if (imp.defaultName && namedItems.length) {
    clause = `${imp.defaultName}, { ${namedItems.join(', ')} }`;
  } else if (imp.defaultName) {
    clause = imp.defaultName;
  } else if (namedItems.length) {
    clause = `{ ${namedItems.join(', ')} }`;
  } else {
    return null;
  }

  if (imp.isTypeOnly && !imp.defaultName && imp.typeNamed.size && !imp.named.size) {
    return `import type { ${[...imp.typeNamed].join(', ')} } from '${imp.source}';`;
  }
  return `import ${clause} from '${imp.source}';`;
}

function mergeFile(content) {
  const imports = extractImports(content);
  if (imports.length < 2) return content;

  const groups = new Map();
  for (const imp of imports) {
    const parsed = parseImportBlock(imp.block);
    if (!parsed) continue;
    if (!groups.has(parsed.source)) {
      groups.set(parsed.source, { ...parsed, firstStart: imp.start, blocks: [imp] });
    } else {
      const g = groups.get(parsed.source);
      parsed.named.forEach((n) => g.named.add(n));
      parsed.typeNamed.forEach((n) => g.typeNamed.add(n));
      if (parsed.defaultName) g.defaultName = parsed.defaultName;
      g.isTypeOnly = g.isTypeOnly && parsed.isTypeOnly;
      g.blocks.push(imp);
    }
  }

  const toRemove = [];
  const toAdd = [];
  for (const [, g] of groups) {
    if (g.blocks.length < 2) continue;
    const merged = formatMerged(g);
    if (!merged) continue;
    toRemove.push(...g.blocks);
    toAdd.push({ start: g.firstStart, text: merged });
  }

  if (!toRemove.length) return content;

  const lines = content.split('\n');
  const removeRanges = new Set();
  for (const b of toRemove) {
    for (let i = b.start; i <= b.end; i++) removeRanges.add(i);
  }

  const result = [];
  const addedAt = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (removeRanges.has(i)) {
      const add = toAdd.find((a) => a.start === i);
      if (add && !addedAt.has(add.start)) {
        result.push(add.text);
        addedAt.add(add.start);
      }
      continue;
    }
    result.push(lines[i]);
  }
  return result.join('\n');
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : globSync('src/**/*.{ts,tsx}', { cwd: process.cwd(), absolute: true });

let count = 0;
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const merged = mergeFile(content);
  if (merged !== content) {
    fs.writeFileSync(f, merged);
    console.log('fixed:', path.relative(process.cwd(), f));
    count++;
  }
}
console.log(`Merged imports in ${count} file(s)`);
