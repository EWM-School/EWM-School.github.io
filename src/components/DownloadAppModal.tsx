import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  PlusSquare,
  QrCode,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const OFFICIAL_ANDROID_APK_URL =
  'https://github.com/igor765rs/EWM-Keep-practicing/releases/latest/download/EWM-Keep-Practicing.apk';

export const OFFICIAL_WEB_APP_URL =
  'https://igor765rs.github.io/EWM-Keep-practicing/';

function resolvePublicMobileEntryUrl(): string {
  if (typeof window === 'undefined') {
    return `${OFFICIAL_WEB_APP_URL}?download=1`;
  }
  const { protocol, hostname, origin, pathname } = window.location;
  const isLocalOrNative =
    protocol !== 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');

  if (isLocalOrNative) {
    return `${OFFICIAL_WEB_APP_URL}?download=1`;
  }

  const normalizedPath = pathname.endsWith('/')
    ? pathname
    : pathname.replace(/\/index\.html$/i, '/');
  return `${origin}${normalizedPath}?download=1`;
}

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (message: string) => void;
}

type QrTargetMode = 'smart_page' | 'direct_apk';

export function DownloadAppModal({
  isOpen,
  onClose,
  onNotify,
}: DownloadAppModalProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [qrMode, setQrMode] = useState<QrTargetMode>('smart_page');
  const [qrSvgDataUrl, setQrSvgDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [installingPwa, setInstallingPwa] = useState(false);

  const mobileSmartUrl = useMemo(() => resolvePublicMobileEntryUrl(), []);
  const activeQrUrl =
    qrMode === 'direct_apk' ? OFFICIAL_ANDROID_APK_URL : mobileSmartUrl;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    QRCode.toString(activeQrUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: {
        dark: '#1C1B18',
        light: '#FFFFFF',
      },
    })
      .then((svgMarkup) => {
        if (cancelled) return;
        const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`;
        setQrSvgDataUrl(encoded);
      })
      .catch(() => {
        if (!cancelled) setQrSvgDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [activeQrUrl, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(mobileSmartUrl);
      setCopiedLink(true);
      onNotify?.('Link de download copiado para enviar ao celular!');
      window.setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      onNotify?.(`Acesse no celular: ${OFFICIAL_WEB_APP_URL}`);
    }
  };

  const handleDirectPwaInstall = async () => {
    if (!isInstallable || installingPwa) return;
    setInstallingPwa(true);
    try {
      const accepted = await install();
      if (accepted) {
        onNotify?.('Aplicativo EWM instalado com sucesso na tela inicial!');
        onClose();
      }
    } finally {
      setInstallingPwa(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ewm-download-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-auto rounded-3xl border border-[#E2DDD3] dark:border-[#2E332E] bg-[#FAF9F6] dark:bg-[#1E211E] p-5 sm:p-7 shadow-2xl text-[#1C1B18] dark:text-[#EBE7DE] space-y-5 animate-card-enter max-h-[calc(100dvh-1.5rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E6E2D8] dark:border-[#2C312C] pb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={`${import.meta.env.BASE_URL}ewm-logo.jpg`}
              alt="Ícone oficial EWM Keep practicing"
              referrerPolicy="no-referrer"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain bg-white p-1 border border-[#E4E0D8] dark:border-[#343A34] shrink-0 shadow-xs"
            />
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8] text-[11px] font-bold tracking-wide uppercase mb-1">
                <Smartphone className="w-3 h-3" />
                <span>App Oficial Mobile &amp; Offline</span>
              </div>
              <h2
                id="ewm-download-modal-title"
                className="font-display text-lg sm:text-xl font-bold tracking-tight leading-snug"
              >
                Baixar EWM · Keep practicing no Celular
              </h2>
              <p className="text-xs sm:text-[13px] text-[#6B655C] dark:text-[#AFAAA0]">
                Estude em tela cheia com áudio nativo US/UK, vibração tátil e modo 100% offline.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de download"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#ECE8DF] dark:hover:bg-[#2C312C] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-Column Layout: Left = Dynamic QR Code (PC -> Mobile), Right = Android APK + iOS/PWA */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          {/* Column 1: Dynamic QR Code Card */}
          <div className="md:col-span-5 rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#171A17] p-4 sm:p-5 flex flex-col items-center justify-between text-center space-y-3.5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#28665E] dark:text-[#68B4A8]">
                <QrCode className="w-4 h-4" />
                <span>No computador? Aponte a câmera</span>
              </div>
              <p className="text-[11px] text-[#6B655C] dark:text-[#9E998F] leading-snug">
                Escaneie com a câmera do Android ou iPhone para abrir direto na tela de instalação.
              </p>
            </div>

            {/* Crisp Client-Generated Vector QR Code */}
            <div className="p-3 rounded-2xl bg-white border-2 border-[#E4E0D8] dark:border-[#357F74]/50 shadow-xs">
              {qrSvgDataUrl ? (
                <img
                  src={qrSvgDataUrl}
                  alt="QR Code para abrir e instalar o aplicativo EWM no celular"
                  className="w-44 h-44 sm:w-48 sm:h-48 object-contain select-none"
                />
              ) : (
                <div className="w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center text-xs text-[#6B655C]">
                  Gerando QR Code...
                </div>
              )}
            </div>

            {/* QR Target Switcher */}
            <div className="w-full grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F3F0E8] dark:bg-[#222622] text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setQrMode('smart_page')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                  qrMode === 'smart_page'
                    ? 'bg-white dark:bg-[#2F352F] text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#9E998F] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
                }`}
              >
                Android &amp; iOS
              </button>
              <button
                type="button"
                onClick={() => setQrMode('direct_apk')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                  qrMode === 'direct_apk'
                    ? 'bg-white dark:bg-[#2F352F] text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#9E998F] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
                }`}
              >
                APK Direto
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E0D8] dark:border-[#2E332E] hover:border-[#28665E] dark:hover:border-[#68B4A8] text-xs font-semibold text-[#524E46] dark:text-[#D4CFC5] transition-colors cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
                  <span className="text-[#28665E] dark:text-[#68B4A8]">Link copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar link para mandar no WhatsApp</span>
                </>
              )}
            </button>
          </div>

          {/* Column 2: Direct Android APK + iPhone (iOS) / Instant PWA */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-3.5">
            {/* Option 1: Direct Android APK Installer */}
            <div className="rounded-2xl border border-[#C6DBD7] dark:border-[#2F4B46] bg-[#F2F8F7] dark:bg-[#192825] p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#225851] dark:text-[#86CEC2]">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Android • Instalador Nativo Oficial (.APK)</span>
                  </div>
                  <p className="text-xs text-[#524E46] dark:text-[#B9B4AA] leading-relaxed">
                    Baixe direto no smartphone Android ou salve no computador para transferir. Inclui motor TTS nativo US/UK e lembretes locais.
                  </p>
                </div>
              </div>

              <a
                href={OFFICIAL_ANDROID_APK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  onNotify?.(
                    'Iniciando download de EWM-Keep-Practicing.apk! Abra o arquivo ao concluir.'
                  )
                }
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] active:bg-[#19433D] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white font-semibold text-sm shadow-sm transition-all cursor-pointer select-none"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Baixar APK para Android</span>
                <span className="text-[11px] font-mono-num bg-white/15 px-2 py-0.5 rounded-md">
                  latest
                </span>
              </a>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C574E] dark:text-[#9E998F]">
                <span>
                  Dica Android: toque no arquivo baixado e confirme <strong>Instalar</strong>.
                </span>
                <a
                  href="https://github.com/igor765rs/EWM-Keep-practicing/releases/latest"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#28665E] dark:text-[#68B4A8] hover:underline"
                >
                  <span>Ver Release oficial</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Option 2: iPhone (iOS) 2-Step Visual Guide + Direct Browser PWA Install */}
            <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#171A17] p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1C1B18] dark:text-[#EBE7DE]">
                  <Sparkles className="w-4 h-4 text-[#28665E] dark:text-[#68B4A8] shrink-0" />
                  <span>
                    {isIOS
                      ? 'Você está no iPhone/iPad • Instale em 2 toques'
                      : 'iPhone (iOS) & Instalação Instantânea (PWA)'}
                  </span>
                </div>
                {isInstalled && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#28665E] dark:text-[#68B4A8]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Instalado</span>
                  </span>
                )}
              </div>

              {/* 2-Step Visual Guide for iOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-[#ECE8DF] dark:border-[#262B26] bg-[#FAF9F6] dark:bg-[#202420] p-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#28665E] dark:text-[#68B4A8]">
                    <span className="w-5 h-5 rounded-full bg-[#28665E] text-white text-[11px] inline-flex items-center justify-center font-mono-num shrink-0">
                      1
                    </span>
                    <span>Abra no Safari e Compartilhe</span>
                  </div>
                  <p className="text-[11px] text-[#5C574E] dark:text-[#AFAAA0] leading-relaxed">
                    Escaneie o QR Code no iPhone para abrir no <strong>Safari</strong> e toque em{' '}
                    <span className="inline-flex items-center gap-0.5 font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                      <Share className="w-3 h-3 inline text-[#28665E] dark:text-[#68B4A8]" />{' '}
                      Compartilhar
                    </span>
                    .
                  </p>
                </div>

                <div className="rounded-xl border border-[#ECE8DF] dark:border-[#262B26] bg-[#FAF9F6] dark:bg-[#202420] p-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#28665E] dark:text-[#68B4A8]">
                    <span className="w-5 h-5 rounded-full bg-[#28665E] text-white text-[11px] inline-flex items-center justify-center font-mono-num shrink-0">
                      2
                    </span>
                    <span>Adicionar à Tela de Início</span>
                  </div>
                  <p className="text-[11px] text-[#5C574E] dark:text-[#AFAAA0] leading-relaxed">
                    Escolha{' '}
                    <span className="inline-flex items-center gap-0.5 font-semibold text-[#1C1B18] dark:text-[#EBE7DE]">
                      <PlusSquare className="w-3 h-3 inline text-[#28665E] dark:text-[#68B4A8]" />{' '}
                      Adicionar à Tela de Início
                    </span>{' '}
                    para abrir em tela cheia sem barra de endereço.
                  </p>
                </div>
              </div>

              {/* Direct Browser Install Button (`beforeinstallprompt`) when supported */}
              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  disabled={installingPwa}
                  onClick={() => void handleDirectPwaInstall()}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#28665E] dark:border-[#68B4A8] bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#26403C] text-[#1E4E47] dark:text-[#86CEC2] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>
                    {installingPwa
                      ? 'Abrindo instalador...'
                      : 'Instalar App Instantâneo agora (Web App / PWA)'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
