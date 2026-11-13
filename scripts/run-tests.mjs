#!/usr/bin/env node
/**
 * Unified Cross-Platform Test Runner (`npm test`)
 * Discovers all `*.test.ts` suites under `src/` and executes them via `tsx --test`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'src');

function collectTestFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTestFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      acc.push(path.relative(repoRoot, fullPath).replace(/\\/g, '/'));
    }
  }
  return acc.sort();
}

const testFiles = collectTestFiles(srcDir);
if (testFiles.length === 0) {
  console.error('[test] Nenhum arquivo *.test.ts encontrado em src/.');
  process.exit(1);
}

const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const result = spawnSync(process.execPath, [tsxCli, '--test', ...testFiles], {
  cwd: repoRoot,
  stdio: 'inherit',
  windowsHide: true,
});

process.exit(result.status ?? 1);
