#!/usr/bin/env node
import fs from 'fs';

/**
 * Heuristic key extractor for locale TS default-export objects.
 */
export function extractKeysFromLocaleFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const keys = new Set();
  const stack = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)([A-Za-z_][\w]*)\s*:/);
    if (!match) continue;
    const indent = match[1].length;
    const key = match[2];
    if (key === 'export' || key === 'default') continue;

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const path = [...stack.map((s) => s.key), key].join('.');
    keys.add(path);
    stack.push({ indent, key });
  }

  return keys;
}

export function diffLocales(enKeys, faKeys) {
  const missingInFa = [...enKeys].filter((k) => !faKeys.has(k)).sort();
  const missingInEn = [...faKeys].filter((k) => !enKeys.has(k)).sort();
  return { missingInFa, missingInEn };
}
