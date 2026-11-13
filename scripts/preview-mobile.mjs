/**
 * scripts/preview-mobile.mjs
 *
 * Opens a secure public HTTPS tunnel (Cloudflare Quick Tunnel — `https://*.trycloudflare.com`)
 * pointing to `http://localhost:3000` so iOS Safari / Android Chrome can test Web Audio,
 * Speaking Lab microphone (`getUserMedia`), and all 4 Mini-Games over real TLS without
 * same-Wi-Fi firewall restrictions.
 *
 * Features:
 * 1. Automatically starts `npm run dev` on port 3000 if not already running;
 * 2. Resolves `cloudflared` from PATH / WinGet user links, or installs user-scoped via winget,
 *    or downloads the official standalone `cloudflared-windows-amd64.exe` into `.cloudflared-bin/`
 *    with zero admin privileges required;
 * 3. Writes `.tunnel-url.tmp` (gitignored) so the local app's QR modal also exposes the live URL,
 *    and prints a scannable QR Code right in the terminal.
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const TUNNEL_FILE = path.join(ROOT_DIR, '.tunnel-url.tmp');
const PORTABLE_DIR = path.join(ROOT_DIR, '.cloudflared-bin');
const PORTABLE_BIN = path.join(
  PORTABLE_DIR,
  process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
);
const LOCAL_DEV_URL = 'http://localhost:3000';

function findExistingCloudflared() {
  if (fs.existsSync(PORTABLE_BIN)) {
    return PORTABLE_BIN;
  }

  if (process.platform === 'win32') {
    const whereRes = spawnSync('where.exe', ['cloudflared'], { encoding: 'utf8' });
    if (whereRes.status === 0 && whereRes.stdout.trim()) {
      return whereRes.stdout.trim().split(/\r?\n/)[0].trim();
    }
    const localAppData = process.env.LOCALAPPDATA || '';
    const wingetLink = path.join(
      localAppData,
      'Microsoft',
      'WinGet',
      'Links',
      'cloudflared.exe'
    );
    if (localAppData && fs.existsSync(wingetLink)) {
      return wingetLink;
    }
  } else {
    const whichRes = spawnSync('which', ['cloudflared'], { encoding: 'utf8' });
    if (whichRes.status === 0 && whichRes.stdout.trim()) {
      return whichRes.stdout.trim().split(/\r?\n/)[0].trim();
    }
  }

  return null;
}

async function downloadPortableCloudflared() {
  if (process.platform !== 'win32') {
    throw new Error(
      'Instale cloudflared manualmente (brew install cloudflared / apt install cloudflared).'
    );
  }

  fs.mkdirSync(PORTABLE_DIR, { recursive: true });
  const releaseUrl =
    'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

  console.log(
    '[preview:mobile] Baixando binário oficial portátil do Cloudflare Tunnel (zero admin)...'
  );
  const response = await fetch(releaseUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(
      `Falha ao baixar cloudflared portátil (HTTP ${response.status}).`
    );
  }
  const arrayBuf = await response.arrayBuffer();
  fs.writeFileSync(PORTABLE_BIN, Buffer.from(arrayBuf));
  return PORTABLE_BIN;
}

async function ensureCloudflaredBinary() {
  const existing = findExistingCloudflared();
  if (existing) return existing;

  if (process.platform === 'win32') {
    console.log(
      '[preview:mobile] Tentando instalar Cloudflare.cloudflared via winget (--scope user)...'
    );
    const wingetRes = spawnSync(
      'winget',
      [
        'install',
        '--id',
        'Cloudflare.cloudflared',
        '--scope',
        'user',
        '--accept-source-agreements',
        '--accept-package-agreements',
        '--silent',
      ],
      { stdio: 'pipe', encoding: 'utf8' }
    );
    if (wingetRes.status === 0) {
      const afterWinget = findExistingCloudflared();
      if (afterWinget) return afterWinget;
    }
  }

  return downloadPortableCloudflared();
}

async function isLocalServerUp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${LOCAL_DEV_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function ensureLocalDevServer() {
  if (await isLocalServerUp()) {
    console.log(`[preview:mobile] Servidor local detectado em ${LOCAL_DEV_URL}`);
    return null;
  }

  console.log(
    `[preview:mobile] Iniciando servidor de desenvolvimento em ${LOCAL_DEV_URL}...`
  );
  const tsxCli = path.join(ROOT_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const devProc = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    windowsHide: true,
  });

  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isLocalServerUp()) {
      console.log(`[preview:mobile] Servidor pronto em ${LOCAL_DEV_URL}`);
      return devProc;
    }
  }
  throw new Error(`Servidor local não respondeu em ${LOCAL_DEV_URL} após 30s.`);
}

async function main() {
  let spawnedDev = null;
  let tunnelProc = null;

  const cleanup = () => {
    try {
      if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE);
    } catch {
      // ignore
    }
    if (tunnelProc && !tunnelProc.killed) {
      tunnelProc.kill();
    }
    if (spawnedDev && !spawnedDev.killed) {
      spawnedDev.kill();
    }
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  spawnedDev = await ensureLocalDevServer();
  const cloudflaredBin = await ensureCloudflaredBinary();

  console.log('[preview:mobile] Abrindo túnel HTTPS seguro via Cloudflare...');
  tunnelProc = spawn(
    cloudflaredBin,
    ['tunnel', '--url', LOCAL_DEV_URL, '--no-autoupdate'],
    {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );

  let announced = false;
  const handleChunk = async (chunk) => {
    const text = chunk.toString('utf8');
    if (announced) return;

    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (!match) return;

    announced = true;
    const publicHttpsUrl = match[0];
    fs.writeFileSync(TUNNEL_FILE, `${publicHttpsUrl}\n`, 'utf8');

    const qrTerminal = await QRCode.toString(publicHttpsUrl, {
      type: 'terminal',
      small: true,
    });

    console.log('\n============================================================');
    console.log(' 📱 EWM PREVIEW HTTPS NO SMARTPHONE ATIVO (feat/ewm-v2)');
    console.log(` 🔗 URL Segura: ${publicHttpsUrl}`);
    console.log('============================================================\n');
    console.log(qrTerminal);
    console.log(
      'Aponte a câmera do iPhone ou Android para o QR Code acima (microfone e Web Audio liberados via HTTPS).'
    );
    console.log('Pressione Ctrl+C para encerrar o túnel.\n');
  };

  tunnelProc.stdout.on('data', handleChunk);
  tunnelProc.stderr.on('data', handleChunk);

  tunnelProc.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('[preview:mobile] Erro:', err instanceof Error ? err.message : err);
  process.exit(1);
});
