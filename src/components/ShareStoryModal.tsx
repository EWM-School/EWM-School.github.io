import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Loader2,
  MessageCircle,
  Share2,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { triggerSuccess, triggerTap } from '../services/platform/hapticsService';
import {
  OFFICIAL_EWM_URL,
  buildWhatsAppShareText,
  renderShareCardBlob,
  type ShareCardPayload,
  type ShareFormat,
  type ShareVisualStyle,
} from '../utils/shareCardGenerator';

interface ShareStoryModalProps {
  payload: ShareCardPayload | null;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export function ShareStoryModal({ payload, onClose, onNotify }: ShareStoryModalProps) {
  const [format, setFormat] = useState<ShareFormat>('story');
  const [visualStyle, setVisualStyle] = useState<ShareVisualStyle>('emerald');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pngBlob, setPngBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState('ewm-story.png');
  const [rendering, setRendering] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    setRendering(true);

    void renderShareCardBlob(payload, format, visualStyle)
      .then((res) => {
        if (cancelled) return;
        setPreviewUrl(res.dataUrl);
        setPngBlob(res.blob);
        setFilename(res.filename);
      })
      .catch(() => {
        if (!cancelled) {
          onNotify('Não foi possível gerar a prévia da imagem.');
        }
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [payload, format, visualStyle, onNotify]);

  if (!payload) return null;

  const shareMessage = buildWhatsAppShareText(payload);

  const canNativeShareFiles = (() => {
    try {
      if (typeof navigator === 'undefined' || !navigator.share || !pngBlob) return false;
      const testFile = new File([pngBlob], filename, { type: 'image/png' });
      return typeof navigator.canShare === 'function' ? navigator.canShare({ files: [testFile] }) : true;
    } catch {
      return false;
    }
  })();

  const handleNativeShare = async () => {
    if (!pngBlob) return;
    void triggerTap();
    try {
      const imageFile = new File([pngBlob], filename, { type: 'image/png' });
      if (navigator.share) {
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [imageFile] })) {
          await navigator.share({
            files: [imageFile],
            title: 'EWM · Keep practicing',
            text: shareMessage,
          });
        } else {
          await navigator.share({
            title: 'EWM · Keep practicing',
            text: shareMessage,
            url: OFFICIAL_EWM_URL,
          });
        }
        void triggerSuccess();
        onNotify('Compartilhamento aberto com sucesso!');
      }
    } catch (err) {
      const name = String((err as { name?: string })?.name || '');
      if (name !== 'AbortError') {
        handleDownloadPng();
      }
    }
  };

  const handleDownloadPng = () => {
    if (!previewUrl) return;
    void triggerSuccess();
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('Imagem PNG salva! Pronta para postar nos Stories ou WhatsApp.');
  };

  const handleWhatsAppDirect = () => {
    void triggerTap();
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyCaption = async () => {
    void triggerTap();
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopiedText(true);
      onNotify('Legenda copiada com link oficial EWM!');
      window.setTimeout(() => setCopiedText(false), 2200);
    } catch {
      onNotify('Não foi possível copiar automaticamente.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-story-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[92dvh] flex flex-col rounded-3xl border border-[#E2DDD3] dark:border-[#2E332E] bg-[#FAF9F6] dark:bg-[#1B1F1B] text-[#1C1B18] dark:text-[#EBE7DE] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#ECE7DD] dark:border-[#2C312C] bg-white dark:bg-[#222722]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#68B4A8] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="share-story-title"
                className="font-display text-sm sm:text-base font-bold truncate"
              >
                Compartilhar nos Stories &amp; WhatsApp
              </h2>
              <p className="text-[11px] text-[#6B655C] dark:text-[#AFAAA0] truncate">
                Arte oficial EWM com QR Code para ewm-school.github.io
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar compartilhamento"
            className="p-2 rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#EAE6DD] dark:hover:bg-[#2C312C] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Format & Palette Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-0.5 rounded-xl bg-[#EAE6DD] dark:bg-[#252A25] border border-[#DFDBD0] dark:border-[#313731]">
              <button
                type="button"
                onClick={() => setFormat('story')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  format === 'story'
                    ? 'bg-white dark:bg-[#333A33] text-[#1C1B18] dark:text-[#F4F7F6] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#AFAAA0]'
                }`}
              >
                Stories (9:16)
              </button>
              <button
                type="button"
                onClick={() => setFormat('post')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  format === 'post'
                    ? 'bg-white dark:bg-[#333A33] text-[#1C1B18] dark:text-[#F4F7F6] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#AFAAA0]'
                }`}
              >
                WhatsApp (4:5)
              </button>
            </div>

            <div className="inline-flex p-0.5 rounded-xl bg-[#EAE6DD] dark:bg-[#252A25] border border-[#DFDBD0] dark:border-[#313731]">
              <button
                type="button"
                onClick={() => setVisualStyle('emerald')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  visualStyle === 'emerald'
                    ? 'bg-[#28665E] text-white shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#AFAAA0]'
                }`}
              >
                Esmeralda
              </button>
              <button
                type="button"
                onClick={() => setVisualStyle('editorial')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  visualStyle === 'editorial'
                    ? 'bg-white dark:bg-[#333A33] text-[#1C1B18] dark:text-[#F4F7F6] shadow-2xs'
                    : 'text-[#6B655C] dark:text-[#AFAAA0]'
                }`}
              >
                Creme Editorial
              </button>
            </div>
          </div>

          {/* Live Image Preview */}
          <div className="relative rounded-2xl border border-[#E2DDD3] dark:border-[#2E332E] bg-[#EFECE4] dark:bg-[#141714] p-3 flex items-center justify-center min-h-[250px]">
            {rendering || !previewUrl ? (
              <div className="flex flex-col items-center gap-2 py-12 text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                <Loader2 className="w-6 h-6 animate-spin text-[#28665E] dark:text-[#68B4A8]" />
                <span>Renderizando arte em alta definição...</span>
              </div>
            ) : (
              <img
                src={previewUrl}
                alt="Prévia do card para Stories e WhatsApp"
                className="max-h-[300px] sm:max-h-[340px] w-auto rounded-xl shadow-lg object-contain select-none"
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {canNativeShareFiles && (
              <button
                type="button"
                disabled={rendering || !pngBlob}
                onClick={() => void handleNativeShare()}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>Compartilhar Imagem (Instagram Stories / WhatsApp)</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={rendering || !previewUrl}
                onClick={handleDownloadPng}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#28665E]/45 dark:border-[#68B4A8]/45 bg-[#EAF3F1] hover:bg-[#DCECE8] dark:bg-[#1E312E] dark:hover:bg-[#26403C] text-[#1E4E47] dark:text-[#86CEC2] text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Baixar Imagem Stories</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsAppDirect}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#1F7A4C] hover:bg-[#18633D] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Enviar no WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyCaption()}
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2DDD3] dark:border-[#323832] bg-white dark:bg-[#232723] text-xs font-medium text-[#5C574E] dark:text-[#C5C0B4] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Legenda copiada!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar legenda com link oficial</span>
                  <Share2 className="w-3 h-3 opacity-60" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
