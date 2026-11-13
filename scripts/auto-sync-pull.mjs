#!/usr/bin/env node
/**
 * EWM · Keep practicing — Ponte Automática Casa ⇄ Trabalho (Pre-Dev Auto-Pull)
 *
 * Executado automaticamente via `predev` antes de `npm run dev`:
 * 1. Verifica conectividade rápida com o GitHub (timeout curto de 3.5s, 100% tolerante a modo offline).
 * 2. Confirma que estamos na branch ativa de desenvolvimento (`feat/ewm-v2`), mantendo `main` protegida.
 * 3. Protege eventuais edições locais não salvas via `--autostash` e executa
 *    `git pull --rebase --autostash origin feat/ewm-v2` sem travar o terminal.
 * 4. Em caso de ausência de internet ou conflito de rebase, aborta com segurança preservando os arquivos
 *    locais e libera imediatamente a subida do servidor (`tsx server.ts`).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const TARGET_BRANCH = process.env.EWM_SYNC_BRANCH || 'feat/ewm-v2';
const CONNECTIVITY_TIMEOUT_MS = 3500;

function logInfo(msg) {
  console.log(`\x1b[36m[auto-sync]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[auto-sync]\x1b[0m ${msg}`);
}

function logWarn(msg) {
  console.warn(`\x1b[33m[auto-sync]\x1b[0m ${msg}`);
}

function resolveGitBinary() {
  const probe = spawnSync('git', ['--version'], { encoding: 'utf-8', windowsHide: true });
  if (!probe.error && probe.status === 0) {
    return 'git';
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const candidates = [
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'git.exe'),
      path.join(programFiles, 'Git', 'cmd', 'git.exe'),
      path.join(localAppData, 'Programs', 'Git', 'cmd', 'git.exe'),
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function runGit(gitBin, args, timeoutMs = 20000) {
  return spawnSync(gitBin, args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    timeout: timeoutMs,
    windowsHide: true,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
    },
  });
}

async function isGitHubReachable() {
  try {
    const res = await fetch('https://github.com', {
      method: 'HEAD',
      signal: AbortSignal.timeout(CONNECTIVITY_TIMEOUT_MS),
    });
    return res.ok || (res.status >= 200 && res.status < 500);
  } catch {
    return false;
  }
}

async function main() {
  if (process.env.CI === 'true' || process.env.SKIP_AUTO_SYNC === '1') {
    return;
  }

  const gitDir = path.join(repoRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    return;
  }

  const gitBin = resolveGitBinary();
  if (!gitBin) {
    logWarn('⚠ Binário `git` não encontrado no PATH — subindo servidor local sem sincronizar.');
    return;
  }

  const reachable = await isGitHubReachable();
  if (!reachable) {
    logWarn('⚠ Sem conexão com o GitHub (modo offline) — subindo servidor local normalmente.');
    return;
  }

  const branchRes = runGit(gitBin, ['rev-parse', '--abbrev-ref', 'HEAD'], 5000);
  if (branchRes.status !== 0) {
    logWarn('⚠ Não foi possível identificar a branch atual — subindo servidor local normalmente.');
    return;
  }

  const currentBranch = (branchRes.stdout || '').trim();
  if (currentBranch !== TARGET_BRANCH) {
    logInfo(
      `ℹ Branch ativa atual é "${currentBranch}" (auto-pull configurado para "${TARGET_BRANCH}" mantendo "main" protegida).`
    );
    return;
  }

  // Confirma se a branch remota já existe e se há acesso sem bloquear por credenciais
  const lsRemoteRes = runGit(
    gitBin,
    ['ls-remote', '--exit-code', '--heads', 'origin', TARGET_BRANCH],
    8000
  );
  if (lsRemoteRes.status === 2) {
    logInfo(`ℹ Branch "${TARGET_BRANCH}" ainda não publicada em origin — subindo servidor local.`);
    return;
  }
  if (lsRemoteRes.status !== 0) {
    logWarn(
      '⚠ GitHub indisponível ou sem resposta do remoto no momento — subindo servidor local sem travar.'
    );
    return;
  }

  const statusRes = runGit(gitBin, ['status', '--porcelain', '--untracked-files=no'], 5000);
  const hasTrackedChanges = Boolean((statusRes.stdout || '').trim());
  if (hasTrackedChanges) {
    logInfo('🛡 Alterações locais detectadas — protegendo automaticamente via autostash...');
  } else {
    logInfo(`↻ Verificando atualizações em origin/${TARGET_BRANCH}...`);
  }

  const pullRes = runGit(
    gitBin,
    ['pull', '--rebase', '--autostash', 'origin', TARGET_BRANCH],
    25000
  );

  if (pullRes.status === 0) {
    const out = `${pullRes.stdout || ''}\n${pullRes.stderr || ''}`;
    if (/Already up to date|Current branch .* is up to date/i.test(out)) {
      logSuccess(`✓ Workspace já está 100% atualizado com origin/${TARGET_BRANCH}.`);
    } else {
      logSuccess(`✓ Atualizações de origin/${TARGET_BRANCH} aplicadas com sucesso!`);
    }
    return;
  }

  // Caso ocorra conflito durante o rebase, aborta de forma limpa para restaurar o estado local + autostash
  const rebaseMergeDir = path.join(gitDir, 'rebase-merge');
  const rebaseApplyDir = path.join(gitDir, 'rebase-apply');
  if (fs.existsSync(rebaseMergeDir) || fs.existsSync(rebaseApplyDir)) {
    runGit(gitBin, ['rebase', '--abort'], 8000);
  }

  logWarn(
    `⚠ Não foi possível aplicar rebase automático de origin/${TARGET_BRANCH} (estado local preservado intacto). Resolva manualmente com \`git status\` quando desejar.`
  );
}

main()
  .catch(() => {
    logWarn('⚠ Aviso no auto-sync ignorado com segurança — iniciando servidor local.');
  })
  .finally(() => {
    process.exit(0);
  });
