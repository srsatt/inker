import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

const root = join(import.meta.dir, '..');
const bundleUrl = process.env.TRMNL_FONT_BUNDLE_URL || 'https://trmnl.com/fonts/bundles/trmnl/trmnl-fonts-bundle--trmnl.zip';
const targetDirs = [
  join(root, 'backend', 'assets', 'fonts'),
  join(root, 'frontend', 'public', 'fonts'),
];

const requiredFiles = [
  'TRMNL12-Regular.woff2',
  'TRMNL12-Regular.woff',
  'TRMNL12-Regular.ttf',
  'TRMNL12-Bold.woff2',
  'TRMNL12-Bold.woff',
  'TRMNL12-Bold.ttf',
  'TRMNL16-Regular.woff2',
  'TRMNL16-Regular.woff',
  'TRMNL16-Regular.ttf',
  'TRMNL16-Bold.woff2',
  'TRMNL16-Bold.woff',
  'TRMNL16-Bold.ttf',
  'TRMNL21-Regular.woff2',
  'TRMNL21-Regular.woff',
  'TRMNL21-Regular.ttf',
  'TRMNL21-Bold.woff2',
  'TRMNL21-Bold.woff',
  'TRMNL21-Bold.ttf',
  'Inter.ttf',
  'Inter-Italic.ttf',
];

const optionalFiles = ['README.md'];

function hasRequiredFonts(dir: string): boolean {
  return requiredFiles.every((file) => existsSync(join(dir, file)));
}

async function collectFiles(dir: string, found = new Map<string, string>()) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, found);
      continue;
    }
    const name = basename(entry.name);
    if (requiredFiles.includes(name) || optionalFiles.includes(name)) {
      found.set(name, entryPath);
    }
  }
  return found;
}

async function downloadBundle(zipPath: string) {
  console.log(`Downloading TRMNL font bundle from ${bundleUrl}`);
  const response = await fetch(bundleUrl);
  if (!response.ok) {
    throw new Error(`Font bundle download failed: HTTP ${response.status} ${response.statusText}`);
  }

  await Bun.write(zipPath, await response.arrayBuffer());
}

async function unzip(zipPath: string, targetDir: string) {
  const child = Bun.spawn(['unzip', '-oq', zipPath, '-d', targetDir], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error('Could not extract font bundle. Install unzip or extract the bundle manually.');
  }
}

async function copyFonts(files: Map<string, string>) {
  const missing = requiredFiles.filter((file) => !files.has(file));
  if (missing.length > 0) {
    throw new Error(`Font bundle is missing expected files: ${missing.join(', ')}`);
  }

  for (const targetDir of targetDirs) {
    await mkdir(targetDir, { recursive: true });
    for (const file of [...requiredFiles, ...optionalFiles]) {
      const source = files.get(file);
      if (source) {
        await copyFile(source, join(targetDir, file));
      }
    }
  }
}

async function main() {
  for (const targetDir of targetDirs) {
    await mkdir(targetDir, { recursive: true });
  }

  if (targetDirs.every(hasRequiredFonts)) {
    console.log('TRMNL fonts already present');
    return;
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'inker-fonts-'));
  try {
    const zipPath = join(tempDir, 'trmnl-fonts.zip');
    const extractDir = join(tempDir, 'extract');
    await mkdir(extractDir, { recursive: true });
    await downloadBundle(zipPath);
    await unzip(zipPath, extractDir);
    const files = await collectFiles(extractDir);
    await copyFonts(files);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  for (const targetDir of targetDirs) {
    if (!hasRequiredFonts(targetDir)) {
      throw new Error(`Font initialization incomplete: ${targetDir}`);
    }
  }

  const totalBytes = await targetDirs.reduce(async (sumPromise, targetDir) => {
    const sum = await sumPromise;
    const stats = await Promise.all(requiredFiles.map((file) => stat(join(targetDir, file))));
    return sum + stats.reduce((total, fileStat) => total + fileStat.size, 0);
  }, Promise.resolve(0));

  console.log(`TRMNL fonts initialized in ${targetDirs.length} targets (${Math.round(totalBytes / 1024)} KiB)`);
}

await main();
