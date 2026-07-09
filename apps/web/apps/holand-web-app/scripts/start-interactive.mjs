import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';

const DEFAULT_PORT = 3002;
const CONFIG_FILE = '.start-config.json';
const HOST = '0.0.0.0';

const appRoot = process.cwd();
const configPath = path.join(appRoot, CONFIG_FILE);

function isValidPort(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

function readConfigPort() {
  try {
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (isValidPort(parsed.defaultStartPort)) return Number(parsed.defaultStartPort);
    return null;
  } catch {
    return null;
  }
}

function writeConfigPort(port) {
  const payload = {
    defaultStartPort: port,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(configPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function getPortArg() {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((x) => x === '-p' || x === '--port');
  if (idx === -1) return null;
  const val = argv[idx + 1];
  if (!val) return null;
  return isValidPort(val) ? Number(val) : null;
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function choosePort() {
  const fromArg = getPortArg();
  if (fromArg) return fromArg;

  const fromEnv = process.env.PORT;
  if (fromEnv && isValidPort(fromEnv)) return Number(fromEnv);

  const savedDefault = readConfigPort() ?? DEFAULT_PORT;
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive) return savedDefault;

  console.log(`[start] Default port: ${savedDefault}`);
  console.log('[start] Press Enter to keep default.');
  const input = await ask('[start] Port for this run: ');
  if (!input) return savedDefault;
  if (!isValidPort(input)) {
    console.log(`[start] Invalid port "${input}". Falling back to ${savedDefault}.`);
    return savedDefault;
  }

  const selected = Number(input);
  if (selected !== savedDefault) {
    const save = await ask('[start] Save this as new default? [y/N]: ');
    if (/^y(es)?$/i.test(save)) {
      writeConfigPort(selected);
      console.log(`[start] Saved default port ${selected} to ${CONFIG_FILE}`);
    }
  }
  return selected;
}

function resolveNextBin() {
  const localBin = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (fs.existsSync(localBin)) return localBin;

  throw new Error(
    'Next.js is not installed in this app. Run `pnpm install` from the holand-web monorepo root, then build with `pnpm --filter holand-web-app build`.'
  );
}

function assertProductionBuild() {
  const buildIdPath = path.join(appRoot, '.next', 'BUILD_ID');
  if (fs.existsSync(buildIdPath)) return;

  const devCachePath = path.join(appRoot, '.next', 'cache');
  const hasDevCache = fs.existsSync(devCachePath);
  const message = hasDevCache
    ? '[start] .next contains a development cache (no BUILD_ID). `next start` requires a production build.'
    : '[start] No production build found (.next/BUILD_ID missing).';

  console.error(message);
  console.error('[start] For local development, run:');
  console.error('  pnpm --filter holand-web-app dev');
  console.error('[start] Or from repo root: .\\check-and-run.ps1 -AutoYes');
  console.error('[start] To run production locally:');
  console.error('  pnpm --filter holand-web-app build && pnpm --filter holand-web-app start');
  process.exit(1);
}

async function main() {
  const port = await choosePort();
  const nextBin = resolveNextBin();
  assertProductionBuild();
  console.log(`[start] Launching Next.js production server on ${HOST}:${port}`);

  const child = spawn(process.execPath, [nextBin, 'start', '-H', HOST, '-p', String(port)], {
    stdio: 'inherit',
    cwd: appRoot,
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error('[start] Failed to launch:', err);
  process.exit(1);
});
