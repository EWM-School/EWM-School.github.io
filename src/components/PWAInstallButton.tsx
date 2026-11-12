import { useEffect, useState } from 'react';
import { Bookmark, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (!showGuideModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowGuideModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuideModal]);

  if (isInstalled) {
    return null;
  }

  const handleActionClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleActionClick}
        className="inline-flex items-center gap-1.5 hover:text-[#1C1B18] dark:hover:text-[#EBE7DE] transition-colors cursor-pointer"
        title="Adicionar atalho com o ícone EWM na tela inicial do celular ou nos favoritos"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#28665E] dark:text-[#68B4A8]" />
        <span>Salvar no celular</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ewm-install-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#E2DDD3] dark:border-[#2E332E] bg-[#FAF9F6] dark:bg-[#212421] p-6 shadow-xl text-[#1C1B18] dark:text-[#EBE7DE] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={`${import.meta.env.BASE_URL}assets/aistudio/WhatsApp_Image_2026-11-07_at_17.55.16_2916485b.jpeg`}
                  alt="Ícone oficial EWM Keep practicing"
                  className="w-12 h-12 rounded-2xl object-contain bg-white p-1 border border-[#E4E0D8] dark:border-[#343A34] shrink-0 shadow-2xs"
                />
                <div>
                  <h3
                    id="ewm-install-modal-title"
                    className="font-display text-base sm:text-lg font-bold leading-snug"
                  >
                    Salvar EWM no celular ou favoritos
                  </h3>
                  <p className="text-xs text-[#6B655C] dark:text-[#AFAAA0]">
                    Acesse os flashcards direto pelo ícone oficial da marca
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fechar instruções"
                className="p-1.5 rounded-xl text-[#6B655C] dark:text-[#AFAAA0] hover:bg-[#ECE8DF] dark:hover:bg-[#2C312C] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs sm:text-[13px] leading-relaxed">
              {isIOS ? (
                <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#1B1E1B] p-3.5 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-[#28665E] dark:text-[#68B4A8]">
                    <Share className="w-4 h-4 shrink-0" />
                    <span>No iPhone ou iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[#524E46] dark:text-[#B9B4AA]">
                    <li>
                      Toque no botão <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">Compartilhar</strong> na barra do Safari.
                    </li>
                    <li>
                      Role para baixo e toque em <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">Adicionar à Tela de Início</strong>.
                    </li>
                  </ol>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#1B1E1B] p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-[#28665E] dark:text-[#68B4A8]">
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>No celular (Android / Safari iOS)</span>
                    </div>
                    <p className="text-[#524E46] dark:text-[#B9B4AA]">
                      No Chrome (Android), abra o menu <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">⋮</strong> e toque em{' '}
                      <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">Adicionar à tela inicial</strong>. No Safari (iPhone), toque em{' '}
                      <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">Compartilhar → Adicionar à Tela de Início</strong>.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white dark:bg-[#1B1E1B] p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-[#28665E] dark:text-[#68B4A8]">
                      <Bookmark className="w-4 h-4 shrink-0" />
                      <span>Nos Favoritos do Navegador</span>
                    </div>
                    <p className="text-[#524E46] dark:text-[#B9B4AA]">
                      Pressione <strong className="font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]">Ctrl+D</strong> (ou{' '}
                      <strong className="font-mono-num text-[#1C1B18] dark:text-[#EBE7DE]">⌘+D</strong> no Mac) para fixar o atalho com o ícone{' '}
                      <strong className="text-[#1C1B18] dark:text-[#EBE7DE]">EWM Keep practicing</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-2xl bg-[#28665E] hover:bg-[#1F524B] dark:bg-[#2A6D63] dark:hover:bg-[#327D72] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
