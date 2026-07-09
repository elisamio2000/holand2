import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_EXTERNAL_PATTERNS } from '@/app/shared/admin-dashboard/design-independence';

const APP_ROOT = join(__dirname, '../../..');
const PUBLIC_FONTS_DIR = join(APP_ROOT, 'public/fonts');
const SRC_DIR = join(APP_ROOT, 'src');
const REQUIRED_FONT_FILES = [
  'Inter-Variable.woff2',
  'LexendDeca-Variable.woff2',
  'Vazirmatn-Variable.woff2',
] as const;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      collectSourceFiles(fullPath, acc);
      continue;
    }
    if (/\.(ts|tsx|css|mjs)$/.test(entry)) acc.push(fullPath);
  }
  return acc;
}

describe('fonts-offline', () => {
  it('uses next/font/local only (no Google Fonts module)', () => {
    const fontsTs = readFileSync(join(APP_ROOT, 'src/app/fonts.ts'), 'utf8');
    expect(fontsTs).toContain("from 'next/font/local'");
    expect(fontsTs).not.toContain('next/font/google');
    expect(fontsTs).toContain('../../public/fonts/');
  });

  it('ships all required woff2 files under public/fonts', () => {
    for (const file of REQUIRED_FONT_FILES) {
      const path = join(PUBLIC_FONTS_DIR, file);
      expect(existsSync(path), `missing ${file}`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(10_000);
    }
  });

  it('does not reference external font CDNs in app source', () => {
    const offenders: string[] = [];
    const allowlist = new Set([
      join(SRC_DIR, 'app/shared/admin-dashboard/design-independence.ts'),
    ]);

    for (const file of collectSourceFiles(SRC_DIR)) {
      if (allowlist.has(file) || file.includes('__tests__')) continue;
      const content = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_EXTERNAL_PATTERNS) {
        if (!pattern.includes('font') && !pattern.includes('gstatic')) continue;
        if (content.includes(pattern)) {
          offenders.push(`${relative(APP_ROOT, file)} → ${pattern}`);
        }
      }
      if (content.includes('next/font/google')) {
        offenders.push(`${relative(APP_ROOT, file)} → next/font/google`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
