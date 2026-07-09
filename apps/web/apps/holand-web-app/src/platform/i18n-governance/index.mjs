#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanHardcodedStrings } from './scan-hardcoded.mjs';
import { diffLocales, extractKeysFromLocaleFile } from './check-locale-parity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '../../..');
const BASELINE_PATH = path.resolve(
  __dirname,
  '../../../../../../../../docs/frontend-development/results/i18n-baseline.json'
);
const RESULTS_DIR = path.dirname(BASELINE_PATH);

const checkMode = process.argv.includes('--check');
const failOnNew = process.argv.includes('--fail-on-new');

async function main() {
  const hardcoded = scanHardcodedStrings();
  const enPath = path.join(APP_ROOT, 'src/locales/en.ts');
  const faPath = path.join(APP_ROOT, 'src/locales/fa.ts');
  const enKeys = extractKeysFromLocaleFile(enPath);
  const faKeys = extractKeysFromLocaleFile(faPath);
  const parity = diffLocales(enKeys, faKeys);

  const report = {
    timestamp: new Date().toISOString(),
    hardcodedCount: hardcoded.length,
    hardcodedSample: hardcoded.slice(0, 50),
    localeParity: {
      enKeyCount: enKeys.size,
      faKeyCount: faKeys.size,
      missingInFa: parity.missingInFa.slice(0, 100),
      missingInEn: parity.missingInEn.slice(0, 100),
      missingInFaCount: parity.missingInFa.length,
      missingInEnCount: parity.missingInEn.length,
    },
  };

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const outPath = path.join(RESULTS_DIR, 'i18n-scan-latest.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`i18n scan written: ${outPath}`);
  console.log(`  hardcoded heuristic: ${report.hardcodedCount}`);
  console.log(`  missing in fa: ${report.localeParity.missingInFaCount}`);
  console.log(`  missing in en: ${report.localeParity.missingInEnCount}`);

  if (parity.missingInFa.length > 0 || parity.missingInEn.length > 0) {
    console.warn('Locale parity gaps detected (warn only in phase 1).');
  }

  if (checkMode && failOnNew && fs.existsSync(BASELINE_PATH)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    if (report.hardcodedCount > baseline.hardcodedCount) {
      console.error(
        `i18n regression: hardcoded count ${report.hardcodedCount} > baseline ${baseline.hardcodedCount}`
      );
      process.exit(1);
    }
  }

  if (checkMode && !fs.existsSync(BASELINE_PATH)) {
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify({ hardcodedCount: report.hardcodedCount, createdAt: report.timestamp }, null, 2)
    );
    console.log(`Baseline created: ${BASELINE_PATH}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
