/**
 * One-off codemod: migrate `Tooltip` imports from rizzui to @/components/tooltip
 * Run: node scripts/migrate-tooltip-imports.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CORE_IMPORT = "import { SmartTooltip as Tooltip } from '../ui/smart-tooltip';";
const APP_IMPORT = "import { Tooltip } from '@/components/tooltip';";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(entry.name)) continue;
      walk(full, files);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function migrateFile(filePath) {
  if (filePath.includes('components/tooltip.tsx')) return false;
  if (filePath.includes('smart-tooltip')) return false;
  if (filePath.includes('header-action-tooltip.tsx')) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('Tooltip') || !content.includes("'rizzui'")) return false;

  const importRegex =
    /import\s+\{([^}]+)\}\s+from\s+['"]rizzui['"];?/g;
  let changed = false;
  let needsTooltipImport = false;

  content = content.replace(importRegex, (match, importsRaw) => {
    const parts = importsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const hasTooltip = parts.some((p) => p.replace(/\s+as\s+.*/, '').trim() === 'Tooltip');
    if (!hasTooltip) return match;

    const remaining = parts.filter((p) => p.replace(/\s+as\s+.*/, '').trim() !== 'Tooltip');
    changed = true;
    needsTooltipImport = true;

    if (remaining.length === 0) {
      return '';
    }
    return `import { ${remaining.join(', ')} } from 'rizzui';`;
  });

  if (!changed) return false;

  const isCore = filePath.includes(`${path.sep}packages${path.sep}holand-core${path.sep}`);
  const tooltipImport = isCore ? CORE_IMPORT : APP_IMPORT;

  // Avoid duplicate import
  if (!content.includes(tooltipImport) && !content.includes("@/components/tooltip") && !content.includes("../ui/smart-tooltip")) {
    const firstImport = content.search(/^import\s/m);
    if (firstImport >= 0) {
      content =
        content.slice(0, firstImport) +
        tooltipImport +
        '\n' +
        content.slice(firstImport);
    } else {
      content = tooltipImport + '\n' + content;
    }
  }

  // Clean double blank lines after removed imports
  content = content.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

const appDir = path.join(root, 'apps/holand-web-app/src');
const coreDir = path.join(root, 'packages/holand-core/src');
const files = [...walk(appDir), ...walk(coreDir)];
const migrated = files.filter(migrateFile);

console.log(`Migrated ${migrated.length} files:`);
migrated.forEach((f) => console.log(' -', path.relative(root, f)));

