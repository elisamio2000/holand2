#!/usr/bin/env node
/**
 * Download small CC0 test media for /dev/media-players lab.
 * Run from apps/holand-web-app: node scripts/fetch-test-media.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/test-media');

const ASSETS = [
  {
    name: 'female_02.mp3',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
  },
  {
    name: 'test-video.mp4',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  },
];

async function fetchAsset({ name, url }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(outDir, name);
  await writeFile(dest, buf);
  console.log(`Wrote ${dest} (${buf.length} bytes)`);
}

await mkdir(outDir, { recursive: true });
for (const asset of ASSETS) {
  await fetchAsset(asset);
}
console.log('Done â€” test media ready at public/test-media/');

